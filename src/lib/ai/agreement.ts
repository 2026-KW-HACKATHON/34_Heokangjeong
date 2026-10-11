import type { Post } from "@/types";
import { supabase } from "@/lib/supabase";
import { cannedAgreement, cannedAi, cannedPause } from "./demo";

export interface AgreementDraft {
  summary: string;
  scope: string;
  deliverables: string;
  acceptance: string;
  coupon: string;
  handoff: string;
  source: "Gemini" | "DEMO";   // DEMO: 체험용 준비된 답
  model: string;
}

export async function summarizeAgreement(text: string, post?: Post): Promise<AgreementDraft> {
  if (cannedAi()) { await cannedPause(); return cannedAgreement(text, post); }   // 체험 중에는 준비된 답 (Gemini 대기 없음)
  if (!supabase) throw new Error("Gemini 연결이 설정되지 않았어요. Supabase 환경변수를 확인해 주세요.");
  const { data, error } = await supabase.functions.invoke<AgreementDraft>("agreement-ai", { body: { text } });
  if (error) {
    const message = await (error as { context?: Response }).context?.json?.().then((body: { error?: string }) => body.error).catch(() => undefined);
    throw new Error(message ?? "Gemini 요약을 받지 못했어요. 함수 배포 상태를 확인해 주세요.");
  }
  if (!data || data.source !== "Gemini" || !data.summary) throw new Error("Gemini 요약 결과가 비어 있어요. 다시 시도해 주세요.");
  return data;
}
