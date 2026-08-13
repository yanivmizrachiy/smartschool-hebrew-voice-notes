import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const wb=JSON.parse(fs.readFileSync('content/workbook.json','utf8'));
const ws=new Map(wb.pages.map(p=>[p.id,p]));
const vs=new Map((wb.visualPages||[]).map(p=>[p.slug,p]));
fs.mkdirSync('qa/layout-pages',{recursive:true});
for(let i=0;i<wb.printSequence.length;i++){
  const e=wb.printSequence[i];
  const p=e.kind==='worksheet'?ws.get(e.id):vs.get(e.slug);
  const rel=e.kind==='worksheet'?`worksheets/${p.slug}.html`:`visual-pages/${p.slug}.html`;
  const out=`qa/layout-pages/${String(i+1).padStart(2,'0')}-${p.slug}.png`;
  const args=['--headless=new','--hide-scrollbars','--disable-gpu','--no-sandbox','--force-device-scale-factor=1','--window-size=794,1123',`--screenshot=${out}`,`http://127.0.0.1:4173/${rel}`];
  const r=spawnSync('google-chrome',args,{encoding:'utf8'});
  if(r.status!==0) throw new Error(`Chrome failed on page ${i+1}: ${r.stderr}`);
  console.log(`${i+1}/46 ${rel}`);
}
