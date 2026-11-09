import { rmSync } from 'node:fs';

// Deletes the local service databases. They are re-seeded with demo data on the next start.
for (const dir of ['services/user-service/data', 'services/loan-service/data']) {
  rmSync(dir, { recursive: true, force: true });
  console.log('Removed ' + dir);
}
console.log('Restart with pnpm dev to re-seed the demo data.');

