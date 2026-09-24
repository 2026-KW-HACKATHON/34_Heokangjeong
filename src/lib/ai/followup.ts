import type { DomainKey, QuestionDefinition } from "@/types";
import { needsFollowUp, ruleFollowUps } from "@shared/portfolio/followup";
import { supabase } from "../supabase";

export interface FollowUpSuggestion { questions: string[]; source: "AI" | "RULE" }

/**
 * Layer B 후속 질문. 답이 충분히 구체적이면 아무것도 제안하지 않는다.
 * 서버 AI(portfolio-ai) → 실패하거나 mock 이면 질문 정의의 규칙 기반 질문. 어느 쪽인지 화면에 표시한다.
 */
export async function suggestFollowUps(q: QuestionDefinition, answer: string, domain: DomainKey): Promise<FollowUpSuggestion> {
  if (!needsFollowUp(q, answer).needed) return { questions: [], source: "RULE" };
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke<{ questions: string[]; source: string }>("portfolio-ai", { body: { action: "followup", question: q.title, answer, domain } });
      if (!error && data?.source === "AI" && data.questions.length) return { questions: data.questions, source: "AI" };
    } catch { /* 규칙 기반으로 */ }
  }
  return { questions: ruleFollowUps(q), source: "RULE" };
}
