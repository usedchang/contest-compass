import { readFile, writeFile } from 'node:fs/promises';

const html = await readFile('dist/index.html', 'utf8');
const assets = [...new Set([...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?]+)"/g)].map(match => match[1]))];
if (!assets.length) throw new Error('No built assets found for offline cache');
const sw = await readFile('dist/sw.js', 'utf8');
const marker = 'const PRECACHE = [];';
if (!sw.includes(marker)) throw new Error('Service worker precache marker missing');
await writeFile('dist/sw.js', sw.replace(marker, `const PRECACHE = ${JSON.stringify(assets)};`));
console.log(`Precached ${assets.length} built assets`);
