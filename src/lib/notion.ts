import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Notion 연동 (서버 함수 supabase/functions/notion 호출). 토큰은 서버에만 있고 앱은 결과만 받는다.
 * 가짜 데이터(mock) 모드에는 서버가 없어서 쓸 수 없다.
 */
export interface NotionStatus { configured: boolean; connected: boolean; workspaceName?: string | null; workspaceIcon?: string | null }
export interface NotionPage { id: string; title: string; url: string; icon: string | null }
export interface NotionExportResult { existing: boolean; status: "SUCCEEDED" | "PARTIAL"; url: string; failedAttachments: { evidenceId: string; reason: string }[] }

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

export const notionAvailable = !!supabase;
export const notion = {
  status: () => call<NotionStatus>("status"),
  /** Notion 인가 화면으로 이동. 끝나면 returnTo 로 ?notion=connected|cancelled|error 가 붙어 돌아온다 */
  async connect(returnTo: string) { const { url } = await call<{ url: string }>("authorize", { returnTo }); window.location.href = url; },
  disconnect: () => call<{ ok: true }>("disconnect"),
  search: (query: string) => call<{ pages: NotionPage[] }>("search", { query }).then((r) => r.pages),
  exportPage: (editId: string, parentPageId: string | null, forceNew = false) => call<NotionExportResult>("export", { editId, parentPageId, forceNew }),
};
