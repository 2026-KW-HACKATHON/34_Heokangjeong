"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ErrorText, Field, inputCls, useAction } from "@/components/ui";
import { repo } from "@/lib/repo";
import { useSession } from "@/lib/session";
import { domainForMember, useBundle } from "@/lib/useBundle";
import { DOMAINS } from "@shared/portfolio/domains";
import { EVIDENCE_LABEL } from "@shared/portfolio/document";
import type { EvidenceType } from "@/types";

/** 증빙 추가: 파일(공개 저장소에 업로드) · 링크 · 설명. 어떤 답변(필드)과 주장을 뒷받침하는지 연결한다 */
export default function EvidencePage() {
  return <Suspense fallback={<TopBar title="증빙 추가" back />}><AddEvidence /></Suspense>;
}

const TYPES = Object.keys(EVIDENCE_LABEL) as EvidenceType[];
const LINK_TYPES: EvidenceType[] = ["DELIVERABLE_URL"];
const DEFAULT_FIELD: Partial<Record<EvidenceType, string[]>> = {
  BEFORE_IMAGE: ["before", "existingProblem", "problem"], AFTER_IMAGE: ["after", "deliverable"], DELIVERABLE_FILE: ["deliverable", "deliveryOrDeployment"],
  DELIVERABLE_URL: ["deliveryOrDeployment", "deliverable", "execution"], TEST_RECORD: ["testing"], METRIC: ["result", "kpi"], USAGE_PROOF: ["actualUsage"], PROCESS_IMAGE: ["designProcess", "process", "implementation", "execution"],
};

function AddEvidence() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get("id") ?? "";
  const back = sp.get("back");
  const { user } = useSession();
  const { bundle: b, error: loadError } = useBundle(id);
  const [type, setType] = useState<EvidenceType>((sp.get("type") as EvidenceType) || "BEFORE_IMAGE");
  const [file, setFile] = useState<File | null>(null);
  const [publicConsent, setPublicConsent] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [linkedField, setLinkedField] = useState<string | null>(null);
  const [linkedClaim, setLinkedClaim] = useState("");
  const act = useAction();
  if (loadError) return <><TopBar title="증빙 추가" back /><div className="px-4"><ErrorText text={loadError} /></div></>;
  if (!b || !user) return <><TopBar title="증빙 추가" back /><p className="sub p-6 text-center text-sm">불러오는 중…</p></>;
  const isOwner = b.project.ownerId === user.id;
  const fields = DOMAINS[isOwner ? b.project.domain : domainForMember(b, user.id)].fields;
  const field = linkedField ?? (DEFAULT_FIELD[type] ?? []).find((f) => fields.some((x) => x.key === f)) ?? "";
  const wantsLink = LINK_TYPES.includes(type);

  async function submit() {
    await act.run(async () => {
      if (!file && !url.trim() && !description.trim()) throw new Error("파일·링크·설명 중 하나는 있어야 해요");
      if (url.trim() && !/^https?:\/\//i.test(url.trim())) throw new Error("http:// 또는 https:// 로 시작하는 공개 주소를 적어 주세요 (내 컴퓨터 경로는 안 돼요)");
      let up: { url: string; fileName: string; mimeType: string } | undefined;
      if (file && !publicConsent) throw new Error("파일 공개 동의를 확인해 주세요. 비공개 자료는 업로드하지 마세요.");
      if (file) up = await repo.uploadEvidenceFile(id, file, publicConsent);
      await repo.addEvidence({
        projectId: id, actorId: user!.id, type, description, url: up?.url ?? (url.trim() || undefined), fileName: up?.fileName, mimeType: up?.mimeType,
        linkedField: field || undefined, linkedClaim: linkedClaim.trim() || undefined, source: up ? "STUDENT_UPLOAD" : url.trim() ? "STUDENT_LINK" : "STUDENT_NOTE",
      });
      router.replace(back ?? `/projects/detail?id=${id}`);
    });
  }

  return (
    <>
      <TopBar title="증빙 추가" back />
      <section className="flex flex-col gap-3 px-4">
        <div className="card flex flex-col gap-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">어떤 증빙인가요?</legend>
            <div className="flex flex-wrap gap-2">
              {TYPES.filter((t) => isOwner || t !== "CLIENT_FEEDBACK").map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(t); setLinkedField(null); }} className={`chip ${type === t ? "chip-on font-semibold" : ""}`}>{EVIDENCE_LABEL[t]}</button>
              ))}
            </div>
          </fieldset>
          {!wantsLink && (
            <Field label="파일" hint="사진·PDF 등. Notion 에서도 열리도록 공개 저장소에 올라가요 (주소는 추측할 수 없는 무작위 이름).">
              <input type="file" accept={type.endsWith("IMAGE") ? "image/*" : undefined} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPublicConsent(false); }} className="block w-full text-sm" />
            </Field>
          )}
          {file && <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] p-3 text-sm"><input type="checkbox" className="mt-1" checked={publicConsent} onChange={e => setPublicConsent(e.target.checked)} /><span>이 파일은 링크를 아는 누구나 볼 수 있는 공개 저장소에 업로드되며, Notion 문서에도 포함될 수 있음을 확인했어요. 개인정보·비공개 자료는 올리지 않겠습니다.</span></label>}
          <Field label={wantsLink ? "링크" : "또는 링크"} hint="배포 주소, 인스타그램 게시물, 드라이브 공유 링크 등 공개 주소">
            <input type="url" inputMode="url" className={inputCls} placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <Field label="설명">
            <input className={inputCls} placeholder="예: 작업 전 메뉴판 (벽 부착 상태)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="어떤 기록을 뒷받침하나요?">
            <select className={inputCls} value={field} onChange={(e) => setLinkedField(e.target.value)}>
              <option value="">연결 안 함</option>
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="뒷받침하는 주장 (선택)" hint="포트폴리오 문장과 증빙을 잇는 데 써요. 예: 메뉴를 4개 구역으로 재구성함">
            <input className={inputCls} value={linkedClaim} onChange={(e) => setLinkedClaim(e.target.value)} />
          </Field>
          <p className="sub text-xs">올린 증빙은 원본으로 보존돼 나중에 고칠 수 없어요.</p>
        </div>
        <ErrorText text={act.error} />
        <button disabled={act.busy} onClick={submit} className="btn btn-primary w-full disabled:opacity-50">{act.busy ? "올리는 중…" : "증빙 저장"}</button>
      </section>
    </>
  );
}
