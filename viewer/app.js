const frame = document.querySelector('#paperFrame');
const list = document.querySelector('#pageList');
const counter = document.querySelector('#counter');
const mobileCounter = document.querySelector('#mobileCounter');
const prevButtons = [...document.querySelectorAll('[data-action="prev"]')];
const nextButtons = [...document.querySelectorAll('[data-action="next"]')];
const printCurrent = document.querySelector('#printCurrent');
const printAll = document.querySelector('#printAll');

let workbook = null;
let currentIndex = 0;

const getRequestedPage = () => {
  const params = new URLSearchParams(location.search);
  const n = Number(params.get('page'));
  return Number.isInteger(n) && n > 0 ? n : 1;
};

function renderList() {
  list.innerHTML = '';
  workbook.pages.forEach((page, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-link';
    button.dataset.index = String(index);
    button.innerHTML = `<span class="n">${page.id}</span><span class="t">${page.title.replace(/^חרוט\s*[—–-]\s*/, '')}</span>`;
    button.addEventListener('click', () => show(index, true));
    list.appendChild(button);
  });
}

function show(index, pushState = false) {
  currentIndex = Math.max(0, Math.min(index, workbook.pages.length - 1));
  const page = workbook.pages[currentIndex];
  frame.src = `worksheets/${page.slug}.html`;
  frame.title = `${page.title} — עמוד ${page.id}`;
  const text = `עמוד ${page.id} מתוך ${workbook.pages.length}`;
  counter.textContent = text;
  mobileCounter.textContent = text;
  document.querySelectorAll('.page-link').forEach((el, i) => el.classList.toggle('active', i === currentIndex));
  prevButtons.forEach(btn => btn.disabled = currentIndex === 0);
  nextButtons.forEach(btn => btn.disabled = currentIndex === workbook.pages.length - 1);
  if (pushState) {
    const url = new URL(location.href);
    url.searchParams.set('page', String(page.id));
    history.replaceState(null, '', url);
  }
}

prevButtons.forEach(btn => btn.addEventListener('click', () => show(currentIndex - 1, true)));
nextButtons.forEach(btn => btn.addEventListener('click', () => show(currentIndex + 1, true)));

printCurrent.addEventListener('click', () => {
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
});

printAll.addEventListener('click', () => {
  const w = window.open('print/harut-a4.html', '_blank');
  if (!w) return;
  w.addEventListener('load', () => {
    setTimeout(() => { w.focus(); w.print(); }, 250);
  }, { once: true });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight') show(currentIndex - 1, true);
  if (event.key === 'ArrowLeft') show(currentIndex + 1, true);
});

fetch('content/workbook.json', { cache: 'no-store' })
  .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
  .then(data => {
    workbook = data;
    renderList();
    const requested = getRequestedPage();
    const found = workbook.pages.findIndex(p => p.id === requested);
    show(found >= 0 ? found : 0, false);
  })
  .catch(error => {
    document.querySelector('.stage').innerHTML = `<div style="background:#fff;border:1px solid #d8dee9;border-radius:12px;padding:24px;max-width:620px"><strong>לא ניתן לטעון כרגע את רשימת הדפים.</strong><p>${String(error.message || error)}</p></div>`;
  });