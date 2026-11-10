import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const next = createRequire(new URL('../apps/web/package.json', import.meta.url)).resolve('next/dist/bin/next');
const mode = process.argv[2] === 'start' ? 'start' : 'dev';
const children = [
  spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'apps/backend/server.mjs'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [next, mode, '-p', '3000'], { cwd: web, stdio: 'inherit' })
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
}
for (const child of children) {
  child.once('exit', code => stop(code ?? 1));
  child.once('error', error => { console.error(error.message); stop(1); });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
