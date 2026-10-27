import { read, write } from './storage.js';

const CACHE_KEY = 'compass-cf-problems-v1';
const DAY = 24 * 60 * 60 * 1000;

export function normalizeProblem(p) {
  if (!Number.isInteger(p.contestId) || !/^[A-Z][A-Z0-9]*$/.test(p.index || '') || !p.name) return null;
  return {
    id: `${p.contestId}${p.index}`,
    contestId: p.contestId,
    index: p.index,
    title: p.name,
    rating: Number.isFinite(p.rating) ? p.rating : null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    source: 'codeforces',
    url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`
  };
}

export async function loadProblems(onUpdate) {
  const cached = read(CACHE_KEY, null);
  if (cached?.items?.length && Date.now() - cached.time < DAY) {
    onUpdate(cached.items, 'cache');
    return;
  }
  try {
    const response = await fetch('https://codeforces.com/api/problemset.problems', { signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.status !== 'OK' || !Array.isArray(json.result?.problems)) throw new Error('API 返回了无效题库');
    const seen = new Set();
    const items = json.result.problems.map(normalizeProblem).filter(p => {
      if (!p || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    if (items.length < 1000) throw new Error('题库数据不完整');
    write(CACHE_KEY, { time: Date.now(), items });
    onUpdate(items, 'live');
  } catch (error) {
    if (cached?.items?.length) { onUpdate(cached.items, 'cache'); return; }
    const response = await fetch(`${import.meta.env.BASE_URL}data/cf-fallback.json`);
    if (!response.ok) throw error;
    const items = await response.json();
    onUpdate(items, 'offline');
  }
}

export function filteredProblems(items, filters, solved = new Set()) {
  return items.filter(p => {
    if (solved.has(p.id)) return false;
    if (p.rating == null) { if (!filters.includeUnrated) return false; }
    else if (p.rating < filters.minRating || p.rating > filters.maxRating) return false;
    if (!filters.tags.length) return true;
    return filters.tagMode === 'all'
      ? filters.tags.every(tag => p.tags.includes(tag))
      : filters.tags.some(tag => p.tags.includes(tag));
  });
}

export function randomUnseen(items, seenIds) {
  if (!items.length) return null;
  let candidates = items.filter(item => !seenIds.has(item.id));
  if (!candidates.length) candidates = items;
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return candidates[value[0] % candidates.length];
}

export async function fetchSolved(handle) {
  const clean = handle.trim();
  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(clean)) throw new Error('请输入有效的 Codeforces 用户名');
  const found = new Set();
  let from = 1;
  for (let page = 0; page < 30; page++) {
    const url = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(clean)}&from=${from}&count=1000`;
    const response = await fetch(url, { signal: AbortSignal.timeout(18000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json.status !== 'OK') throw new Error(json.comment || '账号查询失败');
    const rows = json.result || [];
    for (const row of rows) {
      if (row.verdict === 'OK') {
        const p = normalizeProblem(row.problem || {});
        if (p) found.add(p.id);
      }
    }
    if (rows.length < 1000) return { handle: clean, ids: [...found], truncated: false };
    from += rows.length;
  }
  return { handle: clean, ids: [...found], truncated: true };
}
