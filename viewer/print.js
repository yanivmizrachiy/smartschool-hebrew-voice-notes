const container = document.querySelector('#print-pages');
const status = document.querySelector('#print-status');
const printButton = document.querySelector('#print-all-button');

async function loadEntry(entry, workbook) {
  let url;
  let label;
  let isVisual = false;
  if (entry.kind === 'worksheet') {
    const page = workbook.pages.find(item => item.id === entry.id);
    if (!page) throw new Error('דף עבודה לא נמצא במקור האמת');
    url = `worksheets/${page.slug}.html`;
    label = page.title;
  } else if (entry.kind === 'visual') {
    const page = (workbook.visualPages || []).find(item => item.slug === entry.slug);
    if (!page) throw new Error('דף חזותי לא נמצא במקור האמת');
    url = `visual-pages/${page.slug}.html`;
    label = page.title;
    isVisual = true;
  } else {
    throw new Error(`סוג דף לא מוכר: ${entry.kind}`);
  }
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('.a4-page');
  if (!main) throw new Error(`${label}: לא נמצא A4`);
  if (isVisual) {
    for (const image of main.querySelectorAll('img[src^="../visual-assets/"]')) {
      image.setAttribute('src', image.getAttribute('src').replace(/^\.\.\//, ''));
    }
  }
  return main;
}

function prepareLocalPage(main, pageNumber) {
  main.querySelector('.sheet-footer')?.remove();
  main.querySelector('.book-page-number')?.remove();
  main.dataset.localPage = String(pageNumber);

  let number = main.querySelector('.page-number, .local-page-number');
  if (!number) {
    const header = main.querySelector('.header-container');
    number = document.createElement('div');
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
  number.setAttribute('aria-label', `עמוד ${pageNumber}`);
  number.textContent = String(pageNumber);
  return main;
}

async function build() {
  try {
    const workbookResponse = await fetch('content/workbook.json', { cache: 'no-store' });
    if (!workbookResponse.ok) throw new Error(`workbook: HTTP ${workbookResponse.status}`);
    const workbook = await workbookResponse.json();
    const sequence = workbook.printSequence || workbook.pages.map(page => ({ kind: 'worksheet', id: page.id }));
    status.textContent = `טוען ${sequence.length} דפי A4…`;
    const mains = [];
    for (const [index, entry] of sequence.entries()) {
      const main = await loadEntry(entry, workbook);
      mains.push(prepareLocalPage(main, index + 1));
    }
    container.replaceChildren(...mains);
    status.textContent = `${sequence.length} דפי A4 מוכנים להדפסה`;
    printButton.disabled = false;
  } catch (error) {
    container.innerHTML = `<div class="print-error"><strong>לא ניתן לבנות את החוברת.</strong><p>${String(error.message || error)}</p></div>`;
    status.textContent = 'שגיאה בטעינת החוברת';
  }
}

printButton.addEventListener('click', () => window.print());
build();
