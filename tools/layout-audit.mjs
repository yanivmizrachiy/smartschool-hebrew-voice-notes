import fs from 'node:fs';
import { chromium } from 'playwright';
const wb=JSON.parse(fs.readFileSync('content/workbook.json','utf8'));
const ws=new Map(wb.pages.map(p=>[p.id,p]));
const vs=new Map((wb.visualPages||[]).map(p=>[p.slug,p]));
const seq=wb.printSequence;
fs.mkdirSync('qa/layout-pages',{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1100,height:1600}});
await page.emulateMedia({media:'print'});
const rows=[];
for(let i=0;i<seq.length;i++){
  const e=seq[i];
  const meta=e.kind==='worksheet'?ws.get(e.id):vs.get(e.slug);
  const url=e.kind==='worksheet'?`http://127.0.0.1:4173/worksheets/${meta.slug}.html`:`http://127.0.0.1:4173/visual-pages/${meta.slug}.html`;
  await page.goto(url,{waitUntil:'networkidle'});
  const m=await page.evaluate(()=>{
    const a=document.querySelector('.a4-page');
    const f=a.querySelector('.gz-footer');
    const c=a.querySelector('.sheet-content');
    const ar=a.getBoundingClientRect();
    const fr=f&&getComputedStyle(f).display!=='none'?f.getBoundingClientRect():null;
    const cr=c?c.getBoundingClientRect():ar;
    const usableBottom=fr?fr.top-4:ar.bottom-12;
    const blank=Math.max(0,usableBottom-cr.bottom);
    return {blankMm:blank*25.4/96,util:Math.min(100,100*(cr.bottom-ar.top)/(usableBottom-ar.top)),overflow:a.scrollHeight>a.clientHeight+2,imageOnly:a.matches('[data-image-only="true"]')};
  });
  const status=m.imageOnly?'visual':m.overflow?'overflow':m.blankMm>=35?'underused':m.blankMm>=22?'review':'balanced';
  rows.push({page:i+1,kind:e.kind,id:e.id||e.slug,title:meta.title,status,blankMm:+m.blankMm.toFixed(1),util:+m.util.toFixed(1)});
  await page.locator('.a4-page').screenshot({path:`qa/layout-pages/${String(i+1).padStart(2,'0')}.png`});
}
await browser.close();
fs.writeFileSync('qa/layout-report.json',JSON.stringify(rows,null,2));
fs.writeFileSync('qa/layout-report.md','# ביקורת ניצול שטח — 46 עמודים\n\n|עמוד|סוג|מזהה|סטטוס|ריק תחתון מ״מ|ניצול|\n|---:|---|---|---|---:|---:|\n'+rows.map(r=>`|${r.page}|${r.kind}|${r.id}|${r.status}|${r.blankMm}|${r.util}%|`).join('\n'));
console.log(rows.map(r=>`${r.page}\t${r.status}\t${r.blankMm}mm\t${r.util}%`).join('\n'));
