import type { DomainKey, QuestionDefinition } from "@/types";
import { needsFollowUp, ruleFollowUps } from "@shared/portfolio/followup";
import { supabase } from "../supabase";

// AI 응답이 수십 초 걸릴 수 있어서, 화면은 규칙 기반 질문을 바로 보여 주고 AI 질문은 도착하면 바꿔 끼운다
const AI_TIMEOUT_MS = 30_000;

/** questions 와 examples 는 같은 순서. 예시가 없으면 빈 문자열 */
export interface FollowUpSuggestion { questions: string[]; examples: string[]; source: "AI" | "RULE" }

/**
 * Layer B 후속 질문. 답이 충분히 구체적이면 아무것도 제안하지 않는다.
 * rule: 질문 정의의 규칙 기반 질문 (즉시). ai: 서버 AI(portfolio-ai) 질문 (나중에 도착, 실패·mock 이면 null)
 */
export function suggestFollowUps(q: QuestionDefinition, answer: string, domain: DomainKey): { rule: FollowUpSuggestion | null; ai: Promise<FollowUpSuggestion | null> } {
  if (!needsFollowUp(q, answer).needed) return { rule: null, ai: Promise.resolve(null) };
  const rule = ruleFollowUps(q, domain);
  return { rule: rule.length ? { questions: rule.map((r) => r.question), examples: rule.map((r) => r.example), source: "RULE" } : null, ai: aiFollowUps(q, answer, domain) };
}

async function aiFollowUps(q: QuestionDefinition, answer: string, domain: DomainKey): Promise<FollowUpSuggestion | null> {
  if (!supabase) return null;
  try {
    const call = supabase.functions.invoke<{ questions: string[]; examples?: string[]; source: string }>("portfolio-ai", { body: { action: "followup", question: q.title, answer, domain } });
    const timeout = new Promise<{ data: null; error: Error }>((r) => setTimeout(() => r({ data: null, error: new Error("timeout") }), AI_TIMEOUT_MS));
    const { data, error } = await Promise.race([call, timeout]);
    if (!error && data?.source === "AI" && data.questions.length) return { questions: data.questions, examples: data.questions.map((_, i) => data.examples?.[i] ?? ""), source: "AI" };
  } catch { /* 규칙 기반 질문 유지 */ }
  return null;
}
