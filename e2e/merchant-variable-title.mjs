import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.E2E_BASE_URL || 'http://localhost:3002';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(base+'/login/');
 await page.evaluate(()=>{sessionStorage.setItem('wolgye-demo-enabled','true');sessionStorage.setItem('wolgye-demo-tab-user','r7');sessionStorage.setItem('wolgye-demo-tour',JSON.stringify({role:'merchant',step:1}))});
 await page.goto(base+'/posts/new/');
 // Gemini의 가변 제목과 사용자의 직접 수정을 함께 재현한다.
 await page.getByPlaceholder('월계 미용실 시술 안내 포스터',{exact:true}).fill('새 시술 안내판과 인스타그램 이미지 디자인');
 await page.locator('[data-demo-tour="post-submit"]').click();
 await page.getByRole('heading',{name:'공고 등록 완료',exact:true}).waitFor();
 await page.getByRole('button',{name:'다음',exact:true}).click();
 await page.getByRole('heading',{name:'지원자 비교',exact:true}).waitFor();
 await page.getByRole('heading',{name:'지원자 2명',exact:true}).waitFor();
 await page.getByRole('button',{name:'다음',exact:true}).click();
 await page.getByRole('heading',{name:'학생 선정하기',exact:true}).waitFor();
 await page.locator('[data-demo-tour="merchant-select"]').click();
 await page.waitForURL(/\/chats\/room/);
 await page.getByRole('heading',{name:'양쪽이 확인하는 계약서',exact:true}).waitFor();
 await page.locator('[data-demo-tour="agreement"]').click();
 const d=page.locator('.agreement-dialog');
 await d.getByLabel('작업 계약서 체험 안내',{exact:true}).waitFor();
 assert.match(await d.getByLabel('작업 계약서 체험 안내',{exact:true}).innerText(),/Gemini 요약/);
 assert.equal(await d.locator('.agreement-support').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.equal(await d.getByRole('button',{name:'다음',exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
 assert.equal(await d.getByRole('button',{name:'이전',exact:true}).evaluate(e=>getComputedStyle(e).outlineStyle),'none');
 assert.match(await d.getByLabel('작업 범위',{exact:true}).inputValue(),/A3 포스터/);
 for(let n=0;n<3;n++) { await d.getByRole('button',{name:'다음',exact:true}).click(); assert.match(await d.getByLabel('작업 계약서 체험 안내',{exact:true}).innerText(),new RegExp(`${n+2}/4`)); }
 await d.getByRole('button',{name:'저장하고 양쪽 확인받기',exact:true}).click();
 await d.getByText('마지막 · 양쪽 확인',{exact:true}).waitFor();
 await d.getByRole('button',{name:'이 버전 최종 확인',exact:true}).click();
 await d.getByRole('heading',{name:'우리의 계약이 확정됐어요',exact:true}).waitFor();
 await d.getByText('계약서 체험 완료',{exact:true}).waitFor();
 await page.screenshot({path:'outputs/agreement-tutorial-complete.png'});
 await d.getByRole('button',{name:'계약서 닫기',exact:true}).click();
 await page.getByRole('heading',{name:'상인 흐름 완료',exact:true}).waitFor();
 await page.getByRole('button',{name:'완료',exact:true}).click();
 await page.getByRole('dialog',{name:'튜토리얼 완료',exact:true}).waitFor();
 await page.getByText(/상인 입장에서 Gemini 공고 작성/).waitFor();
 await page.waitForURL(base+'/');
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('wolgye-demo-tour')),null);
 await page.getByRole('button',{name:'자유롭게 둘러보기',exact:true}).click();
 await page.getByRole('dialog',{name:'튜토리얼 완료',exact:true}).waitFor({state:'hidden'});
 await page.screenshot({path:'outputs/merchant-flow-complete.png'});
 console.log('PASS variable title: create → compare two applicants → select → chat → confirm both → finish');
} finally {await browser.close()}
