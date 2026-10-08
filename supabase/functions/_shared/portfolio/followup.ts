// Layer B: 적응형 후속 질문. 스키마 질문을 대체하지 않고, 답이 구체적이지 않을 때만 1~2개 제안한다.
// 여기서는 "후속 질문이 필요한가"를 규칙으로 판단하고, 질문 문구는 AI(서버) → 실패 시 규칙 기반 hints 로 만든다.
import { hintExamplesFor } from "./domains.ts";
import type { DomainKey, QuestionDefinition } from "./types.ts";

export const MAX_FOLLOW_UPS = 2;
export const REASON_WORDS = ["때문", "위해", "이유", "해서", "라서", "므로", "고려", "판단", "덕분", "그래서"];

export interface FollowUpNeed { needed: boolean; reasons: ("short" | "noReason")[] }

export function needsFollowUp(q: QuestionDefinition, answer: string): FollowUpNeed {
  const f = q.followUp;
  const text = answer.trim();
  if (!f || !text) return { needed: false, reasons: [] };
  const reasons: FollowUpNeed["reasons"] = [];
  if (f.minChars && text.length < f.minChars) reasons.push("short");
  if (f.askWhy && !REASON_WORDS.some((w) => text.includes(w))) reasons.push("noReason");
  return { needed: reasons.length > 0, reasons };
}

/** 후속 질문 하나와 그 답변 예시 */
export interface FollowUpItem { question: string; example: string }

/** AI 없이 쓰는 후속 질문 (명확히 "추천 질문"으로 표시한다). 예시가 없는 예전 질문은 예시 칸을 비운다 */
export function ruleFollowUps(q: QuestionDefinition, domain: DomainKey): FollowUpItem[] {
  const ex = hintExamplesFor(domain, q);
  return (q.followUp?.hints ?? []).slice(0, MAX_FOLLOW_UPS).map((question, i) => ({ question, example: ex[i] ?? "" }));
}

/** 서버 AI 에 넘길 지시문. 답변에 없는 내용을 가정하지 않는 "질문"만 만들게 한다. */
export const FOLLOWUP_PROMPT = `너는 대학생의 지역 봉사·재능기부 활동을 포트폴리오로 정리하도록 돕는 인터뷰어다.
학생이 방금 한 질문에 짧게 답했다. 포트폴리오에 쓸 수 있도록 답을 더 구체화하는 후속 질문을 1~2개 만든다.
- 학생의 답을 바탕으로 "어떤 기준으로", "왜", "어떻게 확인했는지"를 묻는다.
- 답에 없는 사실을 전제하지 않는다. 숫자나 성과를 유도하지 않는다.
- 한 질문은 40자 이내, 존댓말, 물음표로 끝낸다.
- 질문마다 example 에 학생이 참고할 짧은 답변 예시를 하나 붙인다. 예시는 학생 답에 없는 사실을 단정하지 않는 일반적인 형태로, 60자 이내.
- 이미 충분히 구체적이면 빈 배열을 돌려준다.`;
