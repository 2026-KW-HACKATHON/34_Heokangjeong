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
    sessionStorage.setItem('wolgye-demo-tour', JSON.stringify({ role: 'student', step: 6 }));
  });
  await page.goto(`${base}/chats/room/?id=a13`);
  await page.locator('[data-demo-tour="agreement"]').click();
  const dialog = page.getByRole('dialog', { name: '작업 계약서 작성' });
  await dialog.waitFor();
  await dialog.locator('.agreement-choice-highlight').waitFor();
  for (const label of ['작업 범위', '전달할 결과물', '완료 확인 기준']) {
    assert.equal(await dialog.getByRole('textbox', { name: label }).inputValue(), '', `${label} starts empty`);
  }
  await dialog.getByRole('button', { name: '예시 프롬프트 입력' }).click();
  await dialog.getByRole('button', { name: 'Gemini 요약', exact: true }).click({ timeout: 15000 });
  await dialog.locator('.agreement-result-highlight').waitFor();
  assert.notEqual(await dialog.getByRole('textbox', { name: '작업 범위' }).inputValue(), '');
  await dialog.getByText('Gemini 요약 결과', { exact: true }).click();
  await page.locator('dialog.agreement-dialog[data-summary-reviewed="true"]').waitFor();
  assert.notEqual(await dialog.locator('.agreement-actions .agreement-primary').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  console.log('PASS agreement choices, blank draft, Gemini result, and next guidance');
} finally {
  await browser.close();
}
