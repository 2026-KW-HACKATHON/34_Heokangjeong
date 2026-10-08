import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3011";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${base}/login/`);
  await page.getByRole("button", { name: "학생 입장 데모" }).click();
  await page.evaluate(() => sessionStorage.removeItem("wolgye-demo-tour"));
  await page.goto(`${base}/chats/room/?id=a13`);
  await page.locator('[data-demo-tour="agreement"]').click();
  const dialog = page.locator(".agreement-dialog");
  await dialog.getByRole("textbox", { name: "계약서 자유 입력" }).fill("월계 미용실에서 A3 포스터 하나와 SNS 이미지 한 장을 만들기로 했습니다. PDF와 PNG를 채팅으로 전달하고 점주가 가격을 확인하면 완료입니다. 보상은 커트 1회 이용권입니다.");
  await dialog.getByRole("button", { name: "Gemini로 계약서 요약" }).click();
  await dialog.getByText("실제 Gemini 응답", { exact: false }).waitFor({ timeout: 60000 });
  assert.match(await dialog.getByRole("textbox", { name: "작업 범위" }).inputValue(), /포스터/);
  assert.match(await dialog.getByRole("textbox", { name: "전달할 결과물" }).inputValue(), /PDF|PNG|이미지/);
  assert.match(await dialog.getByRole("textbox", { name: "완료 확인 기준" }).inputValue(), /점주|확인/);
  console.log("브라우저 계약서 자유 입력 → 실제 Gemini 요약 → 항목 반영 통과");
  await page.close();
} finally {
  await browser.close();
}
