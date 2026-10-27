const SECTION_FIELDS = [
  ['background', '题目背景'],
  ['description', '题目描述'],
  ['formatI', '输入格式'],
  ['formatO', '输出格式'],
  ['hint', '说明与提示']
];

export function luoguIdFor(problem) {
  if (problem?.source === 'codeforces') {
    const id = String(problem.id || '');
    if (!/^\d+[A-Z][A-Z0-9]*$/.test(id)) throw new Error('不支持的 Codeforces 题号');
    return `CF${id}`;
  }
  if (problem?.source === 'atcoder') {
    const id = String(problem.problemId || String(problem.id || '').replace(/^AT-/, ''));
    if (!/^[A-Za-z0-9_]+$/.test(id)) throw new Error('不支持的 AtCoder 题号');
    return `AT_${id}`;
  }
  throw new Error('不支持的题目来源');
}

function normalizeSamples(raw) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const pairs = typeof raw[0] === 'string' ? [raw] : raw;
  return pairs.filter(pair => Array.isArray(pair) && pair.length >= 2).map(pair => ({
    input: String(pair[0] ?? '').trimEnd(),
    output: String(pair[1] ?? '').trimEnd()
  }));
}

function variant(content) {
  if (!content || typeof content !== 'object') return null;
  const sections = SECTION_FIELDS.map(([key, heading]) => ({ heading, markdown: String(content[key] || '').trim() })).filter(section => section.markdown);
  if (!sections.some(section => section.heading === '题目描述')) return null;
  return { title: String(content.name || ''), locale: String(content.locale || ''), sections };
}

export function parseLuoguHtml(html, expectedId) {
  const match = String(html).match(/<script\s+id=["']lentille-context["']\s+type=["']application\/json["']>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('镜像页面没有可读取的题面数据');
  let context;
  try { context = JSON.parse(match[1]); }
  catch { throw new Error('镜像题面数据格式无效'); }
  const problem = context?.data?.problem;
  if (context.status !== 200 || !problem || problem.pid !== expectedId) throw new Error('镜像站尚未收录这道题');
  const chinese = variant(problem.contenu);
  const original = variant(problem.content);
  if (!chinese && !original) throw new Error('镜像站没有题面正文');
  return {
    id: expectedId,
    mirrorUrl: `https://www.luogu.com.cn/problem/${expectedId}`,
    title: String(problem.name || ''),
    chinese,
    original,
    samples: normalizeSamples(problem.samples),
    fetchedAt: Date.now()
  };
}

export function statementMarkdown(problem, statement, locale = 'chinese') {
  const variantData = statement?.[locale] || statement?.chinese || statement?.original;
  if (!variantData) return '';
  const lines = [
    `# ${variantData.title || problem.title}`,
    '',
    `> 原题：${problem.url}`,
    `> 中文镜像：${statement.mirrorUrl}`,
    ''
  ];
  for (const section of variantData.sections) lines.push(`## ${section.heading}`, '', section.markdown, '');
  statement.samples.forEach((sample, index) => {
    lines.push(`## 样例 ${index + 1}`, '', '输入：', '', '```text', sample.input, '```', '', '输出：', '', '```text', sample.output, '```', '');
  });
  return lines.join('\n').trimEnd() + '\n';
}
