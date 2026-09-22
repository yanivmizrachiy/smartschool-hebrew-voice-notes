import { synchronizeWorkbookSources } from './source-sync.mjs';

const result = synchronizeWorkbookSources({ write: false });
console.log(`Build validation passed: ${result.worksheets} worksheets + ${result.visualPages} visual pages are synchronized; source files were not modified.`);
