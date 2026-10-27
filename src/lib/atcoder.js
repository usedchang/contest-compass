import { read, write } from './storage.js';

const CACHE_KEY = 'compass-atcoder-problems-v1';
const DAY = 24 * 60 * 60 * 1000;
const API_ROOT = 'https://kenkoooo.com/atcoder/resources/';

export function adjustedDifficulty(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round(value >= 400 ? value : 400 / Math.exp((400 - value) / 400));
}

export function normalizeAtcoderProblem(problem, model) {
  if (!/^[\w-]+$/.test(problem?.id || '') || !/^[\w-]+$/.test(problem?.contest_id || '') || !problem?.name) return null;
  const contestType = /^(abc|arc|agc)\d+/i.exec(problem.contest_id)?.[1]?.toUpperCase() || 'Other';
  return {
    id: `AT-${problem.id}`,
    problemId: problem.id,
    contestId: problem.contest_id,
    index: problem.problem_index || '',
    title: problem.title || problem.name,
    rating: adjustedDifficulty(model?.difficulty),
    tags: [contestType],
    source: 'atcoder',
    url: `https://atcoder.jp/contests/${problem.contest_id}/tasks/${problem.id}`
  };
}

export async function loadAtcoder(onUpdate) {
  const cached = read(CACHE_KEY, null);
  if (cached?.items?.length && Date.now() - cached.time < DAY) {
    onUpdate(cached.items, 'cache');
    return;
  }
  try {
    let problems;
    let models;
    if (window.contestNative?.fetchAtcoderCatalog) {
      ({ problems, models } = await window.contestNative.fetchAtcoderCatalog());
    } else if (import.meta.env.VITE_STATEMENT_API?.trim()) {
      const root = import.meta.env.VITE_STATEMENT_API.trim().replace(/\/$/, '');
      const response = await fetch(`${root}/atcoder/catalog`, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`题库服务返回 HTTP ${response.status}`);
      ({ problems, models } = await response.json());
    } else {
      const [problemsResponse, modelsResponse] = await Promise.all([
        fetch(`${API_ROOT}problems.json`, { signal: AbortSignal.timeout(18000) }),
        fetch(`${API_ROOT}problem-models.json`, { signal: AbortSignal.timeout(18000) })
      ]);
      if (!problemsResponse.ok || !modelsResponse.ok) throw new Error('AtCoder 题库请求失败');
      [problems, models] = await Promise.all([problemsResponse.json(), modelsResponse.json()]);
    }
    if (!Array.isArray(problems) || problems.length < 1000 || !models || typeof models !== 'object') throw new Error('AtCoder 题库数据不完整');
    const seen = new Set();
    const items = problems.map(p => normalizeAtcoderProblem(p, models[p.id])).filter(p => {
      if (!p || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
    write(CACHE_KEY, { time: Date.now(), items });
    onUpdate(items, 'live');
  } catch (error) {
    if (cached?.items?.length) { onUpdate(cached.items, 'cache'); return; }
    const response = await fetch(`${import.meta.env.BASE_URL}data/atcoder-fallback.json`);
    if (!response.ok) throw error;
    onUpdate(await response.json(), 'offline');
  }
}
