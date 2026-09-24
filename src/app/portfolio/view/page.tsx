"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import PortfolioDocument from "@/components/PortfolioDocument";
import NotionPanel from "@/components/NotionPanel";
import { ErrorText } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { buildDocument, periodText } from "@shared/portfolio/document";
import type { PortfolioDoc, User } from "@/types";

/** 포트폴리오 상세 (학생 편집본 + 잠긴 원본: 의뢰인 검증·평가 원문·증빙·성과) */
export default function PortfolioViewPage() {
  return <Suspense fallback={<TopBar title="포트폴리오" back />}><View /></Suspense>;
}

function View() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const { user, users } = useSession();
  const studentId = sp.get("s") ?? user?.id ?? "";
  const [doc, setDoc] = useState<PortfolioDoc | null | undefined>(undefined);
  const [error, setError] = useState("");
  useEffect(() => { if (id && studentId) repo.getPortfolioDoc(id, studentId).then((d) => setDoc(d ?? null)).catch((e) => setError(e.message)); }, [id, studentId]);

  const blocks = useMemo(() => {
    if (!doc) return [];
    const b = doc.bundle;
    const client = users.find((u: User) => u.id === b.project.ownerId);
    const member = b.members.find((m) => m.studentId === studentId);
    const approved = b.versions.find((v) => v.id === b.project.approvedVersionId);
    const role = b.answers.find((a) => a.authorId === studentId && a.field === "role" && a.origin === "SCHEMA" && a.status === "ANSWERED");
    return buildDocument({
      domain: b.project.domain, content: doc.edit.content,
      info: { period: periodText(b.project.createdAt, b.project.completedAt), roleLabel: role ? [...role.choices, role.value].filter(Boolean).join(", ") : member?.roleLabel ?? "", clientName: client?.name ?? "의뢰인", clientType: client?.role === "resident" ? client.kind : "주민", approvedVersion: approved?.version ?? null },
      verification: b.verification, review: b.review, evidence: b.evidence, outcomes: b.outcomes,
    });
  }, [doc, users, studentId]);

  if (error) return <><TopBar title="포트폴리오" back /><div className="px-4"><ErrorText text={error} /></div></>;
  if (doc === undefined) return <><TopBar title="포트폴리오" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  if (doc === null) return <><TopBar title="포트폴리오" back /><div className="card mx-4 text-sm">아직 저장한 포트폴리오가 없어요.{user?.id === studentId && <Link href={`/portfolio/build?id=${id}`} className="btn btn-primary mt-3 w-full">포트폴리오 만들기</Link>}</div></>;
  const mine = user?.id === studentId;

  return (
    <>
      <TopBar title="포트폴리오" back right={mine ? <Link href={`/portfolio/build?id=${id}`} className="text-sm font-semibold text-[var(--primary)]">고치기</Link> : undefined} />
      <section className="flex flex-col gap-3 px-4">
        <p className="sub text-xs">편집본 v{doc.edit.version} · {doc.edit.createdAt.slice(0, 10)} 저장{mine ? " · 의뢰인 검증·평가 원문·증빙은 원본 그대로예요" : ""}</p>
        <PortfolioDocument title={doc.edit.content.title} summary={doc.edit.content.summary} blocks={blocks} outcomes={doc.bundle.outcomes} />
        {mine && <NotionPanel edit={doc.edit} doc={blocks} />}
      </section>
    </>
  );
}
