import { readFile, readdir, writeFile } from 'node:fs/promises';

const assets = (await readdir('dist/assets', { withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => `./assets/${entry.name}`);
if (!assets.length) throw new Error('No built assets found for offline cache');
const sw = await readFile('dist/sw.js', 'utf8');
const marker = 'const PRECACHE = [];';
if (!sw.includes(marker)) throw new Error('Service worker precache marker missing');
await writeFile('dist/sw.js', sw.replace(marker, `const PRECACHE = ${JSON.stringify(assets)};`));
console.log(`Precached ${assets.length} built assets`);
