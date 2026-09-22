import { synchronizeWorkbookSources } from './source-sync.mjs';

const result = synchronizeWorkbookSources({ write: true });
console.log(`Source synchronization completed intentionally: ${result.worksheets} worksheets + ${result.visualPages} visual pages.`);
