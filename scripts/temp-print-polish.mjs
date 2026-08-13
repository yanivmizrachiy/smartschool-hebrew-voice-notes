import fs from 'node:fs';

function read(p){return fs.readFileSync(p,'utf8')}
function write(p,s){fs.writeFileSync(p,s,'utf8')}
function replaceOne(p, from, to){const s=read(p); if(!s.includes(from)) throw new Error(`${p}: expected source not found`); write(p,s.replace(from,to));}
function appendOnce(p, marker, text){const s=read(p); if(s.includes(marker)) return; write(p,s+text);}

replaceOne('worksheets/styles.css',
`.gz-footer { position:absolute; right:10mm; left:10mm; bottom:4mm; padding-top:3px; border-top:2px solid var(--brand); text-align:center; line-height:1.15; }
.gz-footer .f1 { font-size:11.5px; font-weight:600; color:var(--ink); }
.gz-footer .f2 { font-size:10.2px; color:var(--muted); margin-top:1px; }`,
`.gz-footer {
  position:absolute;
  right:0;
  left:0;
  bottom:3.2mm;
  min-height:10mm;
  padding:2.1mm 21mm 0 10mm;
  border-top:.65px solid color-mix(in srgb,var(--ink) 28%,transparent);
  text-align:center;
  line-height:1.15;
}
.gz-footer::before {
  content:"";
  position:absolute;
  right:10mm;
  top:1.1mm;
  width:8.5mm;
  height:8.5mm;
  background:url("../assets/district-logo.png") center/contain no-repeat;
}
.gz-footer .f1 { font-size:11.2px; font-weight:600; color:var(--ink); }
.gz-footer .f2 { font-size:10px; color:var(--muted); margin-top:1px; }`);

appendOnce('worksheets/styles.css','/* BW-PRINT-MODE */',`

/* BW-PRINT-MODE — מבוסס על מנגנון ?bw=1 מחוברת הזוויות. */
.bw-mode .a4-page {
  --paper:#fff;
  --ink:#000;
  --muted:#333;
  --line:#aaa;
  --soft:#f5f5f5;
  --brand:#222;
  --brand-dark:#111;
  --brand-soft:#ededed;
  --warm:#555;
  --warm-soft:#f5f5f5;
  --figure-fill:#fafafa;
  --green-soft:#f2f2f2;
  --red-soft:#f2f2f2;
  --shadow:none;
  background:#fff;
  color:#000;
}
.bw-mode .header-container { border-bottom-color:#444; }
.bw-mode .header-container::after { background:linear-gradient(90deg,#777,transparent); }
.bw-mode .page-number { background:#222; color:#fff; box-shadow:none; }
.bw-mode .q-card,
.bw-mode .figure-box,
.bw-mode .part-card,
.bw-mode .calc-box,
.bw-mode .mist-card,
.bw-mode .word-bank,
.bw-mode .premium-note { box-shadow:none; background:#fff; border-color:#aaa; }
.bw-mode .q-card h3,
.bw-mode .mist-head,
.bw-mode .work-table th,
.bw-mode .word-bank,
.bw-mode .premium-note,
.bw-mode .sentence-frame { background:#eee; color:#000; border-color:#aaa; }
.bw-mode .choice,
.bw-mode .activity-tag,
.bw-mode .compact-practice { background:#f5f5f5; color:#111; border-color:#999; }
.bw-mode .choice-dot,
.bw-mode .mark-box { border-color:#222; background:#fff; }
.bw-mode .answer-line,
.bw-mode .blank { border-color:#444; }
.bw-mode .draw-box { border-color:#777; background:#fff; }
.bw-mode svg { filter:grayscale(1) contrast(1.12); }
.bw-mode img { filter:grayscale(1) contrast(1.12); }
.bw-mode .gz-footer { border-top-color:#777; }
.bw-mode .gz-footer::before { filter:grayscale(1) contrast(1.15); }
.bw-mode .gz-footer .f1 { color:#111; }
.bw-mode .gz-footer .f2 { color:#333; }
@media print {
  .bw-mode .a4-page { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
}
`);

appendOnce('visual-pages/visual.css','/* VISUAL-BW-AND-FOOTER */',`
/* VISUAL-BW-AND-FOOTER */
.visual-credit{position:relative;min-height:10mm;border-top:.65px solid #7d8794;padding:2mm 12mm 0 20mm}
.visual-credit::before{content:"";position:absolute;right:0;top:1mm;width:8.5mm;height:8.5mm;background:url("../assets/district-logo.png") center/contain no-repeat}
.bw-mode .visual-a4{background:#fff;color:#000}
.bw-mode .visual-head{background:#fff;color:#000;border:1px solid #777}
.bw-mode .visual-head p{color:#333}
.bw-mode .visual-badge{background:#fff;color:#000;border:1px solid #222}
.bw-mode .visual-scene{border-color:#777;box-shadow:none;background:#fff}
.bw-mode .visual-scene>img,.bw-mode [data-image-only="true"]>.image-page-art{filter:grayscale(1) contrast(1.12) brightness(1.03)}
.bw-mode .visual-callout{background:#fff;color:#000;border-color:#777}
.bw-mode .visual-callout.answer{background:#eee;color:#000;border-color:#555}
.bw-mode .visual-callout small{color:#333}
.bw-mode .visual-marker{background:#222;color:#fff;box-shadow:0 0 0 1mm #fff,0 0 0 1.6mm #555}
.bw-mode .visual-credit{border-top-color:#777;color:#111}
.bw-mode .visual-credit::before{filter:grayscale(1) contrast(1.15)}
.bw-mode .visual-credit .v2{color:#333}
`);

replaceOne('print.html',
`    <button id="print-all-button" type="button" disabled>הדפס את כל החוברת</button>`,
`    <div class="print-actions"><a id="bw-toggle" class="mode-link" href="print.html?bw=1">תצוגת שחור־לבן</a><button id="print-all-button" type="button" disabled>הדפס את כל החוברת</button></div>`);

replaceOne('viewer/print.js',
`const printButton = document.querySelector('#print-all-button');`,
`const printButton = document.querySelector('#print-all-button');
const bwToggle = document.querySelector('#bw-toggle');
const bwMode = new URLSearchParams(location.search).get('bw') === '1';
document.body.classList.toggle('bw-mode', bwMode);
if (bwToggle) {
  bwToggle.href = bwMode ? 'print.html' : 'print.html?bw=1';
  bwToggle.textContent = bwMode ? 'תצוגה צבעונית' : 'תצוגת שחור־לבן';
}`);
replaceOne('viewer/print.js',
`    status.textContent = \`\${sequence.length} דפי A4 מוכנים להדפסה · ממוספרים 1–\${sequence.length}\`;`,
`    status.textContent = \`\${sequence.length} דפי A4 מוכנים להדפסה · ממוספרים 1–\${sequence.length}\${bwMode ? ' · שחור־לבן' : ''}\`;`);

appendOnce('viewer/print.css','/* PRINT-MODE-TOGGLE */',`
/* PRINT-MODE-TOGGLE */
.print-actions{display:flex;align-items:center;gap:8px}.mode-link{display:inline-flex;align-items:center;min-height:38px;padding:8px 12px;border:1px solid #64748b;border-radius:9px;color:#fff!important;text-decoration:none;background:#1e293b}.bw-mode .print-toolbar{background:#111}.bw-mode .mode-link{background:#fff;color:#111!important;border-color:#aaa}.bw-mode .print-pages{background:#d8d8d8}
`);

replaceOne('index.html',
`      <button id="print-current" class="btn btn-secondary" type="button">הדפס / שמור PDF</button>`,
`      <button id="print-current" class="btn btn-secondary" type="button">הדפס / שמור PDF</button>
      <button id="print-current-bw" class="btn btn-secondary" type="button">הדפס דף בשחור־לבן</button>`);
replaceOne('index.html',
`      <a class="btn btn-primary" href="print.html" target="_blank" rel="noopener">הדפס את כל החוברת</a>`,
`      <a class="btn btn-primary" href="print.html" target="_blank" rel="noopener">הדפס את כל החוברת</a>
      <a class="btn btn-secondary" href="print.html?bw=1" target="_blank" rel="noopener">כל החוברת בשחור־לבן</a>`);

replaceOne('viewer/app.js',
`const printCurrent = document.querySelector('#print-current');`,
`const printCurrent = document.querySelector('#print-current');
const printCurrentBw = document.querySelector('#print-current-bw');`);
replaceOne('viewer/app.js',
`printCurrent.addEventListener('click', () => {
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
});`,
`function printFrame(bw = false) {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!win) return;
  if (bw) doc?.body.classList.add('bw-mode');
  win.focus();
  win.print();
  if (bw) doc?.body.classList.remove('bw-mode');
}
printCurrent.addEventListener('click', () => printFrame(false));
printCurrentBw?.addEventListener('click', () => printFrame(true));`);

console.log('Applied footer, district logo hooks and reusable black-and-white print mode.');
