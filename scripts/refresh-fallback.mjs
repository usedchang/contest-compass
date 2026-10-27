import { writeFile, mkdir } from 'node:fs/promises';
import { normalizeAtcoderProblem } from '../src/lib/atcoder.js';

const response = await fetch('https://codeforces.com/api/problemset.problems');
if (!response.ok) throw new Error(`Codeforces API HTTP ${response.status}`);
const json = await response.json();
if (json.status !== 'OK') throw new Error(json.comment || 'Codeforces API error');
const groups = new Map();
for (const p of json.result.problems) {
  if (!Number.isInteger(p.contestId) || !/^[A-Z][A-Z0-9]*$/.test(p.index || '') || !p.name) continue;
  const band = p.rating == null ? 'unrated' : String(Math.floor(p.rating / 100) * 100);
  if (!groups.has(band)) groups.set(band, []);
  groups.get(band).push({ id: `${p.contestId}${p.index}`, contestId: p.contestId, index: p.index, title: p.name,
    rating: p.rating ?? null, tags: p.tags || [], source: 'codeforces', url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}` });
}
const score = id => [...id].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const picked = [...groups.values()].flatMap(group => group.sort((a, b) => score(a.id) - score(b.id)).slice(0, 45));
await mkdir('public/data', { recursive: true });
await writeFile('public/data/cf-fallback.json', JSON.stringify(picked));
console.log(`Wrote ${picked.length} Codeforces metadata records`);

const [atProblemsResponse, atModelsResponse] = await Promise.all([
  fetch('https://kenkoooo.com/atcoder/resources/problems.json'),
  fetch('https://kenkoooo.com/atcoder/resources/problem-models.json')
]);
if (!atProblemsResponse.ok || !atModelsResponse.ok) throw new Error('AtCoder API error');
const [atProblems, atModels] = await Promise.all([atProblemsResponse.json(), atModelsResponse.json()]);
const atItems = [];
const atSeen = new Set();
for (const p of atProblems) {
  const item = normalizeAtcoderProblem(p, atModels[p.id]);
  if (!item || atSeen.has(item.id)) continue;
  atSeen.add(item.id);
  atItems.push(item);
}
await writeFile('public/data/atcoder-fallback.json', JSON.stringify(atItems));
console.log(`Wrote ${atItems.length} AtCoder metadata records`);
