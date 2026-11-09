import { spawn } from 'child_process';

const services = [
  { name: 'user-service', cwd: './services/user-service', cmd: 'node', args: ['--disable-warning=ExperimentalWarning', 'server.mjs'] },
  { name: 'loan-service', cwd: './services/loan-service', cmd: 'node', args: ['--disable-warning=ExperimentalWarning', 'server.mjs'] },
  { name: 'portfolio-service', cwd: './services/portfolio-service', cmd: 'node', args: ['server.mjs'] },
  { name: 'gateway', cwd: './apps/gateway', cmd: 'node', args: ['server.mjs'] },
  { name: 'web', cwd: './apps/web', cmd: 'npx', args: ['next', 'start', '-p', '3000'] }
];

const procs = [];

for (const s of services) {
  const p = spawn(s.cmd, s.args, { cwd: s.cwd, stdio: 'inherit', shell: true });
  procs.push(p);
}

process.on('SIGINT', () => {
  for (const p of procs) p.kill('SIGINT');
  process.exit(0);
});

