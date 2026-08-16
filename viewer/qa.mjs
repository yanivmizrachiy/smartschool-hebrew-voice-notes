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
assert(app.includes('ensureAllFramesLoaded'), 'printing must explicitly load every workbook iframe first');
assert(app.includes('printPreparedBooklet'), 'print action must use a prepared all-pages workflow');
assert(app.includes('prepareFramesForPrint'), 'print must neutralize mobile scale before A4 output');
assert(app.includes("addEventListener('beforeprint', prepareFramesForPrint)"), 'beforeprint guard is required');
assert(app.includes("addEventListener('afterprint', restoreFramesAfterPrint)"), 'afterprint mobile-scale restore is required');
assert(app.includes("matchMedia?.('(prefers-reduced-motion: reduce)')"), 'reduced-motion preference must be read by navigation logic');
assert(app.includes('document.elementFromPoint'), 'current-page detection must use constant-time viewport hit testing');
assert(!/function detectCurrentSheet\(\)[\s\S]{0,500}querySelectorAll\('\.ws-wsframe'\)/.test(app), 'current-page detection must not scan every worksheet frame on each scroll');
assert(app.includes('sessionStorage.setItem') && app.includes('sessionStorage.getItem'), 'viewer must remember the last page per topic during the session');
assert(app.includes('scrollIntoView'), 'page navigation must jump to page boundaries');
assert(app.includes("data-jump=\"prev\"") || app.includes("'[data-jump=\"prev\"]'"), 'previous-page navigation is required');
assert(app.includes("data-jump=\"next\"") || app.includes("'[data-jump=\"next\"]'"), 'next-page navigation is required');

assert(css.includes('--viewer-teal-dark:#06494c'), 'canonical dark turquoise separator color is missing');
assert(/\.ws-page__sheets\{[\s\S]*gap:12px!important/.test(css), 'mobile page separator gap must be 12px');
assert(/\.ws-wsframe\{[\s\S]*width:100vw!important/.test(css), 'mobile A4 wrapper must fill viewport width');
assert(/aspect-ratio:210\/297!important/.test(css), 'mobile wrapper must preserve A4 ratio');
assert(css.includes('content-visibility:auto'), 'offscreen mobile pages must use content-visibility for long-workbook performance');
assert(/\.ws-sheet-frame\{[\s\S]*pointer-events:none!important/.test(css), 'mobile iframe must not trap touch scrolling');
assert(/\.page-jump__btn\{[\s\S]*width:44px;[\s\S]*height:44px;/.test(css), 'navigation touch targets must be at least 44×44px');
assert(/\.page-jump__btn--main\{[\s\S]*width:48px;[\s\S]*height:48px;/.test(css), 'primary next/previous touch targets must be 48×48px');
assert(/\.wsbar__topics \.btn\{[\s\S]*min-width:44px!important;[\s\S]*min-height:44px!important/.test(css), 'topic selector touch targets must be at least 44×44px');
assert(css.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion CSS contract is required');
assert(/max-width:1024px[^\n]*hover:none[^\n]*pointer:coarse/.test(css), 'touch-device landscape mode up to 1024px must retain mobile workbook layout');
assert(/@media print\{[\s\S]*content-visibility:visible!important/.test(css), 'print must force all workbook pages visible');
assert(/\.topbar,.sitenav,.hero-section,.site-footer\{display:none!important\}/.test(css), 'mobile viewer must hide non-booklet chrome');

assert(rules.includes('גלילה היא אנכית בלבד') && rules.includes('פס/רווח בצבע טורקיז כהה'), 'viewer source-of-truth must lock vertical scrolling and turquoise separators');
assert(rules.includes('זוכר את הדף האחרון') && rules.includes('content-visibility'), 'viewer source-of-truth must lock position memory and offscreen rendering policy');
assert(rules.includes('44') && rules.includes('reduced-motion'), 'viewer source-of-truth must lock accessible touch targets and reduced motion');

console.log('Viewer QA: PASS (three-topic A4 viewer, touch portrait/landscape, 44px accessibility, reduced motion, fast navigation, position memory, offscreen rendering and all-pages print preparation checked)');
