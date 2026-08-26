const params = new URLSearchParams(location.search);
const requestedTopic = params.get('topic');

let catalog = null;
try {
  const response = await fetch('content/catalog.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  catalog = await response.json();
} catch (error) {
  console.error('Failed to load workbook catalog', error);
}

const topicIds = new Set((catalog?.books || []).map(book => book.id));
const hasTopic = topicIds.has(requestedTopic);

async function loadBookSummary(book) {
  const response = await fetch(book.manifest, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${book.id}: HTTP ${response.status}`);
  const manifest = await response.json();
  const pages = manifest.printSheetCount ?? manifest.pageCount;
  const label = manifest.label ?? manifest.project ?? book.id;
  if (!Number.isInteger(pages) || pages <= 0) throw new Error(`${book.id}: invalid page count`);
  return { id: book.id, label, pages };
}

async function hydrateHomeFromCatalog() {
  if (!catalog?.books?.length) return;
  const summaries = await Promise.all(catalog.books.map(loadBookSummary));
  const totalPages = summaries.reduce((sum, book) => sum + book.pages, 0);

  for (const book of summaries) {
    document.querySelectorAll(`[data-book-pages="${book.id}"]`).forEach(node => {
      node.textContent = `${book.pages} דפי A4`;
    });
    document.querySelectorAll(`[data-book-label="${book.id}"]`).forEach(node => {
      node.textContent = book.label;
    });
  }

  document.querySelectorAll('[data-total-pages]').forEach(node => {
    node.textContent = String(totalPages);
  });
  document.querySelectorAll('[data-book-count]').forEach(node => {
    node.textContent = String(summaries.length);
  });
}

if (hasTopic) {
  window.__WORKBOOK_CATALOG__ = catalog;
  document.body.classList.add('has-topic');
  document.querySelector('#workbook')?.removeAttribute('hidden');
  document.querySelector('#page-jump')?.removeAttribute('hidden');
  document.querySelector('#library')?.setAttribute('hidden', '');
  await import('./app.js');
} else {
  const homeStyles = document.createElement('link');
  homeStyles.rel = 'stylesheet';
  homeStyles.href = 'viewer/home.css';
  document.head.append(homeStyles);

  document.body.classList.add('is-home');
  document.querySelector('#workbook')?.setAttribute('hidden', '');
  document.querySelector('#page-jump')?.setAttribute('hidden', '');
  document.querySelector('#library')?.removeAttribute('hidden');
  document.title = catalog?.title ? `דפי עבודה במתמטיקה — ${catalog.title}` : 'דפי עבודה במתמטיקה — מעגל · גליל · חרוט';

  try {
    await hydrateHomeFromCatalog();
  } catch (error) {
    console.error('Failed to hydrate home from workbook manifests', error);
  }
}
