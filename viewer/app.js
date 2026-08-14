const sheets = document.querySelector('#booklet-sheets');
const loading = document.querySelector('#booklet-loading');
const status = document.querySelector('#booklet-status');
const bwToggle = document.querySelector('#bw-toggle');
const printBooklet = document.querySelector('#print-booklet');

let entries = [];

function visibleKind(entry) {
  return entry.sequence === 1 && entry.kind === 'worksheet' ? 'דף המחשה לתלמיד' : entry.kindLabel;
}

function buildEntries(data) {
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
      const header = doc.querySelector('.header-container');
      number = doc.createElement('div');
      if (header) {
        number.className = 'page-number';
        header.append(number);
      } else {
        number.className = 'local-page-number';
        main.prepend(number);
      }
    }

    number.hidden = false;
    number.dataset.localPageNumber = 'true';
    number.setAttribute('aria-label', `עמוד ${entry.sequence}`);
    number.textContent = String(entry.sequence);
  } catch {
    // Same-origin pages should be accessible; the booklet remains readable even if decoration fails.
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
    pageNumber.textContent = entry.sequence === 1
      ? 'דף המחשה לתלמיד · עמוד 1'
      : `${visibleKind(entry)} · עמוד ${entry.sequence}`;

    frameWrap.append(frame, pageNumber);
    fragment.append(frameWrap);
  }

  sheets.replaceChildren(fragment);
  loading.hidden = true;
}

function applyViewMode() {
  const params = new URLSearchParams(location.search);
  const bw = params.get('bw') === '1';
  sheets.classList.toggle('ws-bw', bw);

  const url = new URL(location.href);
  if (bw) {
    url.searchParams.delete('bw');
    bwToggle.textContent = 'תצוגה צבעונית';
  } else {
    url.searchParams.set('bw', '1');
    bwToggle.textContent = 'תצוגת שחור-לבן';
  }
  url.hash = 'workbook';
  bwToggle.href = `${url.pathname}${url.search}${url.hash}`;
}

function requestedSequence() {
  const params = new URLSearchParams(location.search);
  const sheet = Number(params.get('sheet'));
  if (Number.isInteger(sheet) && sheet >= 1 && sheet <= entries.length) return sheet;

  const legacyPage = Number(params.get('page'));
  if (Number.isInteger(legacyPage) && legacyPage > 0) {
    const found = entries.find(entry => entry.worksheetId === legacyPage);
    if (found) return found.sequence;
  }

  return null;
}

function scrollToRequestedSheet() {
  const sequence = requestedSequence();
  if (!sequence) return;
  requestAnimationFrame(() => {
    document.querySelector(`#sheet-${sequence}`)?.scrollIntoView({ block: 'start' });
  });
}

printBooklet.addEventListener('click', () => window.print());

fetch('content/workbook.json', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(data => {
    entries = buildEntries(data);
    status.textContent = `חוברת דפי העבודה · ${entries.length} דפים ממוספרים`;
    document.title = `חרוט — ${entries.length} דפי A4`;
    renderBooklet();
    applyViewMode();
    scrollToRequestedSheet();

    const params = new URLSearchParams(location.search);
    if (params.get('print') === '1') setTimeout(() => window.print(), 700);
  })
  .catch(error => {
    loading.hidden = false;
    loading.textContent = `לא ניתן לטעון את החוברת: ${error.message || error}`;
    status.textContent = 'שגיאה בטעינת החוברת';
  });
