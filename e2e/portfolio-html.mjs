import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = 'http://127.0.0.1:3000/portfolio/experience/?s=s13&kind=card&id=demo-real2sim';
  await page.goto(url);
  await page.getByRole('heading', { name: 'Real2Sim & Sim2Real', exact: true }).waitFor();

  await page.getByRole('button', { name: 'HTML 보기' }).click();
  assert.equal(await page.getByRole('button', { name: 'HTML 보기' }).getAttribute('aria-pressed'), 'true');
  await page.frameLocator('iframe[title="Real2Sim & Sim2Real HTML 보기"]').getByRole('heading', { name: 'Real2Sim & Sim2Real', exact: true }).waitFor();
  const frameWidth = await page.locator('.experience-html-frame').evaluate(element => element.getBoundingClientRect().width);
  const articleWidth = await page.locator('.experience-page article').evaluate(element => element.getBoundingClientRect().width);
  assert.ok(Math.abs(frameWidth - articleWidth) < 2, `preview width ${frameWidth}, article width ${articleWidth}`);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'HTML 다운로드', exact: true }).first().click(),
  ]);
  assert.match(download.suggestedFilename(), /\.html$/);
  const html = await readFile(await download.path(), 'utf8');
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Real2Sim &amp; Sim2Real/);
  assert.match(html, /Content-Security-Policy/);

  await page.getByRole('button', { name: '현재 양식' }).click();
  await page.getByRole('heading', { name: 'Real2Sim & Sim2Real', exact: true }).waitFor();
  await page.getByLabel('게시물 더보기').click();
  assert.equal(await page.getByRole('button', { name: '게시물 수정' }).count(), 0);
  await page.evaluate(() => localStorage.setItem('wolgye-user', 's13'));
  await page.reload();
  await page.getByRole('heading', { name: 'Real2Sim & Sim2Real', exact: true }).waitFor();
  await page.getByLabel('게시물 더보기').click();
  await page.getByRole('button', { name: '게시물 수정' }).click();
  await page.getByLabel('제목', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: HTML preview, matching width, download, owner-only edit menu');
} finally {
  await browser.close();
}
