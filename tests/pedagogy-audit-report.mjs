import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const wb = JSON.parse(fs.readFileSync(path.join(root,'content/workbook.json'),'utf8'));
const strip = s => s.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<svg[\s\S]*?<\/svg>/gi,' [שרטוט] ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const vague = /(מה עזר|מה באמת|מה השתנה|מה לא מספיק|כתבו מדוע|הסבירו בקצרה|הסבירו מדוע|מה אתם חושבים|חקרו|נסו להסביר|מה ניתן לומר|איזו תכונה)/;
for (const page of wb.pages) {
  const file = path.join(root,'worksheets',`${page.slug}.html`);
  const html = fs.readFileSync(file,'utf8');
  const cards = [...html.matchAll(/<section class="q-card[^>]*">([\s\S]*?)<\/section>/g)].map(m=>m[1]);
  console.log(`\n===== PAGE ${page.id}: ${page.title} =====`);
  cards.forEach((card,i)=>{
    const h3 = strip((card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)||[])[1]||'');
    const text = strip(card);
    const hasSvg = /<svg\b/i.test(card);
    const coneExplicit = /חרוט|קודקוד|מעטפת|יוצר|בסיס החרוט|גזרת עיגול|חתך צירי/i.test(text) || /aria-label="[^"]*חרוט/i.test(card);
    const flag = vague.test(text) || (!coneExplicit && hasSvg) ? '  << REVIEW' : '';
    console.log(`${i+1}. [${hasSvg?'SVG':'NO-SVG'} | ${coneExplicit?'CONE':'CONTEXT'}] ${h3}${flag}`);
    console.log(`   ${text.slice(0,850)}`);
  });
}
