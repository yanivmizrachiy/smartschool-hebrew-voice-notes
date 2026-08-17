import fs from 'node:fs';

const tiers = {
  deep: [2,5,9,17,19,20,25,33,34,46,52,53,58,59,62,64,68,69,70,71,73,74,77,83,85],
  medium: [4,14,15,16,18,24,31,32,36,40,42,44,45,49,56,57,60,61,63,65,67,82,84,87,88],
  light: [1,6,22,27,30,37,47,54,66]
};

const all = new Set(Object.values(tiers).flat());
if (all.size !== 59) throw new Error(`Expected 59 unique utilization targets, found ${all.size}`);

for (const [tier, pages] of Object.entries(tiers)) {
  for (const page of pages) {
    const file = `circle/page-${page}.html`;
    let html = fs.readFileSync(file, 'utf8');
    const before = html;
    html = html.replace(/<main class="([^"]*\ba4-page\b[^"]*)">/, (match, classes) => {
      const parts = classes.split(/\s+/).filter(Boolean).filter(c => !/^util-(?:light|medium|deep)$/.test(c));
      parts.push(`util-${tier}`);
      return `<main class="${parts.join(' ')}">`;
    });
    if (html === before) throw new Error(`${file}: could not inject utilization tier`);
    fs.writeFileSync(file, html);
  }
}

const cssFile = 'circle/styles.css';
let css = fs.readFileSync(cssFile, 'utf8');
const marker = '/* BEGIN measured circle A4 utilization tiers */';
if (css.includes(marker)) css = css.slice(0, css.indexOf(marker)).trimEnd() + '\n';
css += `\n${marker}
/* These tiers are assigned only to pages measured by real Chrome QA with >150px unused vertical space. */
.a4-page.util-light{--u-task:4.8mm;--u-cell-y:2.8mm;--u-empty:12mm;--u-answer:14mm;--u-answer-tall:25mm;--u-card-pad:3mm;--u-choice-y:2.5mm;--u-visual-min:45mm;--u-visual-svg:30mm;--u-coord-max:86mm;--u-coord-compact:62mm}
.a4-page.util-medium{--u-task:5.7mm;--u-cell-y:3.3mm;--u-empty:14mm;--u-answer:17mm;--u-answer-tall:30mm;--u-card-pad:3.5mm;--u-choice-y:3.1mm;--u-visual-min:49mm;--u-visual-svg:34mm;--u-coord-max:94mm;--u-coord-compact:69mm}
.a4-page.util-deep{--u-task:6.6mm;--u-cell-y:3.9mm;--u-empty:16mm;--u-answer:20mm;--u-answer-tall:35mm;--u-card-pad:4mm;--u-choice-y:3.7mm;--u-visual-min:54mm;--u-visual-svg:39mm;--u-coord-max:103mm;--u-coord-compact:77mm}
.a4-page.util-light .task,.a4-page.util-medium .task,.a4-page.util-deep .task{margin:var(--u-task) 0}
.a4-page.util-light .work-table th,.a4-page.util-light .work-table td,.a4-page.util-medium .work-table th,.a4-page.util-medium .work-table td,.a4-page.util-deep .work-table th,.a4-page.util-deep .work-table td{padding-top:var(--u-cell-y);padding-bottom:var(--u-cell-y)}
.a4-page.util-light .work-table td:empty,.a4-page.util-medium .work-table td:empty,.a4-page.util-deep .work-table td:empty{height:var(--u-empty)}
.a4-page.util-light .answer-line,.a4-page.util-medium .answer-line,.a4-page.util-deep .answer-line{height:calc(7mm + (var(--u-answer) - 12mm)/2)}
.a4-page.util-light .answer-box,.a4-page.util-medium .answer-box,.a4-page.util-deep .answer-box{min-height:var(--u-answer)}
.a4-page.util-light .answer-box.tall,.a4-page.util-medium .answer-box.tall,.a4-page.util-deep .answer-box.tall{min-height:var(--u-answer-tall)}
.a4-page.util-light .choice-row,.a4-page.util-medium .choice-row,.a4-page.util-deep .choice-row{padding-top:var(--u-choice-y);padding-bottom:var(--u-choice-y)}
.a4-page.util-light .choice-box,.a4-page.util-medium .choice-box,.a4-page.util-deep .choice-box{padding-top:var(--u-card-pad);padding-bottom:var(--u-card-pad)}
.a4-page.util-light .visual-card,.a4-page.util-medium .visual-card,.a4-page.util-deep .visual-card{min-height:var(--u-visual-min)}
.a4-page.util-light .visual-card svg,.a4-page.util-medium .visual-card svg,.a4-page.util-deep .visual-card svg{height:var(--u-visual-svg)}
.a4-page.util-light .coord-card svg,.a4-page.util-medium .coord-card svg,.a4-page.util-deep .coord-card svg{max-height:var(--u-coord-max)}
.a4-page.util-light .coord-card.compact svg,.a4-page.util-medium .coord-card.compact svg,.a4-page.util-deep .coord-card.compact svg{max-height:var(--u-coord-compact)}
.a4-page.util-light .puzzle-card,.a4-page.util-medium .puzzle-card,.a4-page.util-deep .puzzle-card{padding-top:var(--u-card-pad);padding-bottom:var(--u-card-pad)}
.a4-page.util-light .anchor,.a4-page.util-medium .anchor,.a4-page.util-deep .anchor{padding-top:calc(3mm + (var(--u-task) - 4mm)/3);padding-bottom:calc(3mm + (var(--u-task) - 4mm)/3)}
/* Coordinate-heavy pages use the recovered area for larger grids rather than artificial filler. */
.a4-page.util-deep .coord-grid{gap:3.2mm}
.a4-page.util-medium .coord-grid{gap:2.8mm}
/* Calculation-heavy pages that still have room get additional writable height inside existing response cells/boxes only. */
/* END measured circle A4 utilization tiers */
`;
fs.writeFileSync(cssFile, css);

const qaFile = 'tools/qa-a4-pages.mjs';
let qa = fs.readFileSync(qaFile, 'utf8');
const old = '  if (metrics.unusedGapBeforeFooter > EXTREME_UNUSED_GAP_PX && metrics.usefulChildCount > 0) {';
const replacement = "  const unusedGapLimit = book === 'circle' ? WARN_UNUSED_GAP_PX : EXTREME_UNUSED_GAP_PX;\n  if (metrics.unusedGapBeforeFooter > unusedGapLimit && metrics.usefulChildCount > 0) {";
if (!qa.includes(old)) throw new Error('A4 utilization threshold anchor not found');
qa = qa.replace(old, replacement);
qa = qa.replace('extreme purposeless blank zone ${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer', 'purposeless blank zone ${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer (limit ${unusedGapLimit}px)');
fs.writeFileSync(qaFile, qa);

console.log('Applied measured A4 utilization tiers to 59 circle pages and hardened Circle blank-space QA to 150px.');
