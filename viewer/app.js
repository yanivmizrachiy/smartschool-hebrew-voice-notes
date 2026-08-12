const frame = document.querySelector('#worksheet-frame');
const picker = document.querySelector('#page-picker');
const status = document.querySelector('#page-status');
const prev = document.querySelector('#prev-page');
const next = document.querySelector('#next-page');
const printCurrent = document.querySelector('#print-current');
const loading = document.querySelector('#loading');
const summary = document.querySelector('#workbook-summary');

let workbook = null;
let currentIndex = 0;

function requestedPage() {
  const value = Number(new URLSearchParams(location.search).get('page'));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

function syncUrl(pageId) {
  const url = new URL(location.href);
  url.searchParams.set('page', String(pageId));
  history.replaceState(null, '', url);
}

function renderPicker() {
  picker.innerHTML = '';
  workbook.pages.forEach((page, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${page.id} — ${page.title}`;
    picker.appendChild(option);
  });
}

function show(index, updateUrl = true) {
  currentIndex = Math.max(0, Math.min(index, workbook.pages.length - 1));
  const page = workbook.pages[currentIndex];
  loading.classList.remove('is-hidden');
  frame.src = `worksheets/${page.slug}.html`;
  frame.title = `${page.title} — עמוד ${page.id}`;
  picker.value = String(currentIndex);
  status.textContent = `${page.id} מתוך ${workbook.pages.length}`;
  prev.disabled = currentIndex === 0;
  next.disabled = currentIndex === workbook.pages.length - 1;
  if (updateUrl) syncUrl(page.id);
}

frame.addEventListener('load', () => loading.classList.add('is-hidden'));
picker.addEventListener('change', () => show(Number(picker.value), true));
prev.addEventListener('click', () => show(currentIndex - 1, true));
next.addEventListener('click', () => show(currentIndex + 1, true));
printCurrent.addEventListener('click', () => {
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
});

document.addEventListener('keydown', event => {
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
    if (summary) summary.textContent = `${workbook.pages.length} דפי עבודה A4 להדפסה`;
    document.title = `חרוט — ${workbook.pages.length} דפי עבודה להדפסה`;
    renderPicker();
    const requested = requestedPage();
    const found = workbook.pages.findIndex(page => page.id === requested);
    show(found >= 0 ? found : 0, false);
  })
  .catch(error => {
    loading.textContent = `לא ניתן לטעון את רשימת הדפים: ${error.message || error}`;
  });
