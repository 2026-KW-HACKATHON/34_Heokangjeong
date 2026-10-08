// 초안 만들기 전 전체 기록 점검. 규칙만 쓰는 결정적 계산 — 같은 기록이면 늘 같은 질문이 나온다.
// 준비도(readiness)는 "답이 있는가"만 센다. 여기서는 "답에 근거가 있는가"를 보고, 가장 중요한 질문 최대 3개만 고른다.
// 질문은 언제나 선택이다. 답하지 않아도 초안은 만들어진다.
import { DOMAINS, exampleFor } from "./domains.ts";
import { CLAIM_WORDS } from "./narrative.ts";
import { REASON_WORDS } from "./followup.ts";
import { hasContent } from "./readiness.ts";
import type { DomainKey, EvidenceType, ProjectAnswer, QuestionDefinition } from "./types.ts";

export const MAX_GAPS = 3;
/** 문제를 어디서 알았는지 드러내는 말: 관찰 · 들음 · 조사 */
export const SOURCE_WORDS = ["봤", "보니", "보았", "지켜", "관찰", "말씀", "들었", "듣고", "물어", "여쭤", "질문", "인터뷰", "설문", "리뷰", "후기", "확인", "얘기", "이야기", "하셨", "했대", "한대"];
const SHORT_CHARS = 20;
/** 이유를 드러내는 말. 후속 질문용 목록에 "-아서/-어서/-여서/-려고" 같은 연결 어미를 더한다 */
const WHY_WORDS = [...REASON_WORDS, "아서", "어서", "여서", "려고", "도록"];

export type GapKey = "claimNoMetric" | "decisionNoWhy" | "problemNoSource" | "feedbackMissing" | "usageNoProof" | "tooShort";
export interface GapQuestion {
  key: GapKey;
  title: string;
  example: string;
  /** answer: 글로 답한다 / upload: 증빙을 올린다 */
  action: "answer" | "upload";
  /** 답을 붙일 질문. 그 질문에 답이 없으면 답 자체로, 있으면 후속 답으로 저장한다 */
  questionId?: string;
  evidenceType?: EvidenceType;
}
export type GapAnswer = Pick<ProjectAnswer, "questionId" | "status" | "value" | "choices" | "origin"> & { parentQuestionId?: string };
export interface GapInput {
  domain: DomainKey;
  questions: QuestionDefinition[];        // 이 학생의 질문 스냅샷
  answers: GapAnswer[];                   // 이 학생의 답 (후속 답 포함)
  evidenceTypes: EvidenceType[];
  outcomeCount: number;
  revisionComments: string[];             // 의뢰인 보완 요청 코멘트 (오래된 순)
}

/** 분야별 "핵심 결정" 필드와, 그 이유를 담는 필드 */
const DECISION: Record<DomainKey, { decision: string; why: string[] }> = {
  DESIGN: { decision: "designDecision", why: ["designRationale", "alternatives"] },
  MARKETING: { decision: "strategy", why: ["alternatives"] },
  DEVELOPMENT: { decision: "technologyChoices", why: ["alternatives"] },
  GENERAL: { decision: "process", why: ["alternatives"] },
};
/** 결과·실제 사용을 적는 필드 (성과 주장 검사 대상) */
const RESULT_FIELDS = ["after", "actualUsage", "result", "insight"];
const USED_WORDS = ["실제 게시", "게시됨", "사용 중", "실제 사용"];

export function findGaps(i: GapInput): GapQuestion[] {
  const qOf = (field: string) => i.questions.find((q) => q.field === field);
  const schema = (q?: QuestionDefinition) => (q ? i.answers.find((a) => a.questionId === q.id && a.origin === "SCHEMA") : undefined);
  const answered = (q?: QuestionDefinition) => { const a = schema(q); return !!a && a.status === "ANSWERED" && hasContent(a); };
  const status = (q?: QuestionDefinition) => schema(q)?.status ?? "UNANSWERED";
  /** 그 질문의 답 + 후속 답 전체 */
  const textOf = (q?: QuestionDefinition) => {
    if (!q) return "";
    const a = schema(q);
    const follow = i.answers.filter((x) => x.parentQuestionId === q.id && x.origin !== "SCHEMA" && x.status === "ANSWERED").map((x) => x.value);
    return [...(a && a.status === "ANSWERED" ? [...a.choices, a.value] : []), ...follow].join(" ");
  };
  const ex = (q: QuestionDefinition | undefined, fallback: string) => (q && exampleFor(i.domain, q)) || fallback;
  const gaps: GapQuestion[] = [];

  // 1. 성과 단어는 있는데 숫자도, 등록한 성과도, 지표 증빙도 없다
  if (i.outcomeCount === 0 && !i.evidenceTypes.includes("METRIC")) {
    for (const field of RESULT_FIELDS) {
      const q = qOf(field);
      const t = textOf(q);
      const word = CLAIM_WORDS.find((w) => t.includes(w));
      if (q && word && !/\d/.test(t)) {
        gaps.push({ key: "claimNoMetric", action: "answer", questionId: q.id,
          title: `'${word}'라고 적었는데, 그 변화는 어떻게 확인했나요? 숫자가 없다면 그 표현을 지워도 괜찮아요`,
          example: "인스타그램 인사이트에서 시작 전과 2주 뒤 조회수를 비교했어요 (평균 420 → 1,100)" });
        break;
      }
    }
  }

  // 2. 핵심 결정은 있는데 이유도, 고려한 다른 방법도 없다
  const dec = DECISION[i.domain];
  const decQ = qOf(dec.decision);
  if (answered(decQ)) {
    const whyQs = dec.why.map(qOf).filter((q): q is QuestionDefinition => !!q);
    const whyText = [textOf(decQ), ...whyQs.map(textOf)].join(" ");
    const hasWhy = whyQs.some((q) => answered(q) || status(q) === "NOT_APPLICABLE") || WHY_WORDS.some((w) => whyText.includes(w));
    if (!hasWhy) {
      const target = whyQs.find((q) => !answered(q)) ?? decQ!;
      gaps.push({ key: "decisionNoWhy", action: "answer", questionId: target.id,
        title: "왜 그 방법이었나요? 다른 방법과 비교했다면 그것도 적어 주세요",
        example: ex(target, "손님 질문이 대부분 맵기여서, 맵기를 메뉴 이름 바로 옆에 두었어요") });
    }
  }

  // 3. 문제를 어떻게 알게 됐는지(관찰·들음·조사)가 안 보인다
  const probField = DOMAINS[i.domain].fields.find((f) => f.core === "problem")?.key;
  const probQ = probField ? qOf(probField) : undefined;
  if (answered(probQ) && !SOURCE_WORDS.some((w) => textOf(probQ).includes(w))) {
    gaps.push({ key: "problemNoSource", action: "answer", questionId: probQ!.id,
      title: "그 문제를 어떤 상황에서 확인했나요? (예: 점주님 설명, 손님 질문, 직접 관찰)",
      example: probQ!.followUp?.hintExamples?.[0] ?? "점심시간에 지켜보니 외국인 손님 5팀 중 4팀이 번역기를 썼어요" });
  }

  // 4. 보완 요청을 받았는데 무엇을 바꿨는지가 없다
  const comment = i.revisionComments.filter((c) => c.trim()).at(-1);
  if (comment) {
    const fbQ = qOf("feedbackChange");
    const target = fbQ ?? qOf(DOMAINS[i.domain].fields.find((f) => f.core === "process")?.key ?? "");
    const done = fbQ ? answered(fbQ) || status(fbQ) === "NOT_APPLICABLE" : false;
    if (target && !done) {
      const short = comment.trim().length > 40 ? `${comment.trim().slice(0, 40)}…` : comment.trim();
      gaps.push({ key: "feedbackMissing", action: "answer", questionId: target.id,
        title: `보완 요청 "${short}"을 받고 무엇을 바꿨나요?`,
        example: ex(fbQ, "'매운 메뉴를 한눈에 알았으면 좋겠다'는 요청을 받고 메뉴 이름 옆에 맵기 표시를 넣었어요") });
    }
  }

  // 5. 실제로 쓰인다고 했는데 사용 증빙이 없다
  const usageQ = qOf("actualUsage");
  if (answered(usageQ) && USED_WORDS.some((w) => textOf(usageQ).includes(w)) && !i.evidenceTypes.includes("USAGE_PROOF")) {
    gaps.push({ key: "usageNoProof", action: "upload", evidenceType: "USAGE_PROOF",
      title: "실제로 쓰이고 있다고 적었어요. 쓰이는 모습을 찍은 사진을 올려 주세요",
      example: "테이블에 놓인 메뉴판 사진, 게시물이 올라간 화면 캡처" });
  }

  // 6. 꼭 필요한 글 답이 너무 짧다
  const required = DOMAINS[i.domain].readiness.filter((r) => r.level === "REQUIRED" && r.questionId).map((r) => r.questionId!);
  const shortQ = i.questions.find((q) => required.includes(q.id) && q.input.kind === "long" && answered(q) && textOf(q).trim().length < SHORT_CHARS);
  if (shortQ) {
    gaps.push({ key: "tooShort", action: "answer", questionId: shortQ.id,
      title: `조금만 더 자세히 적어 주세요: ${shortQ.title}`,
      example: ex(shortQ, "누가, 언제, 무엇이 불편했는지 한두 문장으로 적어 주세요") });
  }

  // 같은 질문을 두 번 묻지 않고, 앞선 규칙(더 중요한 것)부터 최대 3개
  const seen = new Set<string>();
  return gaps.filter((g) => { const k = g.questionId ?? g.key; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX_GAPS);
}
