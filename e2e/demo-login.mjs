import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3010";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });

try {
  for (const [label, id] of [
    ["학생으로 체험", "s1"],
    ["상인으로 체험", "r1"],
    ["주민으로 체험", "r4"],
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base);
    const entry = page.getByRole("button", { name: new RegExp(label) });
    await entry.waitFor({ timeout: 60000 });
    assert.match(new URL(page.url()).pathname, /^\/login\/?$/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await entry.click();
    await page.waitForURL(url => url.pathname === "/");
    assert.equal(await page.evaluate(() => sessionStorage.getItem("wolgye-demo-tab-user")), id);
    await page.reload();
    assert.equal(new URL(page.url()).pathname, "/");
    await page.close();
  }
  console.log("데모 진입: 학생·상인·주민 선택 및 새로고침 유지 확인");
} finally {
  await browser.close();
}
