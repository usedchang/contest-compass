const ID_PATTERN = /^(?:CF\d+[A-Z][A-Z0-9]*|AT_[A-Za-z0-9_]+)$/;
const DEFAULT_ORIGINS = 'https://usedchang.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function jsonError(message, status, headers) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS).split(',').map(value => value.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return jsonError('来源站点未获授权', 403, {});
    const headers = corsHeaders(origin || allowed[0]);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return jsonError('仅支持 GET 请求', 405, headers);
    if (url.pathname === '/health') return new Response(JSON.stringify({ ok: true }), { headers: { ...headers, 'Content-Type': 'application/json' } });
    if (url.pathname === '/atcoder/catalog') {
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      const cacheKey = new Request(`${url.origin}/atcoder/catalog`);
      let catalog = cache ? await cache.match(cacheKey).then(response => response?.text()) : null;
      if (!catalog) {
        try {
          const [problemsResponse, modelsResponse] = await Promise.all([
            fetch('https://kenkoooo.com/atcoder/resources/problems.json', { signal: AbortSignal.timeout(18000) }),
            fetch('https://kenkoooo.com/atcoder/resources/problem-models.json', { signal: AbortSignal.timeout(18000) })
          ]);
          if (!problemsResponse.ok || !modelsResponse.ok) return jsonError('AtCoder 题库暂时不可用', 502, headers);
          const [problems, models] = await Promise.all([problemsResponse.json(), modelsResponse.json()]);
          if (!Array.isArray(problems) || problems.length < 1000 || !models || typeof models !== 'object') return jsonError('AtCoder 题库数据不完整', 502, headers);
          catalog = JSON.stringify({ problems, models });
          if (cache && typeof ctx.waitUntil === 'function') ctx.waitUntil(cache.put(cacheKey, new Response(catalog, { headers: { 'Cache-Control': 'public, max-age=21600' } })));
        } catch { return jsonError('AtCoder 题库请求失败', 502, headers); }
      }
      return new Response(catalog, { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=21600' } });
    }
    if (url.pathname !== '/statement') return jsonError('接口不存在', 404, headers);

    const id = url.searchParams.get('id') || '';
    if (!ID_PATTERN.test(id)) return jsonError('无效的题号', 400, headers);
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const cacheKey = new Request(`${url.origin}/statement?id=${encodeURIComponent(id)}`);
    let html = cache ? await cache.match(cacheKey).then(response => response?.text()) : null;
    if (!html) {
      try {
        const upstream = await fetch(`https://www.luogu.com.cn/problem/${id}?_contentOnly=1`, { signal: AbortSignal.timeout(12000) });
        if (!upstream.ok) return jsonError(`镜像站返回 HTTP ${upstream.status}`, 502, headers);
        html = await upstream.text();
        if (html.length > 2_000_000 || !html.includes('lentille-context')) return jsonError('镜像站没有返回题面数据', 502, headers);
        if (cache && typeof ctx.waitUntil === 'function') ctx.waitUntil(cache.put(cacheKey, new Response(html, { headers: { 'Cache-Control': 'public, max-age=604800' } })));
      } catch { return jsonError('题面服务暂时无法连接镜像站', 502, headers); }
    }
    return new Response(html, { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' } });
  }
};
