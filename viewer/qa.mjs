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
const projectRules = fs.readFileSync(path.join(root, 'RULES.md'), 'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'content', 'catalog.json'), 'utf8'));
const circle = JSON.parse(fs.readFileSync(path.join(root, 'content', 'circle.json'), 'utf8'));
const cylinder = JSON.parse(fs.readFileSync(path.join(root, 'content', 'cylinder.json'), 'utf8'));
const cone = JSON.parse(fs.readFileSync(path.join(root, 'content', 'workbook.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(`Viewer QA failed: ${message}`); };

// Root RULES.md is the sole requirements authority. The viewer has no parallel rules document.
assert(projectRules.includes('## 17. האתר המשותף — Home'), 'root RULES.md must define the shared-home contract');
assert(projectRules.includes('## 18. Viewer משותף'), 'root RULES.md must define the shared viewer contract');
assert(projectRules.includes('## 19. Viewer בנייד'), 'root RULES.md must define the mobile viewer contract');
assert(projectRules.includes('## 20. ביצועי Viewer'), 'root RULES.md must define the viewer performance contract');
assert(projectRules.includes('## 21. הדפסה ו־PDF'), 'root RULES.md must define viewer print/PDF requirements');

// Canonical catalog contract: counts and topic identities come from data, never duplicated in viewer code/HTML.
assert(catalog.books?.length === 3, 'catalog must expose exactly three workbooks');
assert(new Set(catalog.books.map(book => book.id)).size === 3, 'catalog workbook ids must be unique');
assert(circle.pageCount === 90, 'circle manifest must define 90 pages');
assert(cylinder.pageCount === 41, 'cylinder manifest must define 41 pages');
assert(cone.printSheetCount === 46, 'cone manifest must define 46 print sheets');
assert(circle.pageCount + cylinder.pageCount + cone.printSheetCount === 177, 'canonical manifests must total 177 A4 pages');
assert(bootstrap.includes("fetch('content/catalog.json'"), 'bootstrap must load the canonical catalog');
assert(bootstrap.includes('catalog?.books') && bootstrap.includes('window.__WORKBOOK_CATALOG__'), 'bootstrap must derive allowed topics from the canonical catalog');
assert(bootstrap.includes('hydrateHomeFromCatalog') && bootstrap.includes('Promise.all(catalog.books.map(loadBookSummary))'), 'home counts must be hydrated from canonical workbook manifests');
assert(bootstrap.includes('manifest.printSheetCount ?? manifest.pageCount'), 'home must derive each workbook page count from its manifest');
assert(!bootstrap.includes("new Set(['circle', 'cylinder', 'cone'])"), 'bootstrap must not duplicate the topic list');
assert(app.includes('catalogBook.manifest'), 'viewer app must load the selected workbook through its catalog manifest');
assert(!/const\s+TOPICS\s*=/.test(app), 'viewer app must not duplicate topic counts in a private TOPICS constant');

// Shared-home contract: root is a three-workbook catalog, never an implicit cone booklet.
assert(index.includes('viewer/bootstrap.js'), 'bootstrap entrypoint must control home versus workbook mode');
assert(!index.includes('src="viewer/app.js"'), 'root HTML must not eagerly load the workbook app');
assert(index.includes('id="library"') && index.includes('id="home-hero"'), 'shared home catalog and hero are required');
assert(index.includes('מעגל · גליל · חרוט'), 'shared project title must name all three topics');
assert(index.includes('data-book-pages="circle"') && index.includes('data-book-pages="cylinder"') && index.includes('data-book-pages="cone"'), 'home must expose manifest-driven page-count slots for all workbooks');
assert(index.includes('data-total-pages') && index.includes('data-book-count'), 'home must expose manifest-driven summary slots');
assert(!index.includes('90 דפי A4') && !index.includes('41 דפי A4') && !index.includes('46 דפי A4') && !index.includes('177 דפי A4'), 'home HTML must not duplicate canonical workbook counts');
assert(index.includes('?topic=circle&sheet=1#workbook') && index.includes('?topic=cylinder&sheet=1#workbook') && index.includes('?topic=cone&sheet=1#workbook'), 'each home card must open page 1 of its own booklet');
assert(!index.includes('כל הנושאים במקום אחד'), 'generic/demo-like home heading must not return');
assert(index.includes('href="viewer/home.css"'), 'home stylesheet must be present in the initial HTML');
assert(index.indexOf('viewer/home.css') < index.indexOf('viewer/bootstrap.js'), 'home stylesheet must load before bootstrap hydration');
assert(index.includes("if (!new URLSearchParams(location.search).has('topic')) document.body.classList.add('is-home')"), 'Home mode must be established synchronously before module hydration');
assert(!bootstrap.includes("document.createElement('link')") && !bootstrap.includes('homeStyles'), 'bootstrap must not inject the Home stylesheet after first paint');
assert(bootstrap.includes("await import('./app.js')"), 'workbook app must load only after a valid catalog topic is selected');
assert(bootstrap.includes("classList.add('is-home')") && bootstrap.includes("classList.add('has-topic')"), 'home and workbook modes must be explicit');
assert(homeCss.includes('body.is-home .hero-section') && homeCss.includes('.workbook-grid'), 'shared-home responsive design is missing');
assert(homeCss.includes('@media(max-width:620px)'), 'shared home requires an explicit phone layout');

// Existing workbook viewer contract.
assert(index.includes('viewer/mobile-scroll.css'), 'mobile scroll stylesheet must be loaded');
assert(index.includes('id="workbook"') && index.includes('id="booklet-status"') && index.includes('id="booklet-loading"') && index.includes('id="booklet-sheets"'), 'complete workbook viewer shell is required');
assert(index.includes('id="bw-toggle"') && index.includes('id="print-booklet"'), 'workbook view controls are required');
assert(index.includes('id="page-jump"'), 'fast page navigation dock is missing');
assert(index.includes('data-jump="top"') && index.includes('data-jump="prev"') && index.includes('data-jump="next"') && index.includes('data-jump="bottom"'), 'complete fast page navigation controls are required');
assert(index.includes('data-topic="cone"') && index.includes('data-topic="circle"') && index.includes('data-topic="cylinder"'), 'all three topic selectors are required');
assert(app.includes('fitFrameToViewport'), 'A4 mobile scale-to-fit function is required');
assert(app.includes('isMobileWorkbookViewport'), 'mobile/touch viewport detection is required');
assert(app.includes("frame.style.width = '210mm'") && app.includes("frame.style.height = '297mm'"), 'mobile iframe must preserve an exact A4 surface before scaling');
assert(app.includes("frame.style.transform = 'scale(' + scale + ')'"), 'mobile viewer must scale the iframe surface instead of the inner A4 DOM');
assert(!/main\.style\.transform\s*=\s*`scale\(/.test(app), 'inner .a4-page DOM must not be transformed for mobile rendering');
assert(app.includes('ensureAllFramesLoaded'), 'printing must explicitly load every workbook iframe first');
assert(app.includes('waitForFrameReadiness') && app.includes('doc.fonts?.ready'), 'printing must wait for frame fonts readiness');
assert(app.includes('waitForImageReady') && app.includes('image.decode()'), 'printing must wait for image decode readiness');
assert(!app.includes("setTimeout(() => printPreparedBooklet(), 700)"), 'print mode must not rely on an arbitrary 700ms delay');
assert(app.includes("if (params.get('print') === '1') void printPreparedBooklet()"), 'print query mode must enter the readiness-gated print workflow directly');
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

console.log('Viewer QA: PASS (root RULES authority + manifest-driven catalog/home/viewer + stable first paint + complete workbook shell + real print readiness + Android-safe A4 rendering + mobile accessibility/navigation checked)');
