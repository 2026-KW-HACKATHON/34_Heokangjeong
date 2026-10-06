import type { PortfolioCard, Post, RankRow, User } from "@/types";

export function individualRanking(users: User[], cards: PortfolioCard[], posts: Post[]): RankRow[] {
  return users.filter(u => u.role === "student").map(s => {
    const mine = cards.filter(c => c.studentId === s.id);
    const avg = mine.length ? mine.reduce((sum, c) => sum + c.rating, 0) / mine.length : 0;
    const difficulty = mine.reduce((sum, c) => sum + (posts.find(p => p.id === c.postId)?.difficulty ?? 0), 0);
    return { id: s.id, label: s.name, sub: s.role === "student" ? s.department : "", solved: mine.length, score: mine.length * 10 + Math.round(avg * 4) + difficulty * 3 };
  }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function rememberBestRanks(rows: RankRow[], previous: Record<string, number>): Record<string, number> {
  const next = { ...previous };
  rows.forEach((row, index) => { next[row.id] = Math.min(next[row.id] ?? index + 1, index + 1); });
  return next;
}
