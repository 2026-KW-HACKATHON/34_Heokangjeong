import { expect, it } from "vitest";
import { reviseAgreement, confirmAgreement, type AgreementTerms } from "../src/lib/agreement";
const terms: AgreementTerms = { startDate:"2026-10-07",endDate:"2026-10-20",scope:"메뉴판 디자인",deliverables:"PDF 1개",acceptance:"가격 확인 후 파일 수령",coupon:"음료 쿠폰 5장, 완료 후 지급",revisions:2,exclusions:"인쇄 비용",handoff:"원본과 안내 파일 전달" };
it("수정은 확인을 초기화하고 오래된 버전의 확인을 막는다",()=>{
  const draft=reviseAgreement(null,"a1",0,terms);
  const one=confirmAgreement(draft,1,"student");
  expect(one.finalizedAt).toBeNull();
  const updated=reviseAgreement(one,"a1",1,{...terms,scope:"메뉴판 2장"});
  expect(updated.studentConfirmedAt).toBeNull();
  expect(()=>confirmAgreement(updated,1,"owner")).toThrow(/최신/);
  const final=confirmAgreement(confirmAgreement(updated,2,"owner"),2,"student");
  expect(final.finalizedAt).toBeTruthy();
  expect(()=>reviseAgreement(final,"a1",2,terms)).toThrow(/최종본/);
});
it("불가능한 날짜, 역순 기간, 누락 항목을 거부한다",()=>{
  expect(()=>reviseAgreement(null,"a1",0,{...terms,startDate:"2026-02-30"})).toThrow();
  expect(()=>reviseAgreement(null,"a1",0,{...terms,endDate:"2026-10-01"})).toThrow();
  expect(()=>reviseAgreement(null,"a1",0,{...terms,scope:" "})).toThrow();
});
