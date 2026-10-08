import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3010";
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", headless: true });
try {
  const context = await browser.newContext();
  const student = await context.newPage();
  const owner = await context.newPage();
  await student.goto(`${base}/login/`);
  await student.getByRole("button", { name: /학생으로 체험/ }).click();
  await student.waitForURL(`${base}/`);
  await owner.goto(`${base}/login/`);
  await owner.getByRole("button", { name: /상인으로 체험/ }).click();
  await owner.waitForURL(`${base}/`);
  assert.equal(await student.evaluate(() => sessionStorage.getItem("wolgye-demo-tab-user")), "s1");
  assert.equal(await owner.evaluate(() => sessionStorage.getItem("wolgye-demo-tab-user")), "r1");
  await owner.goto(`${base}/me/`);
  await owner.locator("#demo-account").selectOption("r7");
  await Promise.all([student.goto(`${base}/chats/room/?id=a13`), owner.goto(`${base}/chats/room/?id=a13`)]);
  await owner.getByLabel("메시지").fill("두 창 동시 시연 확인");
  await owner.getByRole("button", { name: "전송" }).click();
  await student.getByText("두 창 동시 시연 확인").waitFor({ timeout: 15000 });
  assert.equal(await student.evaluate(() => sessionStorage.getItem("wolgye-demo-tab-user")), "s1");
  assert.equal(await owner.evaluate(() => sessionStorage.getItem("wolgye-demo-tab-user")), "r7");
  console.log("두 탭 계정 분리·채팅 동기화 확인");
} finally {
  await browser.close();
}
