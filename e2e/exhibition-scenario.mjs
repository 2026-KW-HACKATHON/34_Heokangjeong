import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${BASE}/me/`);await page.evaluate(()=>localStorage.setItem('wolgye-user','s1'));
 await page.goto(`${BASE}/portfolio/view/?id=demo-menu-2&s=s1&view=web`);
 const frame=page.frameLocator('iframe').first();await frame.locator('.strip').first().waitFor({timeout:60000});await page.waitForTimeout(1800);
 assert.equal(await frame.locator('.strip').count(),9);
 assert.equal(await frame.locator('body').evaluate(()=>{try{void parent.document.body;return false;}catch{return true;}}),true,'iframe must isolate parent DOM');
 assert(await frame.locator('.strip img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)));
 await frame.locator('.strip').nth(8).click();await page.waitForTimeout(1800);
 console.log('Verification',await frame.locator('#c-text').innerText());
 await page.screenshot({path:'prototype/exhibition-stack/shots/app-pc-verification.png'});
 await frame.locator('#btn-back').click();await page.waitForTimeout(1400);
 await page.screenshot({path:'prototype/exhibition-stack/shots/app-pc-list.png'});
 await page.getByRole('button',{name:'HTML 다운로드',exact:true}).waitFor();
 const button=page.getByRole('button',{name:'HTML 다운로드',exact:true});await button.waitFor({state:'visible'});
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='HTML 다운로드')?.disabled,{timeout:30000});
 const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);mkdirSync('outputs/exhibition',{recursive:true});await download.saveAs('outputs/exhibition/menu-exhibition.html');
 const offline=await browser.newPage();offline.on('pageerror',e=>errors.push(e.message));await offline.route('http**/*',r=>r.abort());
 await offline.goto(new URL('outputs/exhibition/menu-exhibition.html',`file:///${process.cwd().replaceAll('\\','/')}/`).href);
 await offline.locator('.strip').first().waitFor();await offline.waitForTimeout(1000);
 assert(await offline.locator('.strip img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)));
 console.log('ERRORS',errors);if(errors.length)process.exitCode=1;
}finally{await browser.close();}
