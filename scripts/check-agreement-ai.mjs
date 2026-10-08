import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env", import.meta.url), "utf8")
  .split(/\r?\n/).filter(line => /^[A-Z_][A-Z_0-9]*=/.test(line))
  .map(line => { const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, "")]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_KEY;
assert.ok(url && key, "Supabase 연결 환경변수가 필요합니다.");
const response = await fetch(`${url}/functions/v1/agreement-ai`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
  body: JSON.stringify({ text: "월계 미용실 시술 안내 포스터를 A3로 만들고 SNS용 정사각 이미지도 1장 주세요. 점주가 가격을 확인한 뒤 PDF와 PNG를 채팅으로 받아 완료합니다. 보상으로 커트 1회 이용권을 드립니다." }),
});
const body = await response.json();
assert.equal(response.ok, true, body.error ?? `HTTP ${response.status}`);
assert.equal(body.source, "Gemini");
assert.match(body.scope, /포스터/);
assert.match(body.deliverables, /PDF|PNG|이미지/);
assert.match(body.coupon, /커트/);
console.log(JSON.stringify({ source: body.source, model: body.model, summary: body.summary, scope: body.scope, deliverables: body.deliverables, coupon: body.coupon }, null, 2));
