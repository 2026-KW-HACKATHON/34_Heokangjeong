import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const p=await browser.newPage();await p.goto('http://localhost:3002/me/');await p.evaluate(()=>localStorage.setItem('wolgye-user','s1'));
for(const width of [958,390]){
await p.setViewportSize({width,height:884});await p.goto('http://localhost:3002/portfolio/templates/?id=demo-menu-2');await p.getByRole('option',{name:'인터랙티브 전시',exact:true}).waitFor();await p.waitForTimeout(600);
async function verify(i){const options=p.getByRole('option');assert.equal(await options.nth(i).getAttribute('aria-selected'),'true');const nearest=await p.locator('.pf-picker').evaluate(el=>{const r=el.getBoundingClientRect(),mid=r.left+r.width/2;return [...el.children].map((c,i)=>({i,d:Math.abs(c.getBoundingClientRect().left+c.getBoundingClientRect().width/2-mid)})).sort((a,b)=>a.d-b.d)[0].i});assert.equal(nearest,i);}
await verify(2);
for(let loop=0;loop<3;loop++){for(let i=1;i>=0;i--){await p.getByRole('button',{name:'이전 디자인',exact:true}).click();await p.waitForTimeout(700);await verify(i);}for(let i=1;i<=2;i++){await p.getByRole('button',{name:'다음 디자인',exact:true}).click();await p.waitForTimeout(700);await verify(i);}}
await p.getByRole('button',{name:'이전 디자인'}).click();await p.waitForTimeout(70);await p.getByRole('button',{name:'이전 디자인'}).click();await p.waitForTimeout(800);await verify(0);
console.log(`PASS picker ${width}px: repeated and rapid navigation, selected matches visible`);
}
}finally{await browser.close()}
