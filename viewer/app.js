const frame = document.querySelector('#worksheet-frame');
const picker = document.querySelector('#page-picker');
const status = document.querySelector('#page-status');
const prev = document.querySelector('#prev-page');
const next = document.querySelector('#next-page');
const printCurrent = document.querySelector('#print-current');
const downloadCurrent = document.querySelector('#download-current');
const openCurrent = document.querySelector('#open-current');
const loading = document.querySelector('#loading');
const summary = document.querySelector('#workbook-summary');
const title = document.querySelector('#sheet-title');
const subtitle = document.querySelector('#sheet-subtitle');
const kind = document.querySelector('#sheet-kind');
const pageGrid = document.querySelector('#page-grid');

let workbook = null;
let entries = [];
let currentIndex = 0;

function buildEntries(data) {
  const sequence = data.printSequence || data.pages.map(page => ({ kind: 'worksheet', id: page.id }));

  return sequence.map((entry, sequenceIndex) => {
    const localPage = sequenceIndex + 1;
    if (entry.kind === 'worksheet') {
      const page = data.pages.find(item => item.id === entry.id);
      if (!page) throw new Error(`דף עבודה חסר ב-workbook.json`);
      return {
        sequence: localPage,
        key: `worksheet-${page.id}`,
        kind: 'worksheet',
        kindLabel: 'דף עבודה',
        title: page.title,
        subtitle: page.subtitle || '',
        url: `worksheets/${page.slug}.html`,
        fileName: `harut-page-${String(localPage).padStart(2, '0')}.html`,
        worksheetId: page.id
      };
    }

    if (entry.kind === 'visual') {
      const page = (data.visualPages || []).find(item => item.slug === entry.slug);
      if (!page) throw new Error(`דף חזותי חסר ב-workbook.json`);
      return {
        sequence: localPage,
        key: `visual-${page.slug}`,
        kind: 'visual',
        kindLabel: 'דף חזותי',
        title: page.title,
        subtitle: page.type === 'puzzle-answer' ? 'דף תשובות חזותי' : 'המחשה חזותית A4',
        url: `visual-pages/${page.slug}.html`,
        fileName: `harut-page-${String(localPage).padStart(2, '0')}.html`,
        visualSlug: page.slug
      };
    }

    throw new Error(`סוג דף לא מוכר: ${entry.kind}`);
  });
}

function requestedIndex() {
  const params = new URLSearchParams(location.search);
  const sheet = Number(params.get('sheet'));
  if (Number.isInteger(sheet) && sheet >= 1 && sheet <= entries.length) return sheet - 1;

  // Backward compatibility only: the old ?page= parameter addressed an internal worksheet id.
  const legacyPage = Number(params.get('page'));
  if (Number.isInteger(legacyPage) && legacyPage > 0) {
    const found = entries.findIndex(entry => entry.worksheetId === legacyPage);
    if (found >= 0) return found;
  }

  return 0;
}

function syncUrl(index) {
  const url = new URL(location.href);
  url.searchParams.delete('page');
  url.searchParams.set('sheet', String(index + 1));
  history.replaceState(null, '', url);
}

function renderPicker() {
  picker.replaceChildren(...entries.map((entry, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `עמוד ${entry.sequence} · ${entry.kindLabel} — ${entry.title}`;
    return option;
  }));
}

function renderCatalog() {
  const cards = entries.map((entry, index) => {
    const card = document.createElement('article');
    card.className = 'page-card';
    card.dataset.index = String(index);

    const meta = document.createElement('div');
    meta.className = 'page-card-meta';
    meta.textContent = `עמוד ${entry.sequence} · ${entry.kindLabel}`;

    const heading = document.createElement('h3');
    heading.textContent = entry.title;

    const sub = document.createElement('p');
    sub.textContent = entry.subtitle;

    const actions = document.createElement('div');
    actions.className = 'page-card-actions';

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'mini-button';
    openButton.textContent = 'הצג';
    openButton.addEventListener('click', () => {
      show(index, true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const download = document.createElement('a');
    download.className = 'mini-button mini-link';
    download.href = entry.url;
    download.download = entry.fileName;
    download.textContent = 'הורד';

    actions.append(openButton, download);
    card.append(meta, heading, sub, actions);
    return card;
  });

  pageGrid.replaceChildren(...cards);
}

function markActiveCard() {
  document.querySelectorAll('.page-card.is-active').forEach(card => card.classList.remove('is-active'));
  const active = pageGrid.querySelector(`[data-index="${currentIndex}"]`);
  active?.classList.add('is-active');
}

function decorateFrame() {
  try {
    const doc = frame.contentDocument;
    const entry = entries[currentIndex];
    if (!doc || !entry) return;

    doc.querySelector('.sheet-footer')?.remove();
    doc.querySelector('.book-page-number')?.remove();

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
  } finally {
    loading.classList.add('is-hidden');
  }
}

function show(index, updateUrl = true) {
  currentIndex = Math.max(0, Math.min(index, entries.length - 1));
  const entry = entries[currentIndex];

  loading.classList.remove('is-hidden');
  frame.src = entry.url;
  frame.title = `${entry.title} — עמוד ${entry.sequence}`;
  picker.value = String(currentIndex);
  status.textContent = `עמוד ${entry.sequence} / ${entries.length}`;
  prev.disabled = currentIndex === 0;
  next.disabled = currentIndex === entries.length - 1;

  kind.textContent = entry.kindLabel;
  title.textContent = entry.title;
  subtitle.textContent = entry.subtitle;

  downloadCurrent.href = entry.url;
  downloadCurrent.download = entry.fileName;
  openCurrent.href = entry.url;

  markActiveCard();
  if (updateUrl) syncUrl(currentIndex);
}

frame.addEventListener('load', decorateFrame);
picker.addEventListener('change', () => show(Number(picker.value), true));
prev.addEventListener('click', () => show(currentIndex - 1, true));
next.addEventListener('click', () => show(currentIndex + 1, true));
printCurrent.addEventListener('click', () => {
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
});

document.addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key === 'ArrowRight') show(currentIndex - 1, true);
  if (event.key === 'ArrowLeft') show(currentIndex + 1, true);
});

fetch('content/workbook.json', { cache: 'no-store' })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  })
  .then(data => {
    workbook = data;
    entries = buildEntries(workbook);
    summary.textContent = `${entries.length} דפי A4 · חוברת חרוט אחת · הורדה · הדפסה`;
    document.title = `חרוט — ${entries.length} דפי A4`;
    renderPicker();
    renderCatalog();
    show(requestedIndex(), false);
  })
  .catch(error => {
    loading.textContent = `לא ניתן לטעון את החוברת: ${error.message || error}`;
    title.textContent = 'שגיאה בטעינת החוברת';
    subtitle.textContent = '';
  });
