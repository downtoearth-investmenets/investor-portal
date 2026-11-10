// Local production preview: one API process plus Next.js.
process.argv[2] = 'start';
await import('./dev.mjs');
