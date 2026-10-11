import type { Category, RoleSlot } from "@/types";
import { supabase } from "../supabase";
import { cannedAi, cannedPause, cannedPostDraft } from "./demo";

/**
 * 사장님이 대충 적은 고민 → 공고 초안 (Gemini).
 * 사장님은 문제는 알아도 "무슨 재능(어느 과)이 필요한지"는 모르는 경우가 많아서, 필요한 재능·결과물·기간을 유추해 채워 준다.
 * 초안은 등록 폼을 미리 채울 뿐이고, 사장님이 확인·수정한 뒤 등록한다.
 * AI 호출은 Gemini 키를 숨기기 위해 Supabase Edge Function(supabase/functions/draft-post)에서 한다.
 */
export interface PostDraft {
  title: string;
  category: Category;          // 대표 카테고리
  description: string;
  deliverables: string[];      // 결과물
  departments: string[];       // 추천 학과
  durationDays: number;
  difficulty: 1 | 2 | 3;
  isTeam: boolean;
  teamSlots?: RoleSlot[];
  reward?: string;
  reasons: string[];           // 왜 이렇게 판단했는지 (사장님에게 보여 준다)
}

export async function draftPost(text: string): Promise<PostDraft> {
  if (cannedAi()) { await cannedPause(); return cannedPostDraft(text); }   // 체험 중에는 준비된 답 (Gemini 대기 없음)
  if (!supabase) throw new Error("AI 초안은 서버(Supabase)를 연결하면 쓸 수 있어요");
  const { data, error } = await supabase.functions.invoke<PostDraft>("draft-post", { body: { text } });
  if (error) {
    // 서버가 보낸 한국어 에러 메시지를 꺼낸다
    const msg = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new Error(msg ?? "AI 초안을 만들지 못했어요");
  }
  return data!;
}
