// Notion 연동 (Supabase Edge Function, Deno). 포트폴리오를 사용자의 Notion 에 실제 페이지로 저장한다.
//  GET  /notion/callback           : OAuth 콜백 (Notion 이 브라우저를 여기로 보낸다) → 토큰 교환·암호화 저장 → 앱으로 돌아감
//  POST { action: "authorize" }     : 로그인 사용자용 인가 URL (state 1회용, 10분)
//  POST { action: "status" | "disconnect" | "search" | "export" }
// 토큰은 AES-GCM 으로 암호화해 notion_connections 에 저장한다 (앱은 이 테이블을 읽을 수 없다). 로그에 토큰을 남기지 않는다.
// 배포: npx supabase functions deploy notion --no-verify-jwt   (콜백은 JWT 없이 온다. 나머지는 함수 안에서 JWT 를 검사)
import { cors, HttpError, json, ok, serviceClient, userClient } from "../_shared/http.ts";
import { buildDocument, periodText } from "../_shared/portfolio/document.ts";
import { toNotionBlocks, type FailedAttachment, type NotionBlock } from "../_shared/portfolio/notionBlocks.ts";
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
      case "disconnect": await serviceClient().from("notion_connections").delete().eq("user_id", userId); return json({ ok: true });
      case "search": return json(await search(userId, String(body.query ?? "")));
      case "export": return json(await exportPage(db, userId, String(body.editId ?? ""), body.parentPageId ? String(body.parentPageId) : null, !!body.forceNew));
      default: throw new HttpError(400, "알 수 없는 요청이에요");
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message, code: (e as HttpError & { code?: string }).code }, e.status);
    console.error("notion", (e as Error).message);
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
  const { data: st } = await svc.from("notion_oauth_states").select("*").eq("state", state).maybeSingle();
  if (!st) return new Response("만료되었거나 잘못된 요청이에요. 앱에서 다시 시도해 주세요.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  await svc.from("notion_oauth_states").delete().eq("state", state);           // 1회용
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
  const { error } = await svc.from("notion_connections").upsert({
    user_id: st.user_id, access_token_enc: await encrypt(t.access_token), refresh_token_enc: t.refresh_token ? await encrypt(t.refresh_token) : null,
    bot_id: t.bot_id, workspace_id: t.workspace_id, workspace_name: t.workspace_name ?? null, workspace_icon: t.workspace_icon ?? null, updated_at: new Date().toISOString(),
  });
  if (error) { console.error("notion save connection", error.message); return backTo(st.return_to, "error", "연결 정보를 저장하지 못했어요"); }
  return backTo(st.return_to, "connected");
}

async function status(userId: string) {
  if (!configured()) return { configured: false, connected: false };
  const { data } = await serviceClient().from("notion_connections").select("workspace_name, workspace_icon, updated_at").eq("user_id", userId).maybeSingle();
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
    await svc.from("notion_connections").update({ access_token_enc: await encrypt(t.access_token), refresh_token_enc: t.refresh_token ? await encrypt(t.refresh_token) : c.refresh_token_enc, updated_at: new Date().toISOString() }).eq("user_id", userId);
    return true;
  }
  async function call(method: string, path: string, body?: unknown, attempt = 0): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = await fetch(`${API}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 429 && attempt < 3) {
      const wait = Math.min(10, Number(r.headers.get("Retry-After") ?? "1") || 1) * 1000 + Math.random() * 300;
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

// ── 저장 (멱등: 같은 편집본은 한 번만. forceNew 면 새 페이지) ─────────────────────
async function exportPage(db: Awaited<ReturnType<typeof userClient>>["db"], userId: string, editId: string, parentPageId: string | null, forceNew: boolean) {
  const edit = ok(await db.from("portfolio_edits").select("*").eq("id", editId).maybeSingle());
  if (edit.student_id !== userId) throw new HttpError(403, "본인 포트폴리오만 저장할 수 있어요");
  const svc = serviceClient();
  const key = forceNew ? `edit:${editId}:new:${crypto.randomUUID()}` : `edit:${editId}`;

  const { data: existing } = await svc.from("notion_exports").select("*").eq("idempotency_key", key).maybeSingle();
  if (existing && (existing.status === "SUCCEEDED" || existing.status === "PARTIAL"))
    return { existing: true, status: existing.status, url: existing.notion_page_url, failedAttachments: existing.failed_attachments };
  if (existing && existing.status === "PENDING" && Date.now() - Date.parse(existing.updated_at) < 120_000)
    throw new HttpError(409, "이미 저장 중이에요. 잠시 후 다시 확인해 주세요");
  let rowId: string;
  if (existing) {
    rowId = existing.id;
    await svc.from("notion_exports").update({ status: "PENDING", parent_page_id: parentPageId, error: null, updated_at: new Date().toISOString() }).eq("id", rowId);
  } else {
    const ins = await svc.from("notion_exports").insert({ user_id: userId, portfolio_version_id: editId, idempotency_key: key, parent_page_id: parentPageId, status: "PENDING" }).select("id").single();
    if (ins.error) throw new HttpError(409, "이미 저장 중이에요. 잠시 후 다시 확인해 주세요"); // 동시에 두 번 누른 경우 (unique 키)
    rowId = ins.data.id;
  }

  try {
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
    const content = edit.content as PortfolioContent;
    const approved = (versions.data ?? []).find((v: { id: string }) => v.id === project.approvedVersionId);
    const doc = buildDocument({
      domain: project.domain, content,
      info: { period: periodText(project.createdAt, project.completedAt), roleLabel: member.data?.role_label ?? "", clientName: client.data?.name ?? "의뢰인", clientType: client.data?.kind ?? "주민", approvedVersion: approved?.version ?? null },
      verification: verification.data ? rowToVerification(verification.data) : null, review: review.data ? rowToReview(review.data) : null,
      evidence: (evidence.data ?? []).map(rowToEvidence), outcomes: (outcomes.data ?? []).map(rowToOutcome),
    });
    const call = await notionClient(userId);
    let built = toNotionBlocks(doc, content.summary);
    let page;
    try {
      page = await createPage(call, parentPageId, content.title, built.blocks);
    } catch (e) {
      // Notion 이 외부 이미지를 거부하면 이미지를 링크로 바꿔 한 번 더 시도하고, 이미지들을 첨부 실패로 기록한다
      if (!(e instanceof NotionError && e.code === "validation_error" && /image|url/i.test(e.message))) throw e;
      const imgs = built.blocks.filter((b) => b.type === "image").length;
      built = toNotionBlocks(doc, content.summary, { imagesAsLinks: true });
      page = await createPage(call, parentPageId, content.title, built.blocks);
      if (imgs) built.failed.push({ evidenceId: "*", reason: `Notion 이 이미지 ${imgs}개를 불러오지 못해 링크로 넣었어요` });
    }
    const failed: FailedAttachment[] = built.failed;
    const status = failed.length ? "PARTIAL" : "SUCCEEDED";
    await svc.from("notion_exports").update({ status, notion_page_id: page.id, notion_page_url: page.url, failed_attachments: failed, updated_at: new Date().toISOString() }).eq("id", rowId);
    return { existing: false, status, url: page.url, failedAttachments: failed };
  } catch (e) {
    const msg = e instanceof NotionError ? explain(e) : e instanceof HttpError ? e.message : "Notion 에 저장하지 못했어요";
    await svc.from("notion_exports").update({ status: "FAILED", error: msg, updated_at: new Date().toISOString() }).eq("id", rowId);
    if (e instanceof HttpError) throw e;
    if (e instanceof NotionError) throw new HttpError(e.status === 401 ? 401 : 502, msg);
    throw e;
  }
}

/** 페이지 생성은 블록 100개까지 → 나머지는 100개씩 이어 붙인다 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createPage(call: (m: string, p: string, b?: unknown) => Promise<any>, parentPageId: string | null, title: string, blocks: NotionBlock[]) {
  const page = await call("POST", "/pages", {
    ...(parentPageId ? { parent: { type: "page_id", page_id: parentPageId } } : {}),   // 없으면 워크스페이스 최상위 비공개 페이지
    icon: { type: "emoji", emoji: "📁" },
    properties: { title: { title: [{ type: "text", text: { content: title.slice(0, 200) || "포트폴리오" } }] } },
    children: blocks.slice(0, 100),
  });
  for (let i = 100; i < blocks.length; i += 100) {
    await call("PATCH", `/blocks/${page.id}/children`, { children: blocks.slice(i, i + 100), position: { type: "end" } });
  }
  return page as { id: string; url: string };
}
