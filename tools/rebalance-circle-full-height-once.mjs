import fs from 'node:fs';

const stylesFile = 'circle/styles.css';
let styles = fs.readFileSync(stylesFile, 'utf8');
const legacyStart = styles.indexOf('/* A4 utilization:');
const printStart = styles.indexOf('@media print');
if (legacyStart >= 0 && printStart > legacyStart) {
  styles = styles.slice(0, legacyStart) + styles.slice(printStart);
}
fs.writeFileSync(stylesFile, styles);

const utilFile = 'circle/a4-utilization.css';
let util = fs.readFileSync(utilFile, 'utf8');
const marker = '/* Full-height vertical balance — canonical */';
if (!util.includes(marker)) {
  util += `\n\n${marker}\n/*\n  The sheet itself distributes genuine worksheet blocks through the usable A4 height.\n  This removes the visually empty bottom band without inventing questions or filler.\n  Existing per-page profiles still enlarge real diagrams/tables/answer surfaces where useful.\n*/\n.a4-page{display:flex;flex-direction:column;justify-content:space-between}\n.a4-page>*{flex-shrink:0}\n.a4-page>:last-child{margin-bottom:0!important}\n`;
}
fs.writeFileSync(utilFile, util);

const qaFile = 'tools/qa-a4-pages.mjs';
let qa = fs.readFileSync(qaFile, 'utf8');
const before = qa;
qa = qa.replace(
  /const UNUSED_GAP_LIMIT_PX = Object\.freeze\(\{ circle: \d+, cylinder: 260 \}\);/,
  'const UNUSED_GAP_LIMIT_PX = Object.freeze({ circle: 60, cylinder: 260 });'
);
qa = qa.replace(/const WARN_UNUSED_GAP_PX = \d+;/, 'const WARN_UNUSED_GAP_PX = 60;');
if (qa === before) throw new Error('A4 QA threshold anchors were not updated');
fs.writeFileSync(qaFile, qa);

console.log('Circle full-height balance applied; legacy end filler removed; bottom unused-gap limit tightened to 60px.');
