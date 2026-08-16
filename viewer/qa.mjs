import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(dir);
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'mobile-scroll.css'), 'utf8');
const rules = fs.readFileSync(path.join(dir, 'VIEWER_RULES.md'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(`Viewer QA failed: ${message}`); };

assert(index.includes('viewer/mobile-scroll.css'), 'mobile scroll stylesheet must be loaded');
assert(index.includes('id="page-jump"'), 'fast page navigation dock is missing');
assert(index.includes('data-topic="cone"') && index.includes('data-topic="circle"') && index.includes('data-topic="cylinder"'), 'all three topic selectors are required');

assert(/cone:\s*\{\s*label:\s*'חרוט',\s*count:\s*46/.test(app), 'cone count must be 46');
assert(/circle:\s*\{\s*label:\s*'מעגל',\s*count:\s*88/.test(app), 'circle count must be 88');
assert(/cylinder:\s*\{\s*label:\s*'גליל',\s*count:\s*38/.test(app), 'cylinder count must be 38');
assert(app.includes('fitFrameToViewport'), 'A4 mobile scale-to-fit function is required');
assert(app.includes('scrollIntoView'), 'page navigation must jump to page boundaries');
assert(app.includes("data-jump=\"prev\"") || app.includes("'[data-jump=\"prev\"]'"), 'previous-page navigation is required');
assert(app.includes("data-jump=\"next\"") || app.includes("'[data-jump=\"next\"]'"), 'next-page navigation is required');

assert(css.includes('--viewer-teal-dark:#06494c'), 'canonical dark turquoise separator color is missing');
assert(/\.ws-page__sheets\{[\s\S]*gap:12px!important/.test(css), 'mobile page separator gap must be 12px');
assert(/\.ws-wsframe\{[\s\S]*width:100vw!important/.test(css), 'mobile A4 wrapper must fill viewport width');
assert(/aspect-ratio:210\/297!important/.test(css), 'mobile wrapper must preserve A4 ratio');
assert(/\.topbar,.sitenav,.hero-section,.site-footer\{display:none!important\}/.test(css), 'mobile viewer must hide non-booklet chrome');
assert(rules.includes('גלילה היא אנכית בלבד') && rules.includes('פס/רווח בצבע טורקיז כהה'), 'viewer source-of-truth must lock vertical scrolling and turquoise separators');

console.log('Viewer QA: PASS (cone/circle/cylinder mobile continuous A4 viewer contract checked)');
