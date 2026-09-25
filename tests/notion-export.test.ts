import { describe, expect, it, vi } from "vitest";
import { exportKey, runExport, type ExportIO, type ExportJob } from "@shared/portfolio/notionExport";
import { publicUrlProblem } from "@shared/portfolio/notionBlocks";

function fixture(count = 210) {
  const job: ExportJob = { id: "job", title: "실제 입력", status: "PENDING", parent_page_id: "parent", blocks: Array.from({length: count}, (_, i) => ({type: "paragraph", paragraph: {rich_text: [{text: {content: String(i)}}]}})), next_index: 0, notion_page_id: null, notion_page_url: null, pending_action: null, failed_attachments: [], error: null };
  const io: ExportIO = {
    checkpoint: vi.fn(async patch => { Object.assign(job, structuredClone(patch)); }),
    create: vi.fn(async () => ({ id: "page-1", url: "https://notion.so/page-1" })),
    append: vi.fn(async () => {}),
  };
  return {job, io};
}
describe("Notion durable export (mock API, no external requests)", () => {
  it("rejects local, private, temporary and credential-bearing attachment URLs", () => {
    for (const url of ["http://172.16.0.1/a", "http://169.254.169.254/a", "http://127.1/a", "http://[::1]/a", "http://[::ffff:127.0.0.1]/a", "https://user:password@example.com/a", "blob:https://example.com/a", "http://foo.localhost/a"])
      expect(publicUrlProblem(url)).not.toBeNull();
    expect(publicUrlProblem("https://example.com/photo.png")).toBeNull();
  });
  it("checkpoints the page ID before appending and only completes after all blocks", async () => {
    const {job, io} = fixture();
    io.append = vi.fn(async () => { expect(job.notion_page_id).toBe("page-1"); expect(job.pending_action).toMatch(/^append:/); });
    const result = await runExport(job, io);
    expect(result.status).toBe("SUCCEEDED"); expect(job.next_index).toBe(210);
    expect(io.create).toHaveBeenCalledTimes(1); expect(io.append).toHaveBeenCalledTimes(2);
    expect(job.pending_action).toBeNull();
  });
  it("known append rejection keeps the page and resumes without another create", async () => {
    const {job, io} = fixture();
    io.append = vi.fn().mockRejectedValueOnce({status:403}).mockResolvedValue(undefined);
    const first = await runExport(job, io);
    expect(first.status).toBe("PARTIAL"); expect(job.next_index).toBe(100); expect(job.notion_page_id).toBe("page-1");
    await runExport(job, io);
    expect(job.status).toBe("SUCCEEDED"); expect(io.create).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, 500, 502, 504, 409])("uncertain create (%s) never retries blindly", async status => {
    const {job, io} = fixture(); io.create = vi.fn().mockRejectedValue({status});
    await runExport(job, io); expect(job.status).toBe("UNKNOWN"); expect(job.pending_action).toBe("create");
    await expect(runExport(job, io)).rejects.toThrow("확인"); expect(io.create).toHaveBeenCalledTimes(1);
  });
  it("unknown append preserves page URL and prevents duplicated blocks", async () => {
    const {job, io} = fixture(); io.append = vi.fn().mockRejectedValue(new Error("network"));
    await runExport(job, io); expect(job.status).toBe("UNKNOWN"); expect(job.notion_page_url).toBeTruthy();
    await expect(runExport(job, io)).rejects.toThrow(); expect(io.append).toHaveBeenCalledTimes(1);
  });
  it("DB failure after remote create keeps write-ahead marker; no false success", async () => {
    const {job, io} = fixture();
    io.checkpoint = vi.fn(async patch => { if (patch.notion_page_id) throw new Error("DB unavailable"); Object.assign(job, patch); });
    await expect(runExport(job, io)).rejects.toThrow("DB unavailable");
    expect(job.pending_action).toBe("create"); await expect(runExport(job, io)).rejects.toThrow(); expect(io.create).toHaveBeenCalledTimes(1);
  });
  it("DB failure before remote call sends nothing", async () => {
    const {job, io} = fixture(); io.checkpoint = vi.fn().mockRejectedValue(new Error("DB"));
    await expect(runExport(job, io)).rejects.toThrow(); expect(io.create).not.toHaveBeenCalled();
  });
  it("failed attachments remain PARTIAL, not full success", async () => {
    const {job, io} = fixture(1); job.failed_attachments = [{evidenceId:"e1",reason:"비공개 링크"}];
    await runExport(job, io); expect(job.status).toBe("PARTIAL"); expect(job.next_index).toBe(1);
  });
  it("new-version keys are stable for retries and scoped to owner", () => {
    const req = "12345678-1234-4123-8123-123456789012";
    expect(exportKey("u1","edit",req)).toBe(exportKey("u1","edit",req));
    expect(exportKey("u1","edit",req)).not.toBe(exportKey("u2","edit",req));
    expect(() => exportKey("u","e","bad")).toThrow();
  });
});
