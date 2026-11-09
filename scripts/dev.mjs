import { spawn } from 'child_process';

const services = [
  { name: 'USER-SERVICE      [4001]', cwd: './services/user-service', cmd: 'node', args: ['--disable-warning=ExperimentalWarning', 'server.mjs'] },
  { name: 'LOAN-SERVICE      [4002]', cwd: './services/loan-service', cmd: 'node', args: ['--disable-warning=ExperimentalWarning', 'server.mjs'] },
  { name: 'PORTFOLIO-SERVICE [4003]', cwd: './services/portfolio-service', cmd: 'node', args: ['server.mjs'] },
  { name: 'API-GATEWAY       [4000]', cwd: './apps/gateway', cmd: 'node', args: ['server.mjs'] },
  { name: 'NEXT-WEB-APP      [3000]', cwd: './apps/web', cmd: 'npx', args: ['next', 'dev', '-p', '3000'] }
];

console.log('\n======================================================');
console.log('   DOWN TO EARTH INVESTMENTS - MICROSERVICES RUNNER   ');
console.log('======================================================\n');

const procs = [];

for (const s of services) {
  const p = spawn(s.cmd, s.args, {
    cwd: s.cwd,
    stdio: 'inherit',
    shell: true
  });
  procs.push(p);
}

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down all services...');
  for (const p of procs) p.kill('SIGINT');
  process.exit(0);
});

