import type { PublishedPortfolio } from "@/types";
import type { Repo } from "../repo";

/** Publish only the student's text, never a project bundle or private evidence. */
export async function publicationFromSource(repo: Repo, studentId: string, sourceId: string, sourceKind: PublishedPortfolio["sourceKind"]): Promise<PublishedPortfolio> {
  const base = { studentId, sourceId, sourceKind, publishedAt: new Date().toISOString() };
  if (sourceKind === "project") {
    const doc = (await repo.listPortfolioDocs(studentId)).find(d => d.project.id === sourceId);
    if (!doc) throw new Error("내가 저장한 포트폴리오만 공개할 수 있어요.");
    const { title, summary, sections } = doc.edit.content;
    return { ...base, title, summary, category: doc.post.category, sections: sections.map(({ title, body }) => ({ title, body })) };
  }
  if (sourceKind === "manual") throw new Error("직접 작성한 피드는 글쓰기 화면에서 올려 주세요.");
  const card = (await repo.listPortfolio(studentId)).find(c => c.id === sourceId);
  if (!card) throw new Error("내 활동 기록만 공개할 수 있어요.");
  return { ...base, title: card.title, summary: card.roleLabel, category: "활동 기록", sections: [{ title: "담당한 작업", body: card.tasks.join("\n") }, { title: "활동 기간", body: `${card.durationDays}일` }] };
}
