import { statementMarkdown as serializeStatement } from './statement.js';

function escapeHtml(input) {
  return String(input).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

export function statementMarkdown(problem, customText = '', locale = 'chinese') {
  if (!problem) return '';
  if (customText && typeof customText === 'object') return serializeStatement(problem, customText, locale);
  const source = problem.source === 'atcoder' ? 'AtCoder' : 'Codeforces';
  return `# ${problem.title}\n\n> ${source} ${problem.id} · ${problem.url}\n\n${customText.trim()}\n`;
}

export function statementHtml(problem, customText = '', locale = 'chinese') {
  if (!problem) return '';
  if (customText && typeof customText === 'object') customText = serializeStatement(problem, customText, locale);
  const sections = [['题面正文', customText.trim()]];
  const article = sections.filter(([, value]) => value).map(([title, value, code]) =>
    `<section><h2>${escapeHtml(title)}</h2>${code ? `<pre>${escapeHtml(value)}</pre>` : `<p>${escapeHtml(value).replace(/\n/g, '<br>')}</p>`}</section>`).join('');
  const source = problem.source === 'atcoder' ? 'AtCoder' : 'Codeforces';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(problem.title)}</title><style>body{font:16px/1.75 system-ui,-apple-system,sans-serif;color:#242525;max-width:800px;margin:48px auto;padding:0 24px}h1{font-size:2rem;margin-bottom:0}h2{font-size:1.1rem;margin:32px 0 8px}small{color:#777}pre{background:#f4f4f2;padding:18px;white-space:pre-wrap;border-radius:8px}section{break-inside:avoid}p{white-space:pre-wrap}@media print{body{margin:10mm auto}}</style></head><body><h1>${escapeHtml(problem.title)}</h1><small>${escapeHtml(`${source} ${problem.id} · ${problem.url}`)}</small>${article}</body></html>`;
}

export function renderedStatementHtml(node) {
  if (!node) throw new Error('题面尚未渲染');
  const clean = node.cloneNode(true);
  clean.querySelectorAll('.statement-language, .statement-header .section-kicker, .statement-header .pill').forEach(element => element.remove());
  const styles = [...document.styleSheets].flatMap(sheet => {
    try { return [...sheet.cssRules].map(rule => rule.cssText); }
    catch { return []; }
  }).join('\n');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(node.querySelector('h2')?.textContent || '题面')}</title><style>${styles}</style><style>body{display:block;background:#fff;margin:0;padding:32px}.statement-card{max-width:900px;margin:0 auto;box-shadow:none;border:0}@media print{body{padding:0}.statement-card{max-width:none}}</style></head><body>${clean.outerHTML}</body></html>`;
}

export function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(problem) {
  return `${problem.id}-${problem.title}`.replace(/[\\/:*?"<>|]/g, '-').slice(0, 90);
}

export function exportCsv(items) {
  const fields = ['id', 'title', 'rating', 'tags', 'url'];
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + [fields.join(','), ...items.map(item => fields.map(field => quote(field === 'tags' ? item.tags.join('; ') : item[field])).join(','))].join('\r\n');
}
