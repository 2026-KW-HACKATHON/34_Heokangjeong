import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000/me/');
  await page.getByRole('link',{name:'새 포트폴리오 피드 작성'}).click();
  await page.getByRole('heading',{name:'새 경험을 기록해요'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'피드 업로드'}).isDisabled(),true);
  await page.getByLabel('사진 추가').setInputFiles([path.resolve('public/portfolio-samples/menu.png'),path.resolve('public/portfolio-samples/banner.png')]);
  await page.getByRole('button',{name:'사진 2 대표사진으로 선택'}).click();
  assert.equal(await page.getByRole('button',{name:'사진 2 대표사진으로 선택'}).getAttribute('aria-pressed'),'true');
  await page.getByLabel('피드 제목').fill('직접 만든 홍보 디자인');
  await page.getByLabel('피드 본문').fill('문제 정의부터 결과물 제작까지 직접 진행했습니다.');
  await page.getByRole('button',{name:'피드 업로드'}).click();
  await page.getByRole('heading',{name:'직접 만든 홍보 디자인'}).waitFor({timeout:30000});
  const id = new URL(page.url()).searchParams.get('id');
  const stored=await page.evaluate(id=>JSON.parse(localStorage.getItem('wolgye-mock-v5')).publications.find(p=>p.sourceId===id),id);
  assert.equal(stored.sourceKind,'manual');
  assert.equal(stored.imageUrls.length,2);
  assert.equal(stored.coverUrl,stored.imageUrls[1]);
  assert.equal(stored.sections[0].body,'문제 정의부터 결과물 제작까지 직접 진행했습니다.');
  await page.goto('http://127.0.0.1:3000/me/');
  await page.getByRole('link',{name:'직접 만든 홍보 디자인 포트폴리오 열기'}).waitFor();
  await page.screenshot({path:'C:/Users/xcrui/AppData/Local/Temp/manual-portfolio-feed.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: required photo, cover choice, publication and feed visibility');
} finally {await browser.close();}



