// 테스트용 최소 데이터: 점주 2명, 학생 2명, 메뉴판 개선 디자인 공고 1건
import { emptyDB, type Ctx, type WorkflowDB } from "@/lib/workflow/engine";

export function seed(): WorkflowDB {
  const db = emptyDB();
  const loc = { lat: 37.62, lng: 127.06 };
  db.users.push(
    { id: "owner", role: "resident", name: "행복분식", kind: "상인", location: loc, address: "광운로 21" },
    { id: "owner2", role: "resident", name: "다른가게", kind: "상인", location: loc, address: "월계로 1" },
    { id: "stu", role: "student", name: "김하늘", department: "디자인학과", skills: ["Figma"], interests: ["디자인"], availableHours: "", maxDistanceM: 1500, location: loc },
    { id: "stu2", role: "student", name: "박도윤", department: "소프트웨어학부", skills: [], interests: [], availableHours: "", maxDistanceM: 1500, location: loc },
  );
  db.posts.push({
    id: "post", title: "메뉴판 개선", category: "디자인", description: "메뉴판이 복잡해요", authorId: "owner", location: loc, address: "광운로 21",
    status: "open", durationDays: 7, difficulty: 2, isTeam: false, createdAt: "2026-09-01T00:00:00Z",
    problem: "메뉴판이 복잡해서 손님이 메뉴를 못 찾아요", domain: "DESIGN", expectedDeliverables: ["A3 메뉴판 1종"], completionCriteria: "인쇄 가능한 PDF",
    revisionLimit: 2, compensationType: "NON_MONETARY", compensationDescription: "식사권",
  });
  return db;
}

export function ctx(): Ctx {
  let n = 0;
  let t = Date.parse("2026-09-10T00:00:00Z");
  return { id: () => `id${++n}`, now: () => new Date((t += 1000)).toISOString() };
}
