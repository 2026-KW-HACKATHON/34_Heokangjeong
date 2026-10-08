import type { PublishedPortfolio } from "@/types";

export const ARCHIVE_PUBLIC_LIMIT = 3;
export type FeedCollection = "experience" | "archive" | "portfolio";
export const feedCollection = (item: PublishedPortfolio): FeedCollection => item.sections[0]?.collection ?? "experience";
export const isArchive = (item: PublishedPortfolio) => item.sections[0]?.collection === "archive";
export function withFeedCollection(item: PublishedPortfolio, collection: FeedCollection): PublishedPortfolio {
  return { ...item, sections: item.sections.map((section, index) => {
    const { collection: previous, ...content } = section;
    void previous;
    return index === 0 && collection !== "experience" ? { ...content, collection } : content;
  }) };
}
export function assertArchiveCapacity(item: PublishedPortfolio, items: PublishedPortfolio[]) {
  if (!isArchive(item) || item.visible === false) return;
  const count = items.filter(other => other.studentId === item.studentId && other.visible !== false && isArchive(other)
    && !(other.sourceId === item.sourceId && other.sourceKind === item.sourceKind)).length;
  if (count >= ARCHIVE_PUBLIC_LIMIT) throw new Error("개인 아카이브는 최대 3개까지 공개할 수 있어요. 기존 기록을 비공개로 바꾼 뒤 다시 시도해 주세요.");
}
