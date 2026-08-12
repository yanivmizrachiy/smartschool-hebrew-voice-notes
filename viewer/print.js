const container = document.querySelector('#print-pages');
const status = document.querySelector('#print-status');
const printButton = document.querySelector('#print-all-button');

async function loadEntry(entry, workbook) {
  let url;
  let label;
  if (entry.kind === 'worksheet') {
    const page = workbook.pages.find(item => item.id === entry.id);
    if (!page) throw new Error(`עמוד ${entry.id}: לא נמצא במקור האמת`);
    url = `worksheets/${page.slug}.html`;
    label = `עמוד ${page.id}`;
  } else if (entry.kind === 'visual') {
    const page = (workbook.visualPages || []).find(item => item.slug === entry.slug);
    if (!page) throw new Error(`דף חזותי ${entry.slug}: לא נמצא במקור האמת`);
    url = `visual-pages/${page.slug}.html`;
    label = page.title;
  } else {
    throw new Error(`סוג דף לא מוכר: ${entry.kind}`);
  }
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const main = doc.querySelector('.a4-page');
  if (!main) throw new Error(`${label}: לא נמצא A4`);
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
    for (const entry of sequence) mains.push(await loadEntry(entry, workbook));
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
