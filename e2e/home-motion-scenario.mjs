// Mock-only UI checks. Start with empty NEXT_PUBLIC_SUPABASE_URL / KEY, then run:
// PLAYWRIGHT_CHANNEL=msedge node e2e/home-motion-scenario.mjs (or installed Chromium).
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const shots = process.env.SHOTS ?? "e2e/shots/home-motion";
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(base, { waitUntil: "networkidle" });
  // Refuse to run account-switching checks against a real authenticated app.
  await page.goto(`${base}/me/`, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("combobox", { name: "계정 전환" }).count(), 1, "Run this scenario in mock mode only");
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("wolgye-user", "s1"); });
  await page.goto(base, { waitUntil: "networkidle" });
  const choose = (label) => page.locator(".connection-picker").getByRole("button", { name: label, exact: true });
  const cards = page.locator(".home-post-enter");
  const waitCount = (count) => page.waitForFunction((expected) => document.querySelectorAll(".home-post-enter").length === expected, count);
  await cards.first().waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('.home-world')?.getAttribute('data-scroll-progress') === '0.000');
  const initialLink = await page.locator('.home-world').evaluate(el => el.style.getPropertyValue('--world-link-1'));
  await page.evaluate(() => scrollTo(0, 350));
  await page.waitForFunction(() => Number(document.querySelector('.home-world')?.getAttribute('data-scroll-progress')) > .2);
  const scrolledLink = await page.locator('.home-world').evaluate(el => el.style.getPropertyValue('--world-link-1'));
  assert.ok(Number(scrolledLink) < Number(initialLink), 'Scrolling must draw more of the connection');
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('.home-world')?.getAttribute('data-scroll-progress') === '0.000');
  assert.equal(await page.locator('.home-world').evaluate(el => el.style.getPropertyValue('--world-link-1')), initialLink, 'Scrolling back must reverse the connection');
  const allCount = await cards.count();
  assert.ok(allCount > 0);
  await choose("디자인").click();
  assert.equal(await choose("디자인").getAttribute("aria-pressed"), "true");
  assert.equal(await cards.count(), 2);
  assert.equal(await page.locator(".connection-talent-node").count(), 0);
  assert.equal(await page.locator(".connection-recommendation-icon[title='추천']").count(), 1);
  assert.equal(await page.locator(".connection-explore-end > span").innerText(), "2");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${shots}/design-390.png`, fullPage: false });

  const route = await page.locator(".connection-request-node").getAttribute("href");
  await page.locator(".connection-request-node").click();
  await page.waitForURL((url) => url.pathname.startsWith("/posts/detail"));
  assert.equal(new URL(page.url()).searchParams.get("id"), new URL(route, base).searchParams.get("id"));
  await page.goBack({ waitUntil: "networkidle" });
  await cards.first().waitFor();

  await choose("웹·앱 개발").click();
  await waitCount(2);
  assert.equal(await cards.count(), 2);
  await page.getByRole("searchbox", { name: "공고 검색" }).fill("찾을 수 없는 공고");
  await waitCount(0);
  assert.equal(await cards.count(), 0);
  await page.locator(".connection-explore").click();
  await waitCount(2);
  assert.equal(await page.getByRole("searchbox", { name: "공고 검색" }).inputValue(), "");
  assert.equal(await cards.count(), 2);
  assert.equal(await page.locator(".home-feed-title").evaluate((el) => el === document.activeElement), true);
  await page.waitForTimeout(650);
  assert.ok(await page.evaluate(() => scrollY > 100), "Explore should move to the actual feed");

  await choose("SNS 콘텐츠").click();
  assert.equal(await cards.count(), 0);
  assert.equal(await page.locator(".connection-explore").isDisabled(), true);
  await page.getByRole("button", { name: "모든 재능의 공고 보기" }).click();
  assert.equal(await cards.count(), allCount);
  assert.equal(await page.locator(".connection-hub").evaluate((el) => el === document.activeElement), true);
  await choose("디지털 도움").focus();
  await page.keyboard.press("Enter");
  assert.equal(await choose("디지털 도움").getAttribute("aria-pressed"), "true");
  assert.equal(await cards.count(), 1);
  await choose("디지털 도움").click();
  assert.equal(await cards.count(), allCount);

  for (const width of [320, 390, 480, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(1000);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    for (const label of ["디자인", "사진·영상", "웹·앱 개발", "SNS 콘텐츠", "디지털 도움"]) {
      const bounds = await choose(label).boundingBox();
      assert.ok(bounds && bounds.width >= 44 && bounds.height >= 44, `Touch target too small: ${label} at ${width}px`);
    }
    await page.screenshot({ path: `${shots}/home-${width}.png`, fullPage: false });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector('.home-world')?.style.getPropertyValue('--world-link-1') === '0');
  await choose("디자인").click();
  assert.equal(await page.locator(".connection-wires").count(), 1, "Repeated selections must not accumulate connection drawings");
  assert.equal(await page.locator(".connection-traveler").evaluate((el) => getComputedStyle(el).display), "none");
  assert.equal(await cards.count(), 2);

  await page.evaluate(() => localStorage.setItem("wolgye-user", "r2"));
  await page.reload({ waitUntil: "networkidle" });
  assert.ok((await page.locator(".connection-intro h2").innerText()).includes("작은 요청"));
  assert.match(await page.locator(".connection-secondary").getAttribute("href"), /^\/posts\/new\/?$/);
  await page.evaluate(() => localStorage.setItem("wolgye-user", "s1"));
  for (const path of ["/map/", "/ranking/", "/portfolio/"]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.body.innerText.length > 50);
    assert.ok((await page.locator("body").innerText()).length > 50, `Empty existing screen: ${path}`);
  }
  assert.deepEqual(errors, []);
  console.log("PASS: category filters, real request navigation, explore/scroll/focus, empty state, keyboard, 4 viewport sizes, reduced motion, resident flow, map/ranking/portfolio smoke");
} finally {
  await browser.close();
}
