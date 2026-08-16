const fs = require('fs');

function replaceOrThrow(text, pattern, replacement, label) {
  if (!pattern.test(text)) throw new Error(`${label} not found exactly`);
  return text.replace(pattern, replacement);
}

// 1) Viewer: scale the iframe as one A4 surface instead of transforming the inner worksheet DOM.
{
  const file = 'viewer/app.js';
  let text = fs.readFileSync(file, 'utf8');
  text = replaceOrThrow(
    text,
    /function fitFrameToViewport\(frame\) \{[\s\S]*?\n\}\n\nfunction fitAllFrames/,
`function isMobileWorkbookViewport() {
  return window.matchMedia?.('(max-width:760px), (max-width:1024px) and (hover:none) and (pointer:coarse)').matches === true;
}

function clearLegacyInnerScale(frame) {
  try {
    const doc = frame.contentDocument;
    const main = doc?.querySelector('.a4-page');
    if (main) {
      main.style.transform = '';
      main.style.transformOrigin = '';
    }
    if (doc) {
      doc.documentElement.style.margin = '';
      doc.documentElement.style.padding = '';
      doc.documentElement.style.overflow = '';
      doc.body.style.margin = '';
      doc.body.style.padding = '';
      doc.body.style.overflow = '';
    }
  } catch {
    // The A4 page remains readable even if legacy inline styles cannot be cleared.
  }
}

function fitFrameToViewport(frame) {
  const wrap = frame.closest('.ws-wsframe');
  if (!wrap) return;

  clearLegacyInnerScale(frame);
  frame.style.transform = '';
  frame.style.transformOrigin = '';
  frame.style.width = '';
  frame.style.height = '';
  frame.style.top = '';
  frame.style.left = '';
  frame.style.right = '';
  frame.style.bottom = '';

  if (!isMobileWorkbookViewport()) return;

  // Keep the child document at exact A4 size and scale the iframe surface itself.
  // This avoids Android/WebView paint failures caused by transforming content inside an iframe.
  frame.style.width = '210mm';
  frame.style.height = '297mm';
  frame.style.top = '0';
  frame.style.left = '0';
  frame.style.right = 'auto';
  frame.style.bottom = 'auto';
  frame.style.transformOrigin = 'top left';

  const naturalWidth = frame.offsetWidth;
  const availableWidth = wrap.clientWidth;
  if (!naturalWidth || !availableWidth) return;
  const scale = availableWidth / naturalWidth;
  frame.style.transform = 'scale(' + scale + ')';
}

function fitAllFrames`,
    'fitFrameToViewport block'
  );

  text = replaceOrThrow(
    text,
    /function prepareFramesForPrint\(\) \{[\s\S]*?\n\}\n\nfunction restoreFramesAfterPrint/,
`function prepareFramesForPrint() {
  document.querySelectorAll('.ws-sheet-frame').forEach(frame => {
    clearLegacyInnerScale(frame);
    frame.style.transform = 'none';
    frame.style.transformOrigin = 'top left';
    frame.style.width = '210mm';
    frame.style.height = '297mm';
    frame.style.top = '0';
    frame.style.left = '0';
    frame.style.right = 'auto';
    frame.style.bottom = 'auto';
  });
}

function restoreFramesAfterPrint`,
    'prepareFramesForPrint block'
  );
  fs.writeFileSync(file, text);
}

// 2) Mobile browser QA: require real, visible worksheet text inside the first iframe.
{
  const file = 'tools/qa-mobile-viewer.mjs';
  let text = fs.readFileSync(file, 'utf8');
  const marker = "      const iframe = frames[0]?.querySelector('.ws-sheet-frame');\n      const jump = document.querySelector('#page-jump');";
  if (!text.includes(marker)) throw new Error('mobile QA iframe marker not found');
  text = text.replace(marker, "      const iframe = frames[0]?.querySelector('.ws-sheet-frame');\n      const innerDoc = iframe?.contentDocument;\n      const innerPage = innerDoc?.querySelector('.a4-page');\n      const innerStyle = innerPage ? innerDoc.defaultView.getComputedStyle(innerPage) : null;\n      const jump = document.querySelector('#page-jump');");

  const metricsMarker = "        iframePointerEvents: iframe ? getComputedStyle(iframe).pointerEvents : '',\n        topbarDisplay:";
  if (!text.includes(metricsMarker)) throw new Error('mobile QA metrics marker not found');
  text = text.replace(metricsMarker, "        iframePointerEvents: iframe ? getComputedStyle(iframe).pointerEvents : '',\n        iframeTextLength: innerPage?.innerText?.replace(/\\s+/g, ' ').trim().length || 0,\n        innerPageDisplay: innerStyle?.display || '',\n        innerPageVisibility: innerStyle?.visibility || '',\n        innerPageOpacity: Number(innerStyle?.opacity || 0),\n        iframeRenderedWidth: iframe?.getBoundingClientRect().width || 0,\n        topbarDisplay:");

  const assertMarker = "    assert(metrics.iframePointerEvents === 'none', `${topic}/${orientation}: iframe must not trap touch gestures`);\n    assert(metrics.topbarDisplay === 'none',";
  if (!text.includes(assertMarker)) throw new Error('mobile QA assertion marker not found');
  text = text.replace(assertMarker, "    assert(metrics.iframePointerEvents === 'none', `${topic}/${orientation}: iframe must not trap touch gestures`);\n    assert(metrics.iframeTextLength > 80, `${topic}/${orientation}: first A4 iframe has no real worksheet text (length ${metrics.iframeTextLength})`);\n    assert(metrics.innerPageDisplay !== 'none' && metrics.innerPageVisibility !== 'hidden' && metrics.innerPageOpacity > 0.1, `${topic}/${orientation}: A4 content is hidden inside iframe`);\n    assert(Math.abs(metrics.iframeRenderedWidth - metrics.innerWidth) <= 2, `${topic}/${orientation}: scaled iframe width ${metrics.iframeRenderedWidth} != viewport ${metrics.innerWidth}`);\n    assert(metrics.topbarDisplay === 'none',");
  fs.writeFileSync(file, text);
}

// 3) Remove generic/demo-like copy from the public home; keep factual content and controls.
{
  const file = 'index.html';
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/\n\s*<p id="hero-copy">[\s\S]*?<\/p>/, '');
  text = text.replace(/\n\s*<div class="library-heading">[\s\S]*?<\/div>\n\n\s*<div class="workbook-grid">/, '\n\n        <div class="workbook-grid">');
  fs.writeFileSync(file, text);
}

// 4) Canonical viewer source of truth.
{
  const file = 'viewer/VIEWER_RULES.md';
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace('- דפים רחוקים מהמסך משתמשים ב־`content-visibility:auto` כדי להפחית עבודת layout/paint.\n', '- אין להשתמש ב־`content-visibility` או `contain: paint` על עטיפות `iframe` של דפי A4; באנדרואיד הם עלולים ליצור מסגרת לבנה ללא ציור התוכן.\n');
  const anchor = '- שינוי גודל וסיבוב מסך מפעילים התאמת קנה־מידה מחדש בלי לשנות את תוכן דף ה־A4.\n';
  if (!text.includes(anchor)) throw new Error('viewer rules scale anchor not found');
  text = text.replace(anchor, `${anchor}- בנייד ה־iframe עצמו נשאר משטח A4 בגודל \`210mm × 297mm\` ומוקטן כיחידה אחת לרוחב המסך; אין לבצע \`transform\` על \`.a4-page\` בתוך מסמך ה־iframe.\n`);
  fs.writeFileSync(file, text);
}

console.log('One-time mobile blank-page patch applied successfully.');
