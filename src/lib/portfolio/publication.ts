import type { PublishedPortfolio } from "@/types";
import type { Repo } from "../repo";

/**
 * 피드 카드에 쓰는 글 사본만 만든다 (프로젝트 묶음이나 증빙은 복사하지 않는다).
 * 프로젝트 작업의 전체 페이지(검증·평가·증빙 포함)는 공개 중일 때만 get_public_portfolio(0033)로 읽는다.
 */
export async function publicationFromSource(repo: Repo, studentId: string, sourceId: string, sourceKind: PublishedPortfolio["sourceKind"]): Promise<PublishedPortfolio> {
  const base = { studentId, sourceId, sourceKind, publishedAt: new Date().toISOString() };
  if (sourceKind === "project") {
    const doc = (await repo.listPortfolioDocs(studentId)).find(d => d.project.id === sourceId);
    if (!doc) throw new Error("내가 저장한 포트폴리오만 공개할 수 있어요.");
    const { title, summary, sections } = doc.edit.content;
    return { ...base, title, summary, category: doc.post.category, sections: sections.map(({ title, body }) => ({ title, body })) };
  }
  const card = (await repo.listPortfolio(studentId)).find(c => c.id === sourceId);
  if (!card) throw new Error("내 활동 기록만 공개할 수 있어요.");
  return { ...base, title: card.title, summary: card.roleLabel, category: "활동 기록", sections: [{ title: "담당한 작업", body: card.tasks.join("\n") }, { title: "활동 기간", body: `${card.durationDays}일` }] };
}
