const sheets = document.querySelector('#booklet-sheets');
const loading = document.querySelector('#booklet-loading');
const status = document.querySelector('#booklet-status');
const bwToggle = document.querySelector('#bw-toggle');
const printBooklet = document.querySelector('#print-booklet');
const heroTitle = document.querySelector('#hero-title');
const pageJump = document.querySelector('#page-jump');
const pageJumpStatus = document.querySelector('#page-jump-status');

const TOPICS = {
  cone: { label: 'חרוט', count: 46 },
  circle: { label: 'מעגל', count: 88, folder: 'circle' },
  cylinder: { label: 'גליל', count: 38, folder: 'cylinder' }
};
const STORAGE_PREFIX = 'math-workbook:last-sheet:';
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

const params = new URLSearchParams(location.search);
const topicKey = TOPICS[params.get('topic')] ? params.get('topic') : 'cone';
const topic = TOPICS[topicKey];
let entries = [];
let currentSequence = 1;
let scrollTicking = false;
let resizeTicking = false;
let printPreparing = false;

function visibleKind(entry) {
  return entry.sequence === 1 && entry.kind === 'worksheet' ? 'דף עבודה' : entry.kindLabel;
}

function buildConeEntries(data) {
  const sequence = data.printSequence || data.pages.map(page => ({ kind: 'worksheet', id: page.id }));

  return sequence.map((entry, sequenceIndex) => {
    const localPage = sequenceIndex + 1;

    if (entry.kind === 'worksheet') {
      const page = data.pages.find(item => item.id === entry.id);
      if (!page) throw new Error('דף עבודה חסר ב-workbook.json');
      return {
        sequence: localPage,
        key: `worksheet-${page.id}`,
        kind: 'worksheet',
        kindLabel: 'דף עבודה',
        title: page.title,
        subtitle: page.subtitle || '',
        url: `worksheets/${page.slug}.html`,
        worksheetId: page.id
      };
    }

    if (entry.kind === 'visual') {
      const page = (data.visualPages || []).find(item => item.slug === entry.slug);
      if (!page) throw new Error('דף חזותי חסר ב-workbook.json');
      return {
        sequence: localPage,
        key: `visual-${page.slug}`,
        kind: 'visual',
        kindLabel: 'דף חזותי',
        title: page.title,
        subtitle: page.type === 'puzzle-answer' ? 'דף תשובות חזותי' : 'המחשה חזותית A4',
        url: `visual-pages/${page.slug}.html`,
        visualSlug: page.slug
      };
    }

    throw new Error(`סוג דף לא מוכר: ${entry.kind}`);
  });
}

function buildSimpleEntries() {
  return Array.from({ length: topic.count }, (_, index) => {
    const sequence = index + 1;
    return {
      sequence,
      key: `${topicKey}-${sequence}`,
      kind: 'worksheet',
      kindLabel: 'דף עבודה',
      title: `${topic.label} — עמוד ${sequence}`,
      subtitle: '',
      url: `${topic.folder}/page-${sequence}.html`,
      worksheetId: sequence
    };
  });
}

async function loadEntries() {
  if (topicKey !== 'cone') return buildSimpleEntries();
  const response = await fetch('content/workbook.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return buildConeEntries(await response.json());
}

function rememberSequence(sequence) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${topicKey}`, String(sequence));
  } catch {
    // Private browsing or storage restrictions must not break navigation.
  }
}

function storedSequence() {
  try {
    const value = Number(sessionStorage.getItem(`${STORAGE_PREFIX}${topicKey}`));
    if (Number.isInteger(value) && value >= 1 && value <= entries.length) return value;
  } catch {
    // Storage is optional; direct navigation continues to work.
  }
  return null;
}

function fitFrameToViewport(frame) {
  try {
    const doc = frame.contentDocument;
    const main = doc?.querySelector('.a4-page');
    if (!doc || !main || !frame.clientWidth) return;

    main.style.transform = '';
    main.style.transformOrigin = '';
    const naturalWidth = main.offsetWidth;
    if (!naturalWidth) return;

    const scale = Math.min(1, frame.clientWidth / naturalWidth);
    doc.documentElement.style.margin = '0';
    doc.documentElement.style.padding = '0';
    doc.documentElement.style.overflow = 'hidden';
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.overflow = 'hidden';

    if (scale < 0.999) {
      main.style.transformOrigin = 'top left';
      main.style.transform = `scale(${scale})`;
    }
  } catch {
    // Viewer remains usable if a frame cannot be decorated.
  }
}

function fitAllFrames() {
  document.querySelectorAll('.ws-sheet-frame').forEach(fitFrameToViewport);
}

function isFrameReady(frame) {
  try {
    return frame.contentDocument?.readyState === 'complete' && !!frame.contentDocument?.querySelector('.a4-page');
  } catch {
    return false;
  }
}

async function ensureAllFramesLoaded(timeoutMs = 30000) {
  const frames = [...document.querySelectorAll('.ws-sheet-frame')];
  frames.forEach(frame => { frame.loading = 'eager'; });

  const waiting = frames.filter(frame => !isFrameReady(frame));
  if (!waiting.length) return;

  await Promise.race([
    Promise.all(waiting.map(frame => new Promise((resolve, reject) => {
      const onLoad = () => {
        cleanup();
        if (isFrameReady(frame)) resolve();
        else reject(new Error(`עמוד ${frame.title || ''} לא נטען במלואו`));
      };
      const cleanup = () => frame.removeEventListener('load', onLoad);
      frame.addEventListener('load', onLoad, { once: true });
      if (isFrameReady(frame)) {
        cleanup();
        resolve();
      }
    }))),
    new Promise((_, reject) => setTimeout(() => reject(new Error('טעינת כל דפי החוברת להדפסה חרגה מהזמן המותר')), timeoutMs))
  ]);
}

function prepareFramesForPrint() {
  document.querySelectorAll('.ws-sheet-frame').forEach(frame => {
    try {
      const doc = frame.contentDocument;
      const main = doc?.querySelector('.a4-page');
      if (!doc || !main) return;
      main.style.transform = 'none';
      main.style.transformOrigin = '';
      doc.documentElement.style.overflow = 'visible';
      doc.body.style.overflow = 'visible';
    } catch {
      // Printing continues only after ensureAllFramesLoaded verified same-origin page readiness.
    }
  });
}

function restoreFramesAfterPrint() {
  requestAnimationFrame(() => {
    fitAllFrames();
    detectCurrentSheet();
  });
}

async function printPreparedBooklet() {
  if (printPreparing) return;
  printPreparing = true;
  const originalText = printBooklet.textContent;
  printBooklet.disabled = true;
  printBooklet.textContent = 'מכין להדפסה…';
  try {
    await ensureAllFramesLoaded();
    prepareFramesForPrint();
    window.print();
  } catch (error) {
    console.error(error);
    status.textContent = `שגיאה בהכנת ההדפסה: ${error.message || error}`;
  } finally {
    printBooklet.disabled = false;
    printBooklet.textContent = originalText;
    printPreparing = false;
  }
}

function decorateFrame(frame, entry) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.querySelector('.sheet-footer')?.remove();
    const main = doc.querySelector('.a4-page');
    if (!main) return;
    main.dataset.localPage = String(entry.sequence);

    let number = doc.querySelector('.page-number, .local-page-number');
    if (!number) {
      number = doc.createElement('div');
      number.className = 'local-page-number';
      main.prepend(number);
    }
    number.hidden = false;
    number.dataset.localPageNumber = 'true';
    number.setAttribute('aria-label', `עמוד ${entry.sequence}`);
    number.textContent = String(entry.sequence);
    fitFrameToViewport(frame);
  } catch {
    // Same-origin pages remain readable even if optional decoration is unavailable.
  }
}

function renderBooklet() {
  const fragment = document.createDocumentFragment();

  for (const entry of entries) {
    const frameWrap = document.createElement('article');
    frameWrap.className = 'ws-wsframe';
    frameWrap.id = `sheet-${entry.sequence}`;
    frameWrap.dataset.sequence = String(entry.sequence);

    const frame = document.createElement('iframe');
    frame.className = 'ws-sheet-frame';
    frame.src = entry.url;
    frame.title = `עמוד ${entry.sequence} · ${visibleKind(entry)} — ${entry.title}`;
    frame.loading = entry.sequence <= 3 ? 'eager' : 'lazy';
    frame.setAttribute('scrolling', 'no');
    frame.addEventListener('load', () => decorateFrame(frame, entry));

    const pageNumber = document.createElement('span');
    pageNumber.className = 'ws-wsnum';
    pageNumber.textContent = `עמוד ${entry.sequence}`;

    frameWrap.append(frame, pageNumber);
    fragment.append(frameWrap);
  }

  sheets.replaceChildren(fragment);
  loading.hidden = true;
}

function applyViewMode() {
  const bw = params.get('bw') === '1';
  sheets.classList.toggle('ws-bw', bw);

  const url = new URL(location.href);
  url.searchParams.delete('sheet');
  if (bw) {
    url.searchParams.delete('bw');
    bwToggle.textContent = 'צבעוני';
  } else {
    url.searchParams.set('bw', '1');
    bwToggle.textContent = 'שחור־לבן';
  }
  url.searchParams.set('topic', topicKey);
  url.hash = 'workbook';
  bwToggle.href = `${url.pathname}${url.search}${url.hash}`;
}

function applyTopicLinks() {
  document.querySelectorAll('.topic-link').forEach(link => {
    const key = link.dataset.topic;
    const url = new URL(location.href);
    url.searchParams.set('topic', key);
    url.searchParams.delete('sheet');
    url.hash = 'workbook';
    link.href = `${url.pathname}${url.search}${url.hash}`;
    link.classList.toggle('is-active', key === topicKey);
    if (key === topicKey) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function requestedSequence() {
  const sheet = Number(params.get('sheet'));
  if (Number.isInteger(sheet) && sheet >= 1 && sheet <= entries.length) return sheet;
  return storedSequence();
}

function navigationBehavior(requested) {
  if (requested) return requested;
  return reducedMotion?.matches ? 'auto' : 'smooth';
}

function goToSequence(sequence, behavior) {
  const safe = Math.max(1, Math.min(entries.length, sequence));
  document.querySelector(`#sheet-${safe}`)?.scrollIntoView({ block: 'start', behavior: navigationBehavior(behavior) });
  currentSequence = safe;
  rememberSequence(safe);
  updateJumpStatus();
}

function scrollToRequestedSheet() {
  const sequence = requestedSequence();
  if (!sequence) return;
  currentSequence = sequence;
  updateJumpStatus();
  requestAnimationFrame(() => goToSequence(sequence, 'auto'));
}

function updateJumpStatus() {
  pageJumpStatus.textContent = `${currentSequence}/${entries.length || 1}`;
  pageJump.querySelector('[data-jump="prev"]').disabled = currentSequence <= 1;
  pageJump.querySelector('[data-jump="top"]').disabled = currentSequence <= 1;
  pageJump.querySelector('[data-jump="next"]').disabled = currentSequence >= entries.length;
  pageJump.querySelector('[data-jump="bottom"]').disabled = currentSequence >= entries.length;
}

function detectCurrentSheet() {
  if (!entries.length) return;
  const x = Math.max(1, Math.min(window.innerWidth - 2, window.innerWidth / 2));
  const baseY = Math.max(56, Math.min(window.innerHeight - 2, window.innerHeight * 0.18));
  const offsets = [0, 18, -18, 36, -36];
  let frameWrap = null;

  for (const offset of offsets) {
    const y = Math.max(1, Math.min(window.innerHeight - 2, baseY + offset));
    const element = document.elementFromPoint(x, y);
    frameWrap = element?.closest?.('.ws-wsframe') || null;
    if (frameWrap) break;
  }

  if (!frameWrap) return;
  const next = Number(frameWrap.dataset.sequence) || 1;
  if (next !== currentSequence) {
    currentSequence = next;
    rememberSequence(next);
    updateJumpStatus();
  }
}

function handleScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    detectCurrentSheet();
    scrollTicking = false;
  });
}

function handleResize() {
  if (resizeTicking) return;
  resizeTicking = true;
  requestAnimationFrame(() => {
    fitAllFrames();
    detectCurrentSheet();
    resizeTicking = false;
  });
}

pageJump.addEventListener('click', event => {
  const button = event.target.closest('[data-jump]');
  if (!button || button.disabled) return;
  const action = button.dataset.jump;
  if (action === 'prev') goToSequence(currentSequence - 1);
  if (action === 'next') goToSequence(currentSequence + 1);
  if (action === 'top') goToSequence(1);
  if (action === 'bottom') goToSequence(entries.length);
});

window.addEventListener('scroll', handleScroll, { passive: true });
window.addEventListener('resize', handleResize, { passive: true });
window.addEventListener('orientationchange', handleResize, { passive: true });
window.addEventListener('beforeprint', prepareFramesForPrint);
window.addEventListener('afterprint', restoreFramesAfterPrint);
printBooklet.addEventListener('click', printPreparedBooklet);

window.__viewerEnsureAllFramesLoaded = ensureAllFramesLoaded;
window.__viewerPrepareFramesForPrint = prepareFramesForPrint;

loadEntries()
  .then(result => {
    entries = result;
    heroTitle.textContent = topic.label;
    status.textContent = `${topic.label} · ${entries.length} דפי A4`;
    document.title = `${topic.label} — ${entries.length} דפי A4`;
    renderBooklet();
    applyViewMode();
    applyTopicLinks();
    updateJumpStatus();
    scrollToRequestedSheet();
    requestAnimationFrame(() => {
      fitAllFrames();
      detectCurrentSheet();
    });

    if (params.get('print') === '1') setTimeout(() => printPreparedBooklet(), 700);
  })
  .catch(error => {
    loading.hidden = false;
    loading.textContent = `לא ניתן לטעון את החוברת: ${error.message || error}`;
    status.textContent = 'שגיאה בטעינת החוברת';
    pageJump.hidden = true;
  });
