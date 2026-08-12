const container = document.querySelector('#print-pages');
const status = document.querySelector('#print-status');
const printButton = document.querySelector('#print-all-button');

async function loadPage(page) {
  const response = await fetch(`worksheets/${page.slug}.html`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`עמוד ${page.id}: HTTP ${response.status}`);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('.a4-page');
  if (!main) throw new Error(`עמוד ${page.id}: לא נמצא A4`);
  return main;
}

async function build() {
  try {
    const workbookResponse = await fetch('content/workbook.json', { cache: 'no-store' });
    if (!workbookResponse.ok) throw new Error(`workbook: HTTP ${workbookResponse.status}`);
    const workbook = await workbookResponse.json();
    status.textContent = `טוען ${workbook.pages.length} דפים…`;
    const mains = [];
    for (const page of workbook.pages) mains.push(await loadPage(page));
    container.replaceChildren(...mains);
    status.textContent = `${workbook.pages.length} דפי A4 מוכנים להדפסה`;
    printButton.disabled = false;
  } catch (error) {
    container.innerHTML = `<div class="print-error"><strong>לא ניתן לבנות את החוברת.</strong><p>${String(error.message || error)}</p></div>`;
    status.textContent = 'שגיאה בטעינת החוברת';
  }
}

printButton.addEventListener('click', () => window.print());
build();
