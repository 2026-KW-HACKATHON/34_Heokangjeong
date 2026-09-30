// Notion 연동 (Supabase Edge Function, Deno). 포트폴리오를 사용자의 Notion 에 실제 페이지로 저장한다.
//  GET  /notion/callback           : OAuth 콜백 (Notion 이 브라우저를 여기로 보낸다) → 토큰 교환·암호화 저장 → 앱으로 돌아감
//  POST { action: "authorize" }     : 로그인 사용자용 인가 URL (state 1회용, 10분)
//  POST { action: "status" | "disconnect" | "search" | "export" }
// 토큰은 AES-GCM 으로 암호화해 notion_connections 에 저장한다 (앱은 이 테이블을 읽을 수 없다). 로그에 토큰을 남기지 않는다.
// 배포: npx supabase functions deploy notion --no-verify-jwt   (콜백은 JWT 없이 온다. 나머지는 함수 안에서 JWT 를 검사)
import { cors, HttpError, json, ok, serviceClient, userClient } from "../_shared/http.ts";
import { buildDocument, periodText } from "../_shared/portfolio/document.ts";
import { toNotionBlocks } from "../_shared/portfolio/notionBlocks.ts";
import { exportKey, runExport, type ExportJob } from "../_shared/portfolio/notionExport.ts";
import { rowToEvidence, rowToOutcome, rowToProject, rowToReview, rowToVerification } from "../_shared/portfolio/rows.ts";
import type { PortfolioContent } from "../_shared/portfolio/types.ts";

const NOTION_VERSION = "2026-03-11";
const API = "https://api.notion.com/v1";
const CLIENT_ID = Deno.env.get("NOTION_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("NOTION_CLIENT_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("NOTION_REDIRECT_URI") ?? "";
const TOKEN_KEY = Deno.env.get("NOTION_TOKEN_KEY") ?? "";          // base64 32바이트
const APP_ORIGINS = (Deno.env.get("APP_ORIGINS") ?? "http://localhost:3000").split(",").map((s) => s.trim()).filter(Boolean);
const configured = () => !!(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI && TOKEN_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname.endsWith("/callback")) return await callback(url);
    if (req.method !== "POST") throw new HttpError(405, "지원하지 않는 요청이에요");
    const { db, userId } = await userClient(req);
    const body = await req.json().catch(() => ({}));
    if (!configured() && body.action !== "status") throw new HttpError(503, "서버에 Notion 연동 설정(NOTION_CLIENT_ID 등)이 없어요");
    switch (body.action) {
      case "status": return json(await status(userId));
      case "authorize": return json(await authorize(userId, String(body.returnTo ?? "")));
      case "disconnect": {
        const svc = serviceClient();
        const states = await svc.from("notion_oauth_states").delete().eq("user_id", userId);
        const connection = await svc.from("notion_connections").delete().eq("user_id", userId);
        if (states.error || connection.error) throw new HttpError(500, "연결 해제에 실패했어요. 다시 확인해 주세요");
        return json({ ok: true });
      }
      case "search": return json(await search(userId, String(body.query ?? "")));
      case "cancelPrepared": {
        const removed = await serviceClient().from("notion_exports").delete().eq("id", String(body.jobId ?? "")).eq("user_id", userId).in("status", ["READY", "FAILED"]).is("notion_page_id", null).is("pending_action", null).select("id").maybeSingle();
        if (removed.error || !removed.data) throw new HttpError(409, "이미 저장을 시작한 작업은 취소할 수 없어요. 저장 기록을 확인해 주세요.");
        return json({ ok: true });
      }
      case "prepare": return json(await prepareExport(db, userId, String(body.editId ?? ""), body.parentPageId ? String(body.parentPageId) : null, body.requestId ? String(body.requestId) : undefined));
      case "export": return json(await exportPage(userId, String(body.jobId ?? "")));
      default: throw new HttpError(400, "알 수 없는 요청이에요");
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, code: (e as HttpError & { code?: string }).code }, e.status);
    console.error("notion: unexpected server failure");
    return json({ error: "Notion 처리 중 문제가 생겼어요" }, 500);
  }
});

// ── 토큰 암호화 (AES-GCM) ────────────────────────────────────────────────────
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let keyPromise: Promise<CryptoKey> | null = null;
const cryptoKey = () => (keyPromise ??= crypto.subtle.importKey("raw", unb64(TOKEN_KEY), "AES-GCM", false, ["encrypt", "decrypt"]));
async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cryptoKey(), new TextEncoder().encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}
async function decrypt(enc: string) {
  const [iv, ct] = enc.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await cryptoKey(), unb64(ct)));
}

// ── OAuth ───────────────────────────────────────────────────────────────────
async function authorize(userId: string, returnTo: string) {
  let origin = "";
  try { origin = new URL(returnTo).origin; } catch { /* 아래에서 거부 */ }
  if (!APP_ORIGINS.includes(origin)) throw new HttpError(400, `허용되지 않은 앱 주소예요 (${origin || returnTo}). 서버 APP_ORIGINS 에 추가해 주세요`);
  const state = b64(crypto.getRandomValues(new Uint8Array(24))).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]!));
  const svc = serviceClient();
  await svc.from("notion_oauth_states").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
  ok(await svc.from("notion_oauth_states").insert({ state, user_id: userId, return_to: returnTo }).select().single());
  const q = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: "code", owner: "user", state });
  return { url: `${API}/oauth/authorize?${q}` };
}

function backTo(returnTo: string, result: string, message?: string) {
  const u = new URL(returnTo);
  u.searchParams.set("notion", result);
  if (message) u.searchParams.set("notion_msg", message);
  return new Response(null, { status: 302, headers: { Location: u.toString() } });
}

async function callback(url: URL) {
  const state = url.searchParams.get("state") ?? "";
  const svc = serviceClient();
  // Atomic consumption: two callbacks cannot redeem the same state concurrently.
  const { data: st, error: stateError } = await svc.from("notion_oauth_states").delete().eq("state", state).select("*").maybeSingle();
  if (stateError) return new Response("연결 상태를 확인하지 못했어요. 다시 시도해 주세요.", { status: 503 });
  if (!st) return new Response("만료되었거나 잘못된 요청이에요. 앱에서 다시 시도해 주세요.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (Date.now() - Date.parse(st.created_at) > 10 * 60_000) return backTo(st.return_to, "error", "연결 시간이 지났어요. 다시 시도해 주세요");
  const err = url.searchParams.get("error");
  if (err) return backTo(st.return_to, err === "access_denied" ? "cancelled" : "error", err === "access_denied" ? undefined : err);
  const code = url.searchParams.get("code");
  if (!code) return backTo(st.return_to, "error", "인가 코드가 없어요");

  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
    body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
  });
  if (!r.ok) { console.error("notion token exchange", r.status); return backTo(st.return_to, "error", "Notion 연결에 실패했어요"); }
  const t = await r.json();
  const previous = await svc.from("notion_connections").select("connection_id, workspace_id, bot_id").eq("user_id", st.user_id).maybeSingle();
  if (previous.error) return backTo(st.return_to, "error", "이전 연결을 확인하지 못했어요. 다시 시도해 주세요.");
  const connectionId = previous.data && previous.data.workspace_id === t.workspace_id && previous.data.bot_id === t.bot_id ? previous.data.connection_id : crypto.randomUUID();
  const { error } = await svc.from("notion_connections").upsert({
    user_id: st.user_id, access_token_enc: await encrypt(t.access_token), refresh_token_enc: t.refresh_token ? await encrypt(t.refresh_token) : null,
    connection_id: connectionId, bot_id: t.bot_id, workspace_id: t.workspace_id, workspace_name: t.workspace_name ?? null, workspace_icon: t.workspace_icon ?? null, updated_at: new Date().toISOString(),
  });
  if (error) { console.error("notion save connection", error.message); return backTo(st.return_to, "error", "연결 정보를 저장하지 못했어요"); }
  return backTo(st.return_to, "connected");
}

async function status(userId: string) {
  if (!configured()) return { configured: false, connected: false };
  const { data, error } = await serviceClient().from("notion_connections").select("workspace_name, workspace_icon, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, "연결 상태를 확인하지 못했어요");
  return { configured: true, connected: !!data, workspaceName: data?.workspace_name ?? null, workspaceIcon: data?.workspace_icon ?? null };
}

// ── Notion API 호출 (429 재시도, 401 이면 토큰 갱신 1회) ─────────────────────────
class NotionError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }

async function notionClient(userId: string) {
  const svc = serviceClient();
  const { data: c } = await svc.from("notion_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!c) throw Object.assign(new HttpError(400, "Notion 계정을 먼저 연결해 주세요"), { code: "NOT_CONNECTED" });
  let token = await decrypt(c.access_token_enc);
  let refreshed = false;
  async function refresh() {
    if (refreshed || !c.refresh_token_enc) return false;
    refreshed = true;
    const r = await fetch(`${API}/oauth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`, "Content-Type": "application/json", "Notion-Version": NOTION_VERSION },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: await decrypt(c.refresh_token_enc) }),
    });
    if (!r.ok) return false;
    const t = await r.json();
    token = t.access_token;
    const saved = await svc.from("notion_connections").update({ access_token_enc: await encrypt(t.access_token), refresh_token_enc: t.refresh_token ? await encrypt(t.refresh_token) : c.refresh_token_enc, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("connection_id", c.connection_id).select("user_id").single();
    if (saved.error || !saved.data) throw new HttpError(503, "갱신한 연결 정보를 보존하지 못했어요. 다시 연결해 주세요");
    return true;
  }
  async function call(method: string, path: string, body?: unknown, attempt = 0): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const current = await svc.from("notion_connections").select("connection_id").eq("user_id", userId).maybeSingle();
    if (current.error || current.data?.connection_id !== c.connection_id) throw new NotionError(401, "connection_changed", "연결이 변경되었어요");
    const r = await fetch(`${API}${path}`, {
      signal: AbortSignal.timeout(25_000),
      method, headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 429 && attempt < 3) {
      const seconds = Math.max(1, Number(r.headers.get("Retry-After") ?? "1") || 1);
      if (seconds > 10) throw new NotionError(429, "rate_limited", "잠시 후 다시 시도해 주세요");
      const wait = seconds * 1000 + Math.random() * 300;
      await new Promise((res) => setTimeout(res, wait));
      return call(method, path, body, attempt + 1);
    }
    if (r.status === 401 && await refresh()) return call(method, path, body, attempt);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new NotionError(r.status, data.code ?? "unknown", data.message ?? `Notion 오류 ${r.status}`);
    return data;
  }
  return call;
}

function explain(e: NotionError): string {
  if (e.status === 401) return "Notion 연결이 만료됐어요. 다시 연결해 주세요";
  if (e.status === 403 || e.code === "restricted_resource") return "그 페이지에 쓸 권한이 없어요. Notion 연결 화면에서 저장할 페이지를 공유해 주세요";
  if (e.status === 404 || e.code === "object_not_found") return "저장 위치를 찾을 수 없어요. 연결할 때 그 페이지를 공유했는지 확인해 주세요";
  if (e.status === 429) return "Notion 요청이 많아요. 잠시 후 다시 시도해 주세요";
  if (e.code === "validation_error") return `Notion 이 내용을 거부했어요: ${e.message}`;
  return "Notion 에 저장하지 못했어요. 잠시 후 다시 시도해 주세요";
}

async function search(userId: string, query: string) {
  const call = await notionClient(userId);
  try {
    const d = await call("POST", "/search", { query: query.slice(0, 100), filter: { property: "object", value: "page" }, sort: { timestamp: "last_edited_time", direction: "descending" }, page_size: 20 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pages = (d.results ?? []).filter((p: any) => !p.in_trash && !p.archived).map((p: any) => {
      const titleProp = Object.values(p.properties ?? {}).find((x: any) => x?.type === "title") as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const title = (titleProp?.title ?? []).map((t: any) => t.plain_text).join("") || "제목 없음"; // eslint-disable-line @typescript-eslint/no-explicit-any
      return { id: p.id, title, url: p.url, icon: p.icon?.type === "emoji" ? p.icon.emoji : null };
    });
    return { pages };
  } catch (e) {
    if (e instanceof NotionError) throw new HttpError(e.status === 401 ? 401 : 502, explain(e));
    throw e;
  }
}

// Prepare freezes the server-built document; only export actually writes to Notion.
async function prepareExport(db: Awaited<ReturnType<typeof userClient>>["db"], userId: string, editId: string, parentPageId: string | null, requestId?: string) {
  if (parentPageId && !/^[0-9a-f-]{32,36}$/i.test(parentPageId)) throw new HttpError(400, "올바른 저장 위치를 골라 주세요");
  const edit = ok(await db.from("portfolio_edits").select("*").eq("id", editId).maybeSingle());
  if (edit.student_id !== userId) throw new HttpError(403, "본인 포트폴리오만 저장할 수 있어요");
  const svc = serviceClient();
  const connection = ok(await svc.from("notion_connections").select("connection_id").eq("user_id", userId).maybeSingle());
  let key: string;
  try { key = exportKey(userId, editId, requestId); } catch { throw new HttpError(400, "잘못된 저장 요청 ID예요"); }
  const prior = await svc.from("notion_exports").select("*").eq("idempotency_key", key).maybeSingle();
  if (prior.error) throw new HttpError(500, "저장 기록을 확인하지 못했어요");
  if (prior.data) return publicJob(prior.data);
  if (!requestId) {
    const legacy = await svc.from("notion_exports").select("*").eq("user_id", userId).eq("idempotency_key", `edit:${editId}`).maybeSingle();
    if (legacy.error) throw new HttpError(500, "이전 저장 기록을 확인하지 못했어요");
    if (legacy.data) return publicJob(legacy.data);
  }
  const outstanding = await svc.from("notion_exports").select("*").eq("user_id", userId).eq("portfolio_version_id", editId).in("status", ["READY", "PENDING", "UNKNOWN", "FAILED", "PARTIAL"]).order("created_at", { ascending: false });
  if (outstanding.error) throw new HttpError(500, "저장 기록을 확인하지 못했어요");
  const unfinished = (outstanding.data ?? []).find(r => r.status !== "PARTIAL" || r.next_index < r.blocks.length);
  if (unfinished) return publicJob(unfinished); // Includes retries after reload and uncertain legacy jobs.
    // 문서 재료: 학생 편집본 + 잠긴 원본(검증·평가·증빙·성과)은 DB 에서 직접 읽는다
    const p = ok(await svc.from("projects").select("*, post:posts(*)").eq("id", edit.project_id).single());
    const project = rowToProject(p);
    const [verification, review, evidence, outcomes, client, versions, member] = await Promise.all([
      svc.from("client_verifications").select("*").eq("project_id", project.id).maybeSingle(),
      svc.from("client_reviews").select("*").eq("project_id", project.id).maybeSingle(),
      svc.from("evidence").select("*").eq("project_id", project.id).order("created_at"),
      svc.from("outcomes").select("*").eq("project_id", project.id),
      svc.from("profiles").select("name, kind").eq("id", project.ownerId).single(),
      svc.from("submission_versions").select("id, version").eq("project_id", project.id),
      svc.from("project_members").select("role_label").eq("project_id", project.id).eq("student_id", userId).single(),
    ]);
    for (const response of [verification, review, evidence, outcomes, client, versions, member]) {
      if (response.error) throw new HttpError(500, "원본 자료를 불러오지 못했어요. 저장하지 않았습니다.");
    }
    const content = edit.content as PortfolioContent;
    const approved = (versions.data ?? []).find((v: { id: string }) => v.id === project.approvedVersionId);
    const doc = buildDocument({
      domain: project.domain, content,
      info: { period: periodText(project.startedAt ?? project.createdAt, project.completedAt), roleLabel: member.data?.role_label ?? "", clientName: client.data?.name ?? "의뢰인", clientType: client.data?.kind ?? "주민", approvedVersion: approved?.version ?? null },
      verification: verification.data ? rowToVerification(verification.data) : null, review: review.data ? rowToReview(review.data) : null,
      evidence: (evidence.data ?? []).map(rowToEvidence), outcomes: (outcomes.data ?? []).map(rowToOutcome),
    });

    const built = toNotionBlocks(doc, content.summary);
    if (built.blocks.length > 1000 || JSON.stringify(built.blocks).length > 400_000) throw new HttpError(400, "문서가 너무 커요. 내용을 줄여 주세요.");
    const ins = await svc.from("notion_exports").insert({
      user_id: userId, portfolio_version_id: editId, idempotency_key: key,
      parent_page_id: parentPageId, connection_id: connection.connection_id,
      title: content.title, blocks: built.blocks, failed_attachments: built.failed, status: "READY",
    }).select("*").single();
    if (ins.error) {
      // A competing prepare may have reserved the edit. No remote write happened.
      throw new HttpError(409, "다른 저장 요청이 먼저 준비됐어요. 저장 기록을 새로고침해 주세요.");
    }
    return publicJob(ins.data);
}

// Do not expose encrypted credentials or the private frozen payload through status results.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function publicJob(row: any) {
  return { id: row.id, status: row.status, title: row.title, parentPageId: row.parent_page_id,
    url: row.notion_page_url, failedAttachments: row.failed_attachments ?? [],
    nextIndex: row.next_index, totalBlocks: row.blocks?.length ?? 0, error: row.error,
    blocks: row.blocks ?? [] };
}

async function exportPage(userId: string, jobId: string) {
  const svc = serviceClient();
  const row = ok(await svc.from("notion_exports").select("*").eq("id", jobId).eq("user_id", userId).maybeSingle());
  if (row.status === "SUCCEEDED" || (row.status === "PARTIAL" && row.next_index >= row.blocks.length)) return publicJob(row);
  const connection = ok(await svc.from("notion_connections").select("connection_id").eq("user_id", userId).maybeSingle());
  if (row.connection_id !== connection.connection_id) throw new HttpError(409, "저장을 준비한 Notion 연결과 현재 연결이 달라요. 자동으로 다른 계정에 저장하지 않습니다. 기존 작업을 확인해 주세요.");
  if (row.pending_action || row.status === "UNKNOWN") throw new HttpError(409, "이전 저장 결과가 불확실해요. 중복 생성을 막기 위해 자동 재시도를 중단했어요. 저장 기록과 Notion 페이지를 확인해 주세요.");
  const call = await notionClient(userId);
  const claimed = ok(await svc.rpc("claim_notion_export", { job_id: jobId, owner_id: userId }));
  if (!claimed.length) throw new HttpError(409, "이미 저장 중이거나 완료된 요청이에요. 저장 기록을 새로고침해 주세요.");
  const job = await runExport(claimed[0] as ExportJob, {
    checkpoint: async patch => {
      const saved = await svc.from("notion_exports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", jobId).eq("user_id", userId).select("id").single();
      if (saved.error || !saved.data) throw new HttpError(503, "저장 진행 기록을 보존하지 못했어요. 생성 여부를 확인하기 전에는 새 페이지를 만들지 않습니다.");
    },
    create: async (parent, title, blocks) => call("POST", "/pages", {
      ...(parent ? { parent: { type: "page_id", page_id: parent } } : {}),
      properties: { title: { title: [{ type: "text", text: { content: title.slice(0, 200) || "포트폴리오" } }] } },
      children: blocks,
    }),
    append: async (page, blocks) => { await call("PATCH", "/blocks/" + page + "/children", { children: blocks, position: { type: "end" } }); },
  });
  return publicJob(job);
}
