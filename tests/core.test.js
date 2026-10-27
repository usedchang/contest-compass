import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adjustedDifficulty, normalizeAtcoderProblem } from '../src/lib/atcoder.js';
import { filteredProblems, randomUnseen } from '../src/lib/problems.js';
import { exportCsv, statementHtml, statementMarkdown } from '../src/lib/export.js';
import { luoguIdFor, parseLuoguHtml } from '../src/lib/statement.js';
import statementWorker from '../server/statement-worker/worker.mjs';

const problems = [
  { id: '1A', source: 'codeforces', title: 'A', rating: 900, tags: ['math', 'implementation'], url: 'https://codeforces.com/problemset/problem/1/A' },
  { id: '2B', source: 'codeforces', title: 'B', rating: 1200, tags: ['implementation'], url: 'https://codeforces.com/problemset/problem/2/B' },
  { id: 'AT-abc001_a', source: 'atcoder', title: 'A', rating: 500, tags: ['ABC'], url: 'https://atcoder.jp/contests/abc001/tasks/abc001_a' },
  { id: 'AT-arc001_a', source: 'atcoder', title: 'B', rating: null, tags: ['ARC'], url: 'https://atcoder.jp/contests/arc001/tasks/arc001_a' }
];

test('AtCoder metadata has source, URL, contest tag and adjusted difficulty', () => {
  const item = normalizeAtcoderProblem({ id: 'abc123_a', contest_id: 'abc123', problem_index: 'A', name: 'Five Antennas', title: 'A. Five Antennas' }, { difficulty: -100 });
  assert.equal(item.source, 'atcoder');
  assert.equal(item.url, 'https://atcoder.jp/contests/abc123/tasks/abc123_a');
  assert.deepEqual(item.tags, ['ABC']);
  assert.equal(item.rating, adjustedDifficulty(-100));
  assert.ok(item.rating > 0 && item.rating < 400);
  assert.equal(adjustedDifficulty(800), 800);
});

test('source pools, rating, tag mode, and solved exclusion combine correctly', () => {
  const filters = { minRating: 0, maxRating: 1000, tags: [], tagMode: 'any', includeUnrated: false };
  assert.deepEqual(filteredProblems(problems, filters, new Set()).map(p => p.id), ['1A', 'AT-abc001_a']);
  assert.deepEqual(filteredProblems(problems.filter(p => p.source === 'atcoder'), filters, new Set()).map(p => p.id), ['AT-abc001_a']);
  assert.deepEqual(filteredProblems(problems, { ...filters, tags: ['ABC'] }, new Set()).map(p => p.id), ['AT-abc001_a']);
  assert.deepEqual(filteredProblems(problems, filters, new Set(['1A'])).map(p => p.id), ['AT-abc001_a']);
  assert.deepEqual(filteredProblems(problems, { ...filters, includeUnrated: true }, new Set()).map(p => p.id), ['1A', 'AT-abc001_a', 'AT-arc001_a']);
});

test('a round does not repeat a problem until all candidates were drawn', () => {
  const seen = new Set();
  for (let i = 0; i < problems.length; i++) {
    const next = randomUnseen(problems, seen);
    assert.ok(!seen.has(next.id));
    seen.add(next.id);
  }
  assert.ok(randomUnseen(problems, seen));
});

test('statement exports preserve user text and escape HTML', () => {
  const markdown = statementMarkdown(problems[2], '输入 n，输出 n²。');
  assert.match(markdown, /AtCoder AT-abc001_a/);
  assert.match(markdown, /输入 n，输出 n²/);
  const hostile = { ...problems[0], title: '<script>alert(1)</script>' };
  const html = statementHtml(hostile, '<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img/);
});

test('Luogu response keeps Chinese translation, original text, and samples', () => {
  const payload = { status: 200, data: { problem: {
    pid: 'CF1A', name: 'Sample',
    contenu: { name: '中文标题', locale: 'zh-CN', description: '中文题面 $n$', formatI: '输入 n', formatO: '输出 n' },
    content: { name: 'English title', locale: 'en', description: 'Original statement', formatI: 'Input n', formatO: 'Output n' },
    samples: ['2\n', '4\n']
  } } };
  const html = `<script id="lentille-context" type="application/json">${JSON.stringify(payload)}</script>`;
  const statement = parseLuoguHtml(html, 'CF1A');
  assert.equal(statement.chinese.sections[0].markdown, '中文题面 $n$');
  assert.equal(statement.original.locale, 'en');
  assert.deepEqual(statement.samples, [{ input: '2', output: '4' }]);
  assert.match(statementMarkdown(problems[0], statement, 'chinese'), /## 样例 1/);
  assert.equal(luoguIdFor(problems[2]), 'AT_abc001_a');
  assert.throws(() => parseLuoguHtml(html, 'CF2A'), /尚未收录/);
});

test('statement worker rejects invalid IDs and unauthorized origins', async () => {
  const invalid = await statementWorker.fetch(new Request('https://worker.example/statement?id=../../etc/passwd', { headers: { Origin: 'https://usedchang.github.io' } }));
  assert.equal(invalid.status, 400);
  const denied = await statementWorker.fetch(new Request('https://worker.example/statement?id=CF1A', { headers: { Origin: 'https://other.example' } }));
  assert.equal(denied.status, 403);
});

test('offline metadata pools are populated', () => {
  for (const [file, source] of [['cf-fallback.json', 'codeforces'], ['atcoder-fallback.json', 'atcoder']]) {
    const items = JSON.parse(readFileSync(new URL(`../public/data/${file}`, import.meta.url), 'utf8'));
    assert.ok(items.length > 1000);
    assert.ok(items.every(item => item.source === source && item.url.startsWith('https://')));
  }
});

test('CSV fields with quotes stay valid', () => {
  const csv = exportCsv([{ id: '1A', title: 'A, "B"', rating: 1000, tags: ['math'], url: 'https://example.org' }]);
  assert.match(csv, /"A, ""B"""/);
});
