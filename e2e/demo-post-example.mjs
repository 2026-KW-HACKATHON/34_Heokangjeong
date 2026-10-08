import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3010";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/login/`);
  await page.getByRole("button", { name: /상인으로 체험/ }).click();
  await page.goto(`${base}/posts/new/`);
  assert.equal(await page.getByPlaceholder("가게 메뉴판 디자인").inputValue(), "");
  await page.getByRole("button", { name: "예시 공고 채우기" }).click();
  await page.getByText("데모 예시 초안", { exact: false }).waitFor();
  assert.equal(await page.getByPlaceholder("가게 메뉴판 디자인").inputValue(), "가게 메뉴판 디자인");
  await page.reload();
  await page.getByRole("button", { name: "등록하기", exact: true }).click();
  await page.waitForURL(/\/posts\/detail\/\?id=/, { timeout: 15000 });
  await page.getByText("가게 메뉴판 디자인").first().waitFor();
  console.log("데모 공고: 예시 초안 채우기·빈 예시 필드 등록 확인");
} finally {
  await browser.close();
}
