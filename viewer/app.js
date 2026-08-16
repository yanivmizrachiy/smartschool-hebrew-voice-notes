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

const params = new URLSearchParams(location.search);
const topicKey = TOPICS[params.get('topic')] ? params.get('topic') : 'cone';
const topic = TOPICS[topicKey];
let entries = [];
let currentSequence = 1;
let scrollTicking = false;

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
  return null;
}

function goToSequence(sequence, behavior = 'smooth') {
  const safe = Math.max(1, Math.min(entries.length, sequence));
  document.querySelector(`#sheet-${safe}`)?.scrollIntoView({ block: 'start', behavior });
  currentSequence = safe;
  updateJumpStatus();
}

function scrollToRequestedSheet() {
  const sequence = requestedSequence();
  if (!sequence) return;
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
  const frames = [...document.querySelectorAll('.ws-wsframe')];
  if (!frames.length) return;
  const targetY = Math.max(0, window.innerHeight * 0.18);
  let best = frames[0];
  let bestDistance = Infinity;
  for (const frame of frames) {
    const rect = frame.getBoundingClientRect();
    const distance = Math.abs(rect.top - targetY);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
  }
  const next = Number(best.dataset.sequence) || 1;
  if (next !== currentSequence) {
    currentSequence = next;
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
window.addEventListener('resize', handleScroll, { passive: true });
printBooklet.addEventListener('click', () => window.print());

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
    requestAnimationFrame(detectCurrentSheet);

    if (params.get('print') === '1') setTimeout(() => window.print(), 700);
  })
  .catch(error => {
    loading.hidden = false;
    loading.textContent = `לא ניתן לטעון את החוברת: ${error.message || error}`;
    status.textContent = 'שגיאה בטעינת החוברת';
    pageJump.hidden = true;
  });
