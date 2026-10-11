import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL || 'http://localhost:3002';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 844 } });
  await page.goto(`${base}/login/`);
  await page.evaluate(() => {
    sessionStorage.setItem('wolgye-demo-enabled', 'true');
    sessionStorage.setItem('wolgye-demo-tab-user', 's1');
    sessionStorage.setItem('wolgye-demo-tour', JSON.stringify({ role: 'student', step: 10 }));
  });
  await page.goto(`${base}/portfolio/view/?id=demo-menu-2&s=s1`);
  const frame = page.frameLocator('iframe[data-demo-tour="portfolio-frame"]');
  await frame.locator('body[data-wolink-tour="first"]').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('[aria-label="데모 안내"] > div').count(), 1, 'iframe should not be outlined by the parent overlay');
  await frame.locator('.strip[data-index="0"]').click();
  await page.getByText('12 / 20', { exact: false }).waitFor();
  for (let stage = 1; stage <= 8; stage++) {
    await frame.locator('#arrow-next').click();
    await page.getByText(`${12 + stage} / 20`, { exact: false }).waitFor();
  }
  await page.getByRole('button', { name: '읽기 완료' }).click();
  await page.getByRole('dialog', { name: '튜토리얼 완료' }).waitFor();
  await page.getByRole('button', { name: '자유롭게 둘러보기' }).click();
  await page.getByRole('dialog', { name: '튜토리얼 완료' }).waitFor({ state: 'hidden' });
  console.log('PASS portfolio tour from first bar through final free browsing');
} finally {
  await browser.close();
}
