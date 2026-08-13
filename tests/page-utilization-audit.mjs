import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = process.cwd();
const printPath = path.join(root, 'print/harut-a4.html');
const workbook = JSON.parse(fs.readFileSync(path.join(root, 'content/workbook.json'), 'utf8'));
const sequence = workbook.printSequence || [];
const worksheetById = new Map(workbook.pages.map(page => [page.id, page]));
const visualBySlug = new Map((workbook.visualPages || []).map(page => [page.slug, page]));

const labels = sequence.map((item, index) => {
  if (item.kind === 'worksheet') {
    const page = worksheetById.get(item.id);
    return { page: index + 1, kind: 'worksheet', source: `worksheet-${item.id}`, title: page?.title || '' };
  }
  const page = visualBySlug.get(item.slug);
  return { page: index + 1, kind: 'visual', source: item.slug, title: page?.title || '' };
});

const auditScript = String.raw`<script>
addEventListener('load', () => {
  setTimeout(() => {
    const result = [...document.querySelectorAll('main.a4-page')].map((main, index) => {
      const pageRect = main.getBoundingClientRect();
      const footer = main.querySelector('.gz-footer, .visual-credit');
      const footerRect = footer ? footer.getBoundingClientRect() : null;
      const bottomLimit = footerRect ? footerRect.top : pageRect.bottom - 8;
      const excluded = [
        'html','body','main','.a4-page','.sheet-content','.ayelet-sheet','.ay-bg',
        '.page-number','.local-page-number','.gz-footer','.visual-credit','.sheet-footer'
      ].join(',');
      let contentBottom = pageRect.top;
      for (const el of main.querySelectorAll('*')) {
        if (el.matches(excluded) || el.closest('.gz-footer,.visual-credit,.sheet-footer,.ay-bg,[aria-hidden="true"]')) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        if (rect.top >= bottomLimit || rect.bottom > pageRect.bottom + 1) continue;
        contentBottom = Math.max(contentBottom, rect.bottom);
      }
      const usableHeight = Math.max(1, bottomLimit - pageRect.top);
      const unusedPx = Math.max(0, bottomLimit - contentBottom);
      return {
        index,
        unusedPct: +(unusedPx / usableHeight * 100).toFixed(1),
        unusedPx: +unusedPx.toFixed(1),
        usablePx: +usableHeight.toFixed(1),
        contentBottomPx: +(contentBottom - pageRect.top).toFixed(1)
      };
    });
    const pre = document.createElement('pre');
    pre.id = 'audit-data';
    pre.textContent = JSON.stringify(result);
    document.body.append(pre);
  }, 500);
});
</script>`;

const source = fs.readFileSync(printPath, 'utf8');
const auditHtml = source.replace('</body>', `${auditScript}</body>`);
const tempPath = path.join(root, 'print/audit-utilization.html');
fs.writeFileSync(tempPath, auditHtml, 'utf8');

const server = http.createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = raw === '/' ? '/index.html' : raw;
  const target = path.normalize(path.join(root, rel));
  if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.statusCode = 404; res.end('not found'); return;
  }
  const ext = path.extname(target).toLowerCase();
  const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
  res.setHeader('content-type', type);
  fs.createReadStream(target).pipe(res);
});
await new Promise(resolve => server.listen(4174, '127.0.0.1', resolve));

const chromeCandidates = ['google-chrome', 'chromium', 'chromium-browser'];
let chrome = null;
for (const candidate of chromeCandidates) {
  const found = await new Promise(resolve => {
    const p = spawn('sh', ['-lc', `command -v ${candidate} || true`]);
    let out = '';
    p.stdout.on('data', d => out += d);
    p.on('close', () => resolve(out.trim()));
  });
  if (found) { chrome = found; break; }
}
if (!chrome) throw new Error('No Chrome/Chromium binary found on runner');

const args = [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1400,1600', '--virtual-time-budget=2500', '--dump-dom',
  'http://127.0.0.1:4174/print/audit-utilization.html'
];
const output = await new Promise((resolve, reject) => {
  const p = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  p.stdout.on('data', d => stdout += d);
  p.stderr.on('data', d => stderr += d);
  p.on('error', reject);
  p.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`)));
});
server.close();
fs.rmSync(tempPath, { force: true });

const match = output.match(/<pre id="audit-data">([^<]+)<\/pre>/);
if (!match) throw new Error('Audit data not found in rendered DOM');
const decoded = match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const metrics = JSON.parse(decoded);
const rows = metrics.map((metric, index) => ({ ...labels[index], ...metric }));
const severe = rows.filter(row => row.unusedPct >= 25);
const moderate = rows.filter(row => row.unusedPct >= 15 && row.unusedPct < 25);
const good = rows.filter(row => row.unusedPct < 15);

console.log(`UTILIZATION_SUMMARY total=${rows.length} underutilized15plus=${severe.length + moderate.length} severe25plus=${severe.length} moderate15to25=${moderate.length} goodUnder15=${good.length}`);
console.log('SEVERE_PAGES ' + severe.map(row => `${row.page}:${row.source}:${row.unusedPct}%`).join(' | '));
console.log('MODERATE_PAGES ' + moderate.map(row => `${row.page}:${row.source}:${row.unusedPct}%`).join(' | '));
console.log('ALL_PAGES ' + rows.map(row => `${row.page}:${row.unusedPct}%`).join(' | '));
