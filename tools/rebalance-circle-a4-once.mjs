import fs from 'node:fs';

const cssFile = 'circle/styles.css';
let css = fs.readFileSync(cssFile, 'utf8');
const start = css.indexOf('/* A4 utilization:');
const printAt = css.indexOf('@media print');
if (start < 0 || printAt < 0 || printAt <= start) {
  throw new Error('Could not locate legacy A4-utilization block');
}
const balanced = `/* A4 vertical balance: distribute real content through the usable sheet height.
   No synthetic end-of-page filler is added. The final real task is pulled down naturally,
   while existing tasks/tables/diagrams share the available vertical space. */
.a4-page{display:flex;flex-direction:column;justify-content:space-between}
.a4-page>*{flex-shrink:0}
.a4-page>.page-header{margin-bottom:0}
.a4-page>.anchor,.a4-page>.page-intro,.a4-page>.task,.a4-page>.coord-grid,.a4-page>.coord-strip,.a4-page>.puzzle-grid{margin-top:0;margin-bottom:0}
`;
css = css.slice(0, start) + balanced + css.slice(printAt);
fs.writeFileSync(cssFile, css);

const qaFile = 'tools/qa-a4-pages.mjs';
let qa = fs.readFileSync(qaFile, 'utf8');
if (!qa.includes('const EXTREME_UNUSED_GAP_PX = 260;')) throw new Error('A4 QA threshold anchor missing');
qa = qa.replace(
  'const EXTREME_UNUSED_GAP_PX = 260;\nconst WARN_UNUSED_GAP_PX = 150;',
  'const EXTREME_UNUSED_GAP_PX = 260;\nconst CIRCLE_MAX_UNUSED_GAP_PX = 120;\nconst WARN_UNUSED_GAP_PX = 90;'
);
const oldFailure = `  if (metrics.unusedGapBeforeFooter > EXTREME_UNUSED_GAP_PX && metrics.usefulChildCount > 0) {\n    failures.push(\`extreme purposeless blank zone \${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer\`);\n  }`;
const newFailure = `  if (book === 'circle' && metrics.unusedGapBeforeFooter > CIRCLE_MAX_UNUSED_GAP_PX && metrics.usefulChildCount > 0) {\n    failures.push(\`circle under-utilized A4: \${metrics.unusedGapBeforeFooter.toFixed(0)}px blank before footer (max \${CIRCLE_MAX_UNUSED_GAP_PX}px)\`);\n  } else if (metrics.unusedGapBeforeFooter > EXTREME_UNUSED_GAP_PX && metrics.usefulChildCount > 0) {\n    failures.push(\`extreme purposeless blank zone \${metrics.unusedGapBeforeFooter.toFixed(0)}px before footer\`);\n  }`;
if (!qa.includes(oldFailure)) throw new Error('A4 QA failure block anchor missing');
qa = qa.replace(oldFailure, newFailure);
qa = qa.replace(
  'A4 browser QA: PASS (126 pages checked for physical size, overflow, page numbers, SVG integrity and extreme blank zones)',
  'A4 browser QA: PASS (126 pages checked for physical size, overflow, page numbers, SVG integrity; circle pages also enforce <=120px unused bottom gap)'
);
fs.writeFileSync(qaFile, qa);

console.log('Rebalanced Circle A4 pages with real vertical distribution and tightened Circle unused-space QA to 120px.');
