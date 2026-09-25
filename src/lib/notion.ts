import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { ExportStatus } from "@shared/portfolio/notionExport";
import type { NotionBlock } from "@shared/portfolio/notionBlocks";

/**
 * Notion 연동 (서버 함수 supabase/functions/notion 호출). 토큰은 서버에만 있고 앱은 결과만 받는다.
 * 가짜 데이터(mock) 모드에는 서버가 없어서 쓸 수 없다.
 */
export interface NotionStatus { configured: boolean; connected: boolean; workspaceName?: string | null; workspaceIcon?: string | null }
export interface NotionPage { id: string; title: string; url: string; icon: string | null }
export interface NotionExportResult { id: string; status: ExportStatus; title: string; parentPageId: string | null; url: string | null; blocks: NotionBlock[]; nextIndex: number; totalBlocks: number; error: string | null; failedAttachments: { evidenceId: string; reason: string }[] }

export class NotionCallError extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new NotionCallError("Notion 저장은 서버(Supabase)에 연결된 상태에서만 쓸 수 있어요", 0, "NO_SERVER");
  const { data, error } = await supabase.functions.invoke<T>("notion", { body: { action, ...payload } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => ({}));
      throw new NotionCallError(body.error ?? "Notion 요청에 실패했어요", error.context.status, body.code);
    }
    throw new NotionCallError("Notion 서버 함수에 연결하지 못했어요 (배포 여부를 확인해 주세요)", 0, "UNREACHABLE");
  }
  return data as T;
}

export interface NotionExportRow extends NotionExportResult { createdAt: string }
/** 이 편집본을 저장한 기록 (본인 것만 RLS 로 보인다) */
export async function listNotionExports(editId: string): Promise<NotionExportRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("notion_exports").select("*").eq("portfolio_version_id", editId).order("created_at", { ascending: false });
  if (error) throw new Error("Notion 저장 기록을 불러오지 못했어요. 새로 저장하기 전에 다시 확인해 주세요.");
  return (data ?? []).map((r) => ({ id: r.id, status: r.status, title: r.title, parentPageId: r.parent_page_id, blocks: r.blocks ?? [], nextIndex: r.next_index ?? 0, totalBlocks: r.blocks?.length ?? 0, url: r.notion_page_url, createdAt: r.created_at, failedAttachments: r.failed_attachments ?? [], error: r.error }));
}

export const notionAvailable = !!supabase;
export const notion = {
  status: () => call<NotionStatus>("status"),
  /** Notion 인가 화면으로 이동. 끝나면 returnTo 로 ?notion=connected|cancelled|error 가 붙어 돌아온다 */
  async connect(returnTo: string) { const { url } = await call<{ url: string }>("authorize", { returnTo }); window.location.href = url; },
  disconnect: () => call<{ ok: true }>("disconnect"),
  search: (query: string) => call<{ pages: NotionPage[] }>("search", { query }).then((r) => r.pages),
  prepare: (editId: string, parentPageId: string | null, requestId?: string) => call<NotionExportResult>("prepare", { editId, parentPageId, requestId }),
  exportPage: (jobId: string) => call<NotionExportResult>("export", { jobId }),
  cancelPrepared: (jobId: string) => call<{ok: boolean}>("cancelPrepared", { jobId }),
};
