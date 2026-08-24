import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

function run(command, args, label) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

run('npm', ['run', 'check'], 'Build + exact asset verification + repository validation');

console.log('\n== Start local server for real 46-page render ==');
const server = spawn('python3', ['-m', 'http.server', '4173'], {
  stdio: 'ignore',
  detached: false
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const probe = spawnSync('bash', ['-lc', 'curl -fsS http://127.0.0.1:4173/ >/dev/null'], { stdio: 'ignore' });
    if (probe.status === 0) {
      ready = true;
      break;
    }
    sleep(200);
  }
  if (!ready) throw new Error('Local workbook server did not become ready on port 4173');

  run('npm', ['run', 'render:pages'], 'Render all 46 cone A4 pages in Chrome');

  const outDir = 'qa/layout-pages';
  const rendered = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter(name => name.endsWith('.png'))
    : [];
  if (rendered.length !== 46) {
    throw new Error(`Expected 46 rendered cone pages, found ${rendered.length}`);
  }

  console.log('\nREADY: exact final assets verified, npm check passed, and 46/46 cone A4 pages rendered.');
  console.log('Next gate: reopen the pull request and require the repository GitHub Actions workflows to pass before merge.');
} finally {
  if (!server.killed) server.kill('SIGTERM');
}
