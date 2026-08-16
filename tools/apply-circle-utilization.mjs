import fs from 'node:fs';

const cssFile = 'circle/styles.css';
const qaFile = 'tools/qa-a4-pages.mjs';

const deep = [2,5,9,17,19,20,25,33,34,46,52,53,58,59,62,64,68,69,70,71,73,74,77,83,85];
const medium = [4,14,15,16,18,24,31,32,36,40,42,44,45,49,56,57,60,61,63,65,67,82,84,87,88];
const light = [1,6,22,27,30,37,47,54,66];
const all = [...new Set([...deep, ...medium, ...light])].sort((a,b)=>a-b);
const coord = all.filter(n => n >= 71);
const calc = all.filter(n => n < 71);
const sel = nums => nums.map(n => `.a4-page:has(.page-number[aria-label="עמוד ${n}"])`).join(',');
const renderSel = nums => nums.map(n => `.a4-page:has(.page-number[aria-label="עמוד ${n}"]) .task:last-of-type .task-body::after`).join(',');

let css = fs.readFileSync(cssFile, 'utf8');
const marker = '/* measured-circle-utilization-v2 */';
if (css.includes(marker)) throw new Error('Measured utilization block already exists');
css += `\n\n${marker}\n`;
css += `${sel(deep)}{--a4-work-extra:34mm}\n`;
css += `${sel(medium)}{--a4-work-extra:24mm}\n`;
css += `${sel(light)}{--a4-work-extra:14mm}\n`;
css += `${renderSel(calc)}{content:"מרחב עבודה";display:block;height:var(--a4-work-extra);margin-top:3mm;border:1px dashed #cbd5e1;border-radius:2.5mm;padding:2mm 3mm;color:#64748b;font-size:11px;font-weight:500;background:repeating-linear-gradient(to bottom,#fff 0,#fff 7.5mm,#e2e8f0 7.5mm,#e2e8f0 7.8mm)}\n`;
css += `${renderSel(coord)}{content:"מרחב סימון / חישוב";display:block;height:var(--a4-work-extra);margin-top:3mm;border:1px dashed #cbd5e1;border-radius:2.5mm;padding:2mm 3mm;color:#64748b;font-size:11px;font-weight:500;background:repeating-linear-gradient(to bottom,#fff 0,#fff 7.5mm,#e2e8f0 7.5mm,#e2e8f0 7.8mm)}\n`;
css += `/* More useful response room on measured under-filled pages, without shrinking text. */\n`;
css += `${sel(all)} .answer-box{min-height:16mm}\n`;
css += `${sel(all)} .work-table td:empty{height:12mm}\n`;
fs.writeFileSync(cssFile, css);

let qa = fs.readFileSync(qaFile, 'utf8');
if (!qa.includes('const EXTREME_UNUSED_GAP_PX = 260;')) throw new Error('A4 QA threshold anchor not found');
qa = qa.replace('const EXTREME_UNUSED_GAP_PX = 260;', 'const EXTREME_UNUSED_GAP_PX = { circle: 150, cylinder: 260 };');
qa = qa.replace('if (metrics.unusedGapBeforeFooter > EXTREME_UNUSED_GAP_PX && metrics.usefulChildCount > 0) {', 'if (metrics.unusedGapBeforeFooter > EXTREME_UNUSED_GAP_PX[book] && metrics.usefulChildCount > 0) {');
qa = qa.replace('extreme purposeless blank zone', 'purposeless blank zone above workbook threshold');
fs.writeFileSync(qaFile, qa);

console.log(`Applied measured A4 utilization to ${all.length} circle pages; circle blank-space fail threshold hardened to 150px.`);
