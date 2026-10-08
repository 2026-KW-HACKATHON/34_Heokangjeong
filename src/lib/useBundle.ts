"use client";
import { useCallback, useEffect, useState } from "react";
import type { ProjectAnswer, ProjectBundle, Stage } from "@/types";
import { coreQuestions } from "@shared/portfolio/domains";
import { repo } from "./repo";

/** 프로젝트 화면 공통: 묶음 읽기 + 다시 읽기 */
export function useBundle(projectId: string) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    if (!projectId) return;
    try { setBundle(await repo.getBundle(projectId)); setError(""); } catch (e) { setError((e as Error).message); }
  }, [projectId]);
  useEffect(() => { reload(); }, [reload]);
  return { bundle, error, reload };
}

export const STAGES: { key: Stage; label: string; desc: string }[] = [
  { key: "START", label: "시작", desc: "문제·대상·역할" },
  { key: "PROGRESS", label: "진행", desc: "결정·과정" },
  { key: "FINISH", label: "마무리", desc: "결과물·변화" },
];

export const myAnswers = (b: ProjectBundle, userId: string) => b.answers.filter((a) => a.authorId === userId);
export const memberOf = (b: ProjectBundle, userId: string) => b.members.find((m) => m.studentId === userId);
export const questionsForMember = (b: ProjectBundle, userId: string) => coreQuestions(domainForMember(b, userId), memberOf(b, userId)?.questionSnapshot?.questions ?? b.project.questionSnapshot.questions);
export const domainForMember = (b: ProjectBundle, userId: string) => memberOf(b, userId)?.domain ?? b.project.domain;
export const schemaAnswer = (answers: ProjectAnswer[], questionId: string) => answers.find((a) => a.questionId === questionId && a.origin === "SCHEMA");
/** 이 단계에서 아직 답도, 건너뜀도, 해당 없음도 아닌 질문 */
export function pendingQuestions(b: ProjectBundle, userId: string, stage: Stage) {
  const mine = myAnswers(b, userId);
  return questionsForMember(b, userId).filter((q) => q.stage === stage && (schemaAnswer(mine, q.id)?.status ?? "UNANSWERED") === "UNANSWERED");
}
export function stageProgress(b: ProjectBundle, userId: string, stage: Stage) {
  const qs = questionsForMember(b, userId).filter((q) => q.stage === stage);
  const mine = myAnswers(b, userId);
  const answered = qs.filter((q) => schemaAnswer(mine, q.id)?.status === "ANSWERED").length;
  const handled = qs.filter((q) => (schemaAnswer(mine, q.id)?.status ?? "UNANSWERED") !== "UNANSWERED").length;
  return { total: qs.length, answered, handled };
}
