import { luoguIdFor, parseLuoguHtml } from './statement.js';

export async function fetchAutoStatement(problem) {
  const id = luoguIdFor(problem);
  let html;
  if (window.contestNative?.fetchStatement) {
    html = await window.contestNative.fetchStatement(id);
  } else {
    const base = import.meta.env.VITE_STATEMENT_API?.trim();
    if (!base) throw new Error('网页版题面服务尚未配置，请先从原题复制正文');
    const url = `${base.replace(/\/$/, '')}/statement?id=${encodeURIComponent(id)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).error || ''; } catch { /* text response */ }
      throw new Error(detail || `题面服务返回 HTTP ${response.status}`);
    }
    html = await response.text();
  }
  return parseLuoguHtml(html, id);
}
