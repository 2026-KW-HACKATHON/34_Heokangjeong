// 관리자 계정 만들기. 한 번만 실행하면 된다.
//   실행: node scripts/create-admin.mjs
//   계정: admin@admin.com / admin1234  (Supabase 는 비밀번호 6자 이상이라 'admin' 은 쓸 수 없다)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => l.split("=").map((s) => s.trim())));
const EMAIL = "admin@admin.com", PW = "admin1234";

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_KEY, { auth: { persistSession: false } });
let { data, error } = await db.auth.signInWithPassword({ email: EMAIL, password: PW });
if (error) {
  const up = await db.auth.signUp({ email: EMAIL, password: PW });
  if (up.error) { console.error("가입 실패:", up.error.message); process.exit(1); }
  ({ data } = await db.auth.signInWithPassword({ email: EMAIL, password: PW }));
}
const { error: e2 } = await db.from("profiles").upsert({
  id: data.user.id, role: "admin", name: "앱 관리자", lat: 37.6255, lng: 127.0605,
});
if (e2) { console.error("프로필 저장 실패:", e2.message, "\n→ 0023_club_approval.sql 을 먼저 실행했는지 확인하세요"); process.exit(1); }
console.log(`관리자 계정 준비 완료\n  이메일: ${EMAIL}\n  비밀번호: ${PW}\n  로그인 후 '나' 탭 → 🛠️ 관리자 또는 /admin 으로 들어가세요`);
process.exit(0);
