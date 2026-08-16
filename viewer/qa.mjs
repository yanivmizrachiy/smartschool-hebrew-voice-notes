import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(dir);
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(dir, 'bootstrap.js'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'mobile-scroll.css'), 'utf8');
const homeCss = fs.readFileSync(path.join(dir, 'home.css'), 'utf8');
const rules = fs.readFileSync(path.join(dir, 'VIEWER_RULES.md'), 'utf8');
const assert = (condition, message) => { if (!condition) throw new Error(`Viewer QA failed: ${message}`); };

// Shared-home contract: root is a three-workbook catalog, never an implicit cone booklet.
assert(index.includes('viewer/bootstrap.js'), 'bootstrap entrypoint must control home versus workbook mode');
assert(!index.includes('src="viewer/app.js"'), 'root HTML must not eagerly load the cone-capable workbook app');
assert(index.includes('id="library"') && index.includes('id="home-hero"'), 'shared home catalog and hero are required');
assert(index.includes('מעגל · גליל · חרוט'), 'shared project title must name all three topics');
assert(index.includes('88 דפי A4') && index.includes('38 דפי A4') && index.includes('46 דפי A4'), 'home must show the verified page counts');
assert(index.includes('172 דפי A4'), 'home must show the verified total page count');
assert(index.includes('?topic=circle&sheet=1#workbook') && index.includes('?topic=cylinder&sheet=1#workbook') && index.includes('?topic=cone&sheet=1#workbook'), 'each home card must open page 1 of its own booklet');
assert(!index.includes('כל הנושאים במקום אחד'), 'generic/demo-like home heading must not return');
assert(bootstrap.includes("new Set(['circle', 'cylinder', 'cone'])"), 'bootstrap must whitelist exactly the three workbook topics');
assert(bootstrap.includes("await import('./app.js')"), 'workbook app must load only after a valid topic is selected');
assert(bootstrap.includes("classList.add('is-home')") && bootstrap.includes("classList.add('has-topic')"), 'home and workbook modes must be explicit');
assert(homeCss.includes('body.is-home .hero-section') && homeCss.includes('.workbook-grid'), 'shared-home responsive design is missing');
assert(homeCss.includes('@media(max-width:620px)'), 'shared home requires an explicit phone layout');

// Existing workbook viewer contract.
assert(index.includes('viewer/mobile-scroll.css'), 'mobile scroll stylesheet must be loaded');
assert(index.includes('id="page-jump"'), 'fast page navigation dock is missing');
assert(index.includes('data-topic="cone"') && index.includes('data-topic="circle"') && index.includes('data-topic="cylinder"'), 'all three topic selectors are required');

assert(/cone:\s*\{\s*label:\s*'חרוט',\s*count:\s*46/.test(app), 'cone count must be 46');
assert(/circle:\s*\{\s*label:\s*'מעגל',\s*count:\s*88/.test(app), 'circle count must be 88');
assert(/cylinder:\s*\{\s*label:\s*'גליל',\s*count:\s*38/.test(app), 'cylinder count must be 38');
assert(app.includes('fitFrameToViewport'), 'A4 mobile scale-to-fit function is required');
assert(app.includes('isMobileWorkbookViewport'), 'mobile/touch viewport detection is required');
assert(app.includes("frame.style.width = '210mm'") && app.includes("frame.style.height = '297mm'"), 'mobile iframe must preserve an exact A4 surface before scaling');
assert(app.includes("frame.style.transform = 'scale(' + scale + ')'"), 'mobile viewer must scale the iframe surface instead of the inner A4 DOM');
assert(!/main\.style\.transform\s*=\s*`scale\(/.test(app), 'inner .a4-page DOM must not be transformed for mobile rendering');
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
assert(!css.includes('content-visibility:auto'), 'iframe wrappers must not use content-visibility; it can produce blank pages on Android');
assert(!/contain:\s*[^;]*(?:paint|layout)/.test(css), 'iframe wrappers must not use paint/layout containment in mobile mode');
assert(/\.ws-sheet-frame\{[\s\S]*pointer-events:none!important/.test(css), 'mobile iframe must not trap touch scrolling');
assert(/\.ws-sheet-frame\{[\s\S]*transform-origin:top left!important/.test(css), 'mobile iframe transform origin must be top-left');
assert(/\.page-jump__btn\{[\s\S]*width:44px;[\s\S]*height:44px;/.test(css), 'navigation touch targets must be at least 44×44px');
assert(/\.page-jump__btn--main\{[\s\S]*width:48px;[\s\S]*height:48px;/.test(css), 'primary next/previous touch targets must be 48×48px');
assert(/\.wsbar__topics \.btn\{[\s\S]*min-width:44px!important;[\s\S]*min-height:44px!important/.test(css), 'topic selector touch targets must be at least 44×44px');
assert(css.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion CSS contract is required');
assert(/max-width:1024px[^\n]*hover:none[^\n]*pointer:coarse/.test(css), 'touch-device landscape mode up to 1024px must retain mobile workbook layout');
assert(/@media print\{[\s\S]*\.ws-sheet-frame\{[\s\S]*transform:none!important/.test(css), 'print must neutralize the mobile iframe transform');
assert(/\.topbar,.sitenav,.hero-section,.site-footer\{display:none!important\}/.test(css), 'topic-mode mobile viewer must be able to hide non-booklet chrome');
assert(homeCss.includes('display:block!important'), 'home design must explicitly restore home chrome on phones');

assert(rules.includes('גלילה היא אנכית בלבד') && rules.includes('פס/רווח בצבע טורקיז כהה'), 'viewer source-of-truth must lock vertical scrolling and turquoise separators');
assert(rules.includes('זוכר את הדף האחרון') && rules.includes('אין להשתמש ב־`content-visibility`'), 'viewer source-of-truth must lock position memory and Android-safe iframe rendering');
assert(rules.includes('210mm × 297mm') && rules.includes('אין לבצע `transform` על `.a4-page`'), 'viewer source-of-truth must lock iframe-surface scaling');
assert(rules.includes('44') && rules.includes('reduced-motion'), 'viewer source-of-truth must lock accessible touch targets and reduced motion');

console.log('Viewer QA: PASS (shared three-workbook home + Android-safe A4 iframe rendering + mobile portrait/landscape + accessibility + navigation + position memory + print preparation checked)');
