import type { Category, PortfolioCard, Post } from "@/types";

export interface WorkField {
  category: Category;
  count: number;
  averageRating: number | null;
  works: PortfolioCard[];
}

export function workFieldSummary(cards: PortfolioCard[], posts: Post[]) {
  const categories = new Map(posts.map(post => [post.id, post.category]));
  const verified = cards.filter(card => card.verified);
  const fields = new Map<Category, PortfolioCard[]>();
  for (const card of verified) {
    const category = categories.get(card.postId) ?? "기타";
    fields.set(category, [...(fields.get(category) ?? []), card]);
  }
  const average = (items: PortfolioCard[]) => {
    const rated = items.filter(card => Number.isFinite(card.rating) && card.rating >= 1 && card.rating <= 5);
    return rated.length ? Math.round(rated.reduce((sum, card) => sum + card.rating, 0) / rated.length * 10) / 10 : null;
  };
  const byField: WorkField[] = [...fields].map(([category, works]) => ({
    category, count: works.length, averageRating: average(works), works,
  })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "ko"));
  const mostFrequentCount = byField[0]?.count ?? 0;
  const mostFrequent = mostFrequentCount
    ? byField.filter(field => field.count === mostFrequentCount).map(field => field.category)
    : [];
  return {
    total: verified.length,
    averageRating: average(verified),
    mostFrequent,
    byField,
  };
}
