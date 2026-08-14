import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'viewer', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'viewer', 'viewer.css'), 'utf8');
const logo = fs.readFileSync(path.join(root, 'viewer', 'logo-motion.css'), 'utf8');
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content', 'workbook.json'), 'utf8'));

const expected = workbook.printSheetCount || workbook.printSequence?.length || 0;
const errors = [];
const requireMatch = (condition, message) => { if (!condition) errors.push(message); };

requireMatch(expected === 46, `expected 46 workbook sheets, found ${expected}`);
requireMatch(index.includes('id="booklet-sheets"'), 'home must expose one continuous booklet sheets container');
requireMatch(index.includes('class="wsbar"'), 'home must use the Zaviyot-style single booklet toolbar');
requireMatch(index.includes('id="bw-toggle"'), 'booklet toolbar must provide the black-and-white toggle');
requireMatch(index.includes('id="print-booklet"'), 'booklet toolbar must provide whole-booklet printing');

for (const legacy of ['worksheet-frame', 'page-picker', 'prev-page', 'next-page', 'page-grid', 'page-catalog']) {
  requireMatch(!index.includes(legacy), `legacy one-page viewer control must be removed: ${legacy}`);
}

requireMatch(app.includes("frameWrap.className = 'ws-wsframe'"), 'viewer must render each workbook entry as a continuous ws-wsframe');
requireMatch(app.includes("frame.className = 'ws-sheet-frame'"), 'viewer must render each sheet inside the continuous frame');
requireMatch(app.includes("kindLabel: 'דף עבודה'"), 'viewer must retain local worksheet labeling contract');
requireMatch(app.includes('עמוד ${entry.sequence}'), 'viewer must label pages by local sequence only');
requireMatch(app.includes("printBooklet.addEventListener('click', () => window.print())"), 'booklet print action must print the continuous booklet');

requireMatch(/\.ws-page\{[^}]*background:#eef1f6;[^}]*padding:0 16px 40px/i.test(css), 'Zaviyot parity: ws-page background/padding must match');
requireMatch(/\.ws-page__sheets\{[^}]*flex-direction:column;[^}]*gap:28px;[^}]*padding-top:24px/i.test(css), 'Zaviyot parity: continuous sheet spacing must be 28px with 24px top padding');
requireMatch(/\.ws-wsframe\{[^}]*width:min\(860px,100%\);[^}]*aspect-ratio:210\/297/i.test(css), 'Zaviyot parity: sheet frame must use 860px max width and A4 ratio');
requireMatch(/\.ws-wsnum\{[^}]*bottom:8px;[^}]*left:12px;[^}]*font-size:11\.5px/i.test(css), 'Zaviyot parity: page badge geometry must match');
requireMatch(/\.wsbar\{[^}]*position:sticky;[^}]*background:var\(--ink\)/i.test(css), 'booklet toolbar must remain sticky and use the cone dark-pink ink token');
requireMatch(css.includes('--ink:#64143f'), 'cone theme must use dark pink instead of Zaviyot navy');

requireMatch(/animation:topbar-logo-turn 14s linear infinite/.test(logo), 'logo must rotate continuously every 14 seconds');
requireMatch(/prefers-reduced-motion:reduce/.test(logo) && /animation:none/.test(logo), 'logo motion must respect reduced-motion preference');

if (errors.length) {
  console.error(`Site parity failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('OK: cone site matches the Zaviyot continuous-booklet presentation, with dark-pink theme and 14s continuous logo rotation.');
