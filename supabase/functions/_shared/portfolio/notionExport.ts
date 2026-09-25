import type { FailedAttachment, NotionBlock } from "./notionBlocks.ts";

export type ExportStatus = "READY" | "PENDING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "UNKNOWN";
export interface ExportJob {
  id: string;
  status: ExportStatus;
  title: string;
  parent_page_id: string | null;
  blocks: NotionBlock[];
  next_index: number;
  notion_page_id: string | null;
  notion_page_url: string | null;
  pending_action: string | null;
  failed_attachments: FailedAttachment[];
  error: string | null;
}
export type ExportPatch = Partial<ExportJob>;
export interface ExportIO {
  /** Must persist or throw. Never report success on an unchecked DB response. */
  checkpoint(patch: ExportPatch): Promise<void>;
  create(parent: string | null, title: string, blocks: NotionBlock[]): Promise<{ id: string; url: string }>;
  append(page: string, blocks: NotionBlock[]): Promise<void>;
}

export function exportKey(userId: string, editId: string, requestId?: string): string {
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new Error("잘못된 저장 요청 ID예요");
  return `${userId}:edit:${editId}${requestId ? `:new:${requestId}` : ""}`;
}

/** Caller obtains an atomic DB claim first. No time-based takeover of uncertain writes. */
export async function runExport(input: ExportJob, io: ExportIO): Promise<ExportJob> {
  const job = { ...input };
  if (job.pending_action || job.status === "UNKNOWN") throw new Error("이전 저장 결과를 확인해야 해요. 중복 생성을 막기 위해 자동 재시도를 중단했어요.");
  async function save(patch: ExportPatch) { await io.checkpoint(patch); Object.assign(job, patch); }
  async function failed(e: unknown) {
    const status = (e as { status?: number })?.status;
    // Network errors, 5xx and timeouts can mean the write succeeded but the response was lost.
    const rejected = [400, 401, 403, 404, 413, 422, 429].includes(status ?? 0);
    await save({
      status: rejected ? (job.notion_page_id ? "PARTIAL" : "FAILED") : "UNKNOWN",
      pending_action: rejected ? null : job.pending_action,
      error: rejected ? "Notion이 저장 요청을 거부했어요. 권한·내용·연결 상태를 확인한 뒤 같은 작업을 재시도하세요."
        : "응답이 끊겨 저장 여부가 불확실해요. 새 페이지를 만들지 않습니다. Notion에서 결과를 확인하고 관리자에게 복구를 요청해 주세요.",
    });
    return job;
  }
  if (!job.notion_page_id) {
    await save({ status: "PENDING", pending_action: "create", error: null });
    let page: { id: string; url: string };
    try {
      page = await io.create(job.parent_page_id, job.title, job.blocks.slice(0, 100));
      if (!page.id || !/^https:\/\//.test(page.url)) throw new Error("Invalid Notion response");
    } catch (e) { return failed(e); }
    // If this write fails, leave the durable 'create' marker. Never issue POST /pages again.
    await save({ notion_page_id: page.id, notion_page_url: page.url, next_index: Math.min(100, job.blocks.length), pending_action: null });
  }
  while (job.next_index < job.blocks.length) {
    const end = Math.min(job.next_index + 100, job.blocks.length);
    await save({ status: "PENDING", pending_action: `append:${job.next_index}:${end}`, error: null });
    try { await io.append(job.notion_page_id!, job.blocks.slice(job.next_index, end)); }
    catch (e) { return failed(e); }
    await save({ next_index: end, pending_action: null });
  }
  await save({ status: job.failed_attachments.length ? "PARTIAL" : "SUCCEEDED", error: null });
  return job;
}
