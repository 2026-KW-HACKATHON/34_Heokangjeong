import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.E2E_BASE_URL || 'http://localhost:3002';
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  const a=await browser.newContext(), b=await browser.newContext();
  const p=await a.newPage(), other=await b.newPage();
  for(const page of [p,other]) { await page.goto(base+'/login/'); await page.evaluate(()=>{sessionStorage.setItem('wolgye-demo-enabled','true');sessionStorage.setItem('wolgye-demo-tab-user','s1');sessionStorage.removeItem('wolgye-demo-tour')}); await page.goto(base+'/portfolio/view/?id=demo-menu-2&s=s1');await page.getByRole('button',{name:'링크 공유',exact:true}).waitFor(); }
  await p.evaluate(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.__shared=text}},configurable:true})});
  await p.getByRole('button',{name:'링크 공유',exact:true}).click();await p.waitForFunction(()=>window.__shared);
  const shared=await p.evaluate(()=>window.__shared); assert(shared.includes('/portfolio/shared/#v1='));
  const beforeOther=await other.evaluate(()=>localStorage.getItem('wolgye-mock-v5'));
  await p.evaluate(()=>{const data=JSON.parse(localStorage.getItem('wolgye-mock-v5'));data.db.posts[0].title='RESET TEST';localStorage.setItem('wolgye-mock-v5',JSON.stringify(data));localStorage.setItem('wolgye-demo-pf-edit:test','draft');localStorage.setItem('wolgye-pf-edit:real:test','REAL DRAFT')});
  await p.goto(base+'/login/');await p.getByRole('button',{name:/학생으로 체험/}).click();await p.waitForURL(base+'/');
  assert.equal(await p.evaluate(()=>localStorage.getItem('wolgye-demo-pf-edit:test')),null);
  assert.equal(await p.evaluate(()=>localStorage.getItem('wolgye-pf-edit:real:test')),'REAL DRAFT');
  assert(!await p.evaluate(()=>localStorage.getItem('wolgye-mock-v5').includes('RESET TEST')));
  assert.equal(await other.evaluate(()=>localStorage.getItem('wolgye-mock-v5')),beforeOther);
  await p.reload();assert(await p.evaluate(()=>localStorage.getItem('wolgye-mock-v5')));
  const receiver=await browser.newContext();const r=await receiver.newPage();r.on('pageerror', e=>{throw e});await r.goto(shared);await r.locator('iframe').waitFor();await r.frameLocator('iframe').locator('#stack > *').first().waitFor({timeout:15000});
  assert(r.url().includes('/portfolio/shared/'));assert.equal(await r.getByRole('navigation',{name:'주 메뉴'}).count(),0);
  await r.screenshot({path:'outputs/share-without-login.png'});
  await p.evaluate(()=>{sessionStorage.setItem('wolgye-demo-tab-user','r7');sessionStorage.removeItem('wolgye-demo-tour')});await p.goto(base+'/posts/new/');assert((await p.getByLabel('가게 고민').inputValue()).includes('커트 1회 이용권'));await p.getByRole('button',{name:'Gemini 요약',exact:true}).waitFor();
  console.log('PASS shared original HTML without login, persists after reset, separate browsers isolated, real draft retained, demo prefilled');
}finally{await browser.close()}
