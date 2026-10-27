import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { toPng } from 'html-to-image';
import { ArrowDownToLine, ArrowRight, BookOpen, Bookmark, Check, CheckCircle2, ChevronDown, CircleHelp, Code2, Compass, Download, ExternalLink, FileCode2, FileDown, FileText, Filter, History, Info, Laptop, Link2, Menu, RotateCcw, Search, Settings2, Shuffle, Sparkles } from 'lucide-react';
import { loadAtcoder } from './lib/atcoder';
import { exportCsv, downloadText, renderedStatementHtml, safeFilename, statementHtml, statementMarkdown } from './lib/export';
import { fetchAutoStatement } from './lib/statement-client';
import { fetchSolved, filteredProblems, loadProblems, randomUnseen } from './lib/problems';
import { read, write } from './lib/storage';

const defaultFilters = { minRating: 0, maxRating: 4000, tags: [], tagMode: 'any', includeUnrated: true, excludeSolved: true };
const nav = [
  { id: 'random', label: '随机练题', icon: Shuffle },
  { id: 'library', label: '我的题单', icon: Bookmark },
  { id: 'studio', label: '题面导出', icon: FileDown },
  { id: 'settings', label: '客户端与设置', icon: Settings2 }
];
const nf = new Intl.NumberFormat('zh-CN');

function Logo() {
  return <div className="brand"><div className="brand-mark"><Compass size={24} strokeWidth={2.5} /></div><div><strong>contest<span>compass</span></strong><small>让下一道好题恰好出现</small></div></div>;
}

function Pill({ children, tone = '' }) { return <span className={`pill ${tone}`}>{children}</span>; }

function MarkdownBody({ children }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{children}</ReactMarkdown>;
}

function ProblemArticle({ problem, customText, autoStatement, locale }) {
  if (!problem) return null;
  const variant = autoStatement?.[locale] || autoStatement?.chinese || autoStatement?.original;
  return <div className="statement-body">
    {customText?.trim() ? <section><h3>我的题面</h3><div className="statement-markdown"><MarkdownBody>{customText}</MarkdownBody></div></section>
      : variant ? <>
        {variant.sections.map(section => <section key={section.heading}><h3>{section.heading}</h3><div className="statement-markdown"><MarkdownBody>{section.markdown}</MarkdownBody></div></section>)}
        {autoStatement.samples.map((sample, index) => <div className="sample-grid" key={index}><section><h3>样例 {index + 1} · 输入</h3><pre>{sample.input}</pre></section><section><h3>样例 {index + 1} · 输出</h3><pre>{sample.output}</pre></section></div>)}
      </> : <div className="statement-empty"><FileText size={25} /><strong>还没有这道题的题面正文</strong><span>正在尝试获取中文镜像题面。也可以从原题复制文字，在右侧保存后导出。</span></div>}
  </div>;
}

function FilterPanel({ source, setSource, filters, setFilters, tags, poolSize, cfCount, cfOrigin, cfStatus, atCount, atOrigin, atStatus, onReset }) {
  const [showAllTags, setShowAllTags] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const shown = tags.filter(tag => tag.toLowerCase().includes(tagSearch.toLowerCase())).slice(0, showAllTags ? 100 : 12);
  const set = patch => setFilters(f => ({ ...f, ...patch }));
  const toggleTag = tag => set({ tags: filters.tags.includes(tag) ? filters.tags.filter(t => t !== tag) : [...filters.tags, tag] });
  return <aside className="filter-card">
    <div className="card-heading"><div><Filter size={17} /><strong>筛选条件</strong></div><button className="text-button" onClick={onReset}><RotateCcw size={14} /> 重置</button></div>
    <div className="filter-group"><label className="group-label">随机来源</label><div className="source-switch"><button className={source === 'all' ? 'active' : ''} onClick={() => setSource('all')}>两站混合</button><button className={source === 'codeforces' ? 'active' : ''} onClick={() => setSource('codeforces')}>Codeforces</button><button className={source === 'atcoder' ? 'active' : ''} onClick={() => setSource('atcoder')}>AtCoder</button></div><p className="helper-text">{source === 'all' ? `Codeforces ${nf.format(cfCount)} 题 · AtCoder ${nf.format(atCount)} 题` : source === 'codeforces' ? cfStatus === 'loading' ? '正在获取 Codeforces 题库…' : `${nf.format(cfCount)} 题 · ${cfOrigin === 'offline' ? '离线备用数据' : cfOrigin === 'cache' ? '本机缓存' : '在线数据'}` : atStatus === 'loading' ? '正在获取 AtCoder 题库…' : `${nf.format(atCount)} 题 · ${atOrigin === 'bundled' ? '内置完整目录' : atOrigin === 'cache' ? '本机缓存' : '在线数据'}`}</p></div>
    <div className="filter-group"><div className="label-row"><label className="group-label" htmlFor="min-rating">难度分数</label><span className="range-label">{filters.minRating} — {filters.maxRating}</span></div><div className="range-row"><div><span>最低</span><input id="min-rating" type="number" min="0" max="4000" step="100" value={filters.minRating} onChange={e => set({ minRating: Math.min(Number(e.target.value) || 0, filters.maxRating) })} /></div><span className="range-dash">—</span><div><span>最高</span><input type="number" min="0" max="4000" step="100" value={filters.maxRating} onChange={e => set({ maxRating: Math.max(Number(e.target.value) || 0, filters.minRating) })} /></div></div><div className="range-track"><input aria-label="最低难度" type="range" min="0" max="4000" step="100" value={filters.minRating} onChange={e => set({ minRating: Math.min(Number(e.target.value), filters.maxRating) })} /><input aria-label="最高难度" type="range" min="0" max="4000" step="100" value={filters.maxRating} onChange={e => set({ maxRating: Math.max(Number(e.target.value), filters.minRating) })} /></div></div>
    <div className="filter-group tag-group"><div className="label-row"><label className="group-label">算法 / 比赛标签</label><span className="selected-count">{filters.tags.length ? `已选 ${filters.tags.length}` : '不限'}</span></div><div className="tag-search"><Search size={15} /><input aria-label="搜索标签" placeholder="搜索标签" value={tagSearch} onChange={e => setTagSearch(e.target.value)} /></div><div className="tag-list">{shown.map(tag => <button key={tag} className={`tag-choice ${filters.tags.includes(tag) ? 'selected' : ''}`} onClick={() => toggleTag(tag)}>{filters.tags.includes(tag) && <Check size={12} />}{tag}</button>)}</div>{tags.length > 12 && <button className="show-tags" onClick={() => setShowAllTags(!showAllTags)}>{showAllTags ? '收起标签' : `查看全部 ${tags.length} 个标签`} <ChevronDown size={14} className={showAllTags ? 'up' : ''} /></button>}{filters.tags.length > 1 && <div className="mode-switch"><button className={filters.tagMode === 'any' ? 'active' : ''} onClick={() => set({ tagMode: 'any' })}>满足任一</button><button className={filters.tagMode === 'all' ? 'active' : ''} onClick={() => set({ tagMode: 'all' })}>同时满足</button></div>}</div>
    <div className="filter-options"><label><input type="checkbox" checked={filters.includeUnrated} onChange={e => set({ includeUnrated: e.target.checked })} />包含未评级题目</label><label><input type="checkbox" checked={filters.excludeSolved} onChange={e => set({ excludeSolved: e.target.checked })} />排除已完成题目</label></div>
    <div className="pool-summary"><div className="pool-dot" /><span>当前候选题目</span><strong>{nf.format(poolSize)}</strong></div>
  </aside>;
}

function App() {
  const [view, setView] = useState('random');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [source, setSourceState] = useState(() => {
    const saved = read('compass-source', 'all');
    return ['all', 'codeforces', 'atcoder'].includes(saved) ? saved : 'all';
  });
  const [filters, setFilters] = useState(read('compass-filters-v3', defaultFilters));
  const [cfProblems, setCfProblems] = useState([]);
  const [cfStatus, setCfStatus] = useState('loading');
  const [cfOrigin, setCfOrigin] = useState('');
  const [atProblems, setAtProblems] = useState([]);
  const [atStatus, setAtStatus] = useState('loading');
  const [atOrigin, setAtOrigin] = useState('');
  const [current, setCurrent] = useState(null);
  const [cycleIds, setCycleIds] = useState(new Set());
  const [history, setHistory] = useState(() => read('compass-history', []).filter(item => item.source === 'codeforces' || item.source === 'atcoder'));
  const [favorites, setFavorites] = useState(() => read('compass-favorites', []).filter(id => !String(id).startsWith('cc-')));
  const [manualSolved, setManualSolved] = useState(read('compass-solved', []));
  const [cfBinding, setCfBinding] = useState(read('compass-cf-binding', { handle: '', ids: [], updatedAt: 0 }));
  const [cfInput, setCfInput] = useState(cfBinding.handle);
  const [cfLoading, setCfLoading] = useState(false);
  const [customStatements, setCustomStatements] = useState(read('compass-statements', {}));
  const [autoStatements, setAutoStatements] = useState(read('compass-auto-statements-v1', {}));
  const [statementLocale, setStatementLocale] = useState('chinese');
  const [statementStatus, setStatementStatus] = useState({ id: '', state: 'idle', error: '' });
  const statementRef = useRef(null);
  const [libraryTab, setLibraryTab] = useState('favorites');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [toast, setToast] = useState('');
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => { loadProblems((items, origin) => { setCfProblems(items); setCfOrigin(origin); setCfStatus('ready'); }).catch(() => setCfStatus('error')); }, []);
  useEffect(() => { loadAtcoder((items, origin) => { setAtProblems(items); setAtOrigin(origin); setAtStatus('ready'); }).catch(() => setAtStatus('error')); }, []);
  useEffect(() => { write('compass-filters-v3', filters); }, [filters]);
  useEffect(() => { write('compass-source', source); }, [source]);
  useEffect(() => { write('compass-history', history); }, [history]);
  useEffect(() => { write('compass-favorites', favorites); }, [favorites]);
  useEffect(() => { write('compass-solved', manualSolved); }, [manualSolved]);
  useEffect(() => { write('compass-cf-binding', cfBinding); }, [cfBinding]);
  useEffect(() => { write('compass-statements', customStatements); }, [customStatements]);
  useEffect(() => { write('compass-auto-statements-v1', autoStatements); }, [autoStatements]);
  useEffect(() => { const handler = e => { e.preventDefault(); setInstallEvent(e); }; window.addEventListener('beforeinstallprompt', handler); return () => window.removeEventListener('beforeinstallprompt', handler); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer); }, [toast]);

  const allById = useMemo(() => new Map([...cfProblems, ...atProblems, ...history].map(item => [item.id, item])), [cfProblems, atProblems, history]);
  const items = useMemo(() => source === 'codeforces' ? cfProblems : source === 'atcoder' ? atProblems : [...cfProblems, ...atProblems], [source, cfProblems, atProblems]);
  const tags = useMemo(() => [...new Set(items.flatMap(item => item.tags))].sort((a, b) => a.localeCompare(b)), [items]);
  const solvedIds = useMemo(() => new Set([...manualSolved, ...cfBinding.ids]), [manualSolved, cfBinding]);
  const pool = useMemo(() => filteredProblems(items, filters, filters.excludeSolved ? solvedIds : new Set()), [items, filters, solvedIds]);
  const currentInPool = !current || pool.some(item => item.id === current.id);
  const isFavorite = !!current && favorites.includes(current.id);
  const isSolved = !!current && solvedIds.has(current.id);
  const currentStatement = current ? customStatements[current.id] || '' : '';
  const currentAuto = current ? autoStatements[current.id] : null;
  const canExport = !!current && (!!currentStatement.trim() || !!currentAuto);
  const repo = import.meta.env.VITE_REPOSITORY_URL || '';
  const releasesUrl = repo ? `${repo.replace(/\/$/, '')}/releases/latest` : '';

  useEffect(() => {
    if (current || !pool.length) return;
    const next = randomUnseen(pool, new Set());
    setCurrent(next);
    setCycleIds(new Set([next.id]));
    setHistory(previous => [next, ...previous.filter(item => item.id !== next.id)].slice(0, 100));
  }, [current, pool]);

  useEffect(() => { setStatementLocale('chinese'); }, [current?.id]);
  useEffect(() => {
    if (view !== 'studio' || !current || autoStatements[current.id]) return;
    let cancelled = false;
    setStatementStatus({ id: current.id, state: 'loading', error: '' });
    fetchAutoStatement(current).then(statement => {
      if (cancelled) return;
      setAutoStatements(previous => {
        const next = { ...previous, [current.id]: statement };
        const keys = Object.keys(next).sort((a, b) => (next[b].fetchedAt || 0) - (next[a].fetchedAt || 0));
        return Object.fromEntries(keys.slice(0, 20).map(key => [key, next[key]]));
      });
      setStatementStatus({ id: current.id, state: 'ready', error: '' });
    }).catch(error => {
      if (!cancelled) setStatementStatus({ id: current.id, state: 'error', error: error.message });
    });
    return () => { cancelled = true; };
  }, [view, current?.id, autoStatements]);

  function switchSource(next) { setSourceState(next); setCurrent(null); setCycleIds(new Set()); }
  function draw() {
    if (!pool.length) { setToast('当前条件下没有候选题目，请调整筛选。'); return; }
    const next = randomUnseen(pool, cycleIds);
    setCycleIds(previous => {
      const copy = pool.every(item => previous.has(item.id)) ? new Set() : new Set(previous);
      copy.add(next.id);
      return copy;
    });
    setCurrent(next);
    setHistory(previous => [next, ...previous.filter(item => item.id !== next.id)].slice(0, 100));
  }
  function toggleFavorite(problem = current) {
    if (!problem) return;
    const had = favorites.includes(problem.id);
    setFavorites(previous => had ? previous.filter(id => id !== problem.id) : [problem.id, ...previous]);
    setToast(had ? '已从题单移除' : '已加入我的题单');
  }
  function toggleSolved(problem = current) {
    if (!problem) return;
    if (cfBinding.ids.includes(problem.id)) { setToast('此题来自 Codeforces AC 记录，无法手动取消。'); return; }
    setManualSolved(previous => previous.includes(problem.id) ? previous.filter(id => id !== problem.id) : [...previous, problem.id]);
  }
  function selectProblem(problem, target = 'studio') { setCurrent(problem); setView(target); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function notifyCopy(value) { navigator.clipboard.writeText(value).then(() => setToast('链接已复制')).catch(() => setToast('复制失败，请手动复制链接')); }
  async function exportStatement(format) {
    if (!canExport) { setToast('请先保存题面正文，再进行导出。'); return; }
    const name = safeFilename(current);
    const content = currentStatement.trim() || currentAuto;
    if (format === 'md') downloadText(`${name}.md`, statementMarkdown(current, content, statementLocale), 'text/markdown;charset=utf-8');
    if (format === 'html') downloadText(`${name}.html`, statementRef.current ? renderedStatementHtml(statementRef.current) : statementHtml(current, content, statementLocale), 'text/html;charset=utf-8');
    if (format === 'pdf') {
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
      frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 60000); };
      document.body.append(frame);
      frame.srcdoc = statementRef.current ? renderedStatementHtml(statementRef.current) : statementHtml(current, content, statementLocale);
    }
    if (format === 'png') {
      try {
        const node = statementRef.current;
        if (!node) throw new Error('题面尚未渲染');
        const pixelRatio = Math.min(2, Math.max(1, 12000 / node.scrollHeight));
        const dataUrl = await toPng(node, {
          pixelRatio, backgroundColor: '#ffffff', skipFonts: true, cacheBust: true,
          filter: element => !element.classList?.contains('statement-language') && !element.classList?.contains('section-kicker') && !element.classList?.contains('pill')
        });
        if (window.contestNative?.savePng) {
          const result = await window.contestNative.savePng(`${name}.png`, dataUrl);
          if (!result.saved) return;
        } else {
          const link = document.createElement('a');
          link.download = `${name}.png`;
          link.href = dataUrl;
          document.body.append(link);
          link.click();
          link.remove();
        }
      } catch (error) { setToast(`图片导出失败：${error.message}`); return; }
    }
    setToast(format === 'pdf' ? '已打开打印窗口，可选择“另存为 PDF”' : '题面已导出');
  }
  async function retryAutoStatement() {
    if (!current) return;
    setStatementStatus({ id: current.id, state: 'loading', error: '' });
    try {
      const statement = await fetchAutoStatement(current);
      setAutoStatements(previous => ({ ...previous, [current.id]: statement }));
      setStatementStatus({ id: current.id, state: 'ready', error: '' });
    } catch (error) { setStatementStatus({ id: current.id, state: 'error', error: error.message }); }
  }
  async function bindCf() {
    setCfLoading(true);
    try { const result = await fetchSolved(cfInput); setCfBinding({ ...result, updatedAt: Date.now() }); setToast(`已同步 ${result.ids.length} 道 AC 题`); }
    catch (error) { setToast(`同步失败：${error.message}`); }
    finally { setCfLoading(false); }
  }
  function downloadLibrary(format) {
    const selected = favorites.map(id => allById.get(id)).filter(Boolean);
    if (!selected.length) { setToast('题单是空的，先收藏几道题吧。'); return; }
    if (format === 'csv') downloadText('contest-compass-题单.csv', exportCsv(selected), 'text/csv;charset=utf-8');
    else downloadText('contest-compass-题单.json', JSON.stringify(selected, null, 2), 'application/json;charset=utf-8');
    setToast('题单已导出');
  }
  const listIds = libraryTab === 'favorites' ? favorites : history.map(item => item.id);
  const listed = listIds.map(id => allById.get(id)).filter(Boolean).filter(item => `${item.id} ${item.title} ${item.tags.join(' ')}`.toLowerCase().includes(libraryQuery.toLowerCase()));
  const openView = id => { setView(id); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <div className="app-shell">
    {mobileMenu && <button className="mobile-overlay" aria-label="关闭菜单" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'is-open' : ''}`}><Logo /><div className="sidebar-section-label">WORKSPACE</div><nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => openView(id)}><Icon size={18} /><span>{label}</span>{id === 'library' && favorites.length > 0 && <em>{favorites.length}</em>}</button>)}</nav><div className="sidebar-spacer" /><div className="sidebar-note"><div className="note-icon"><Sparkles size={17} /></div><strong>每天一道，稳步向前。</strong><p>Codeforces 与 AtCoder 题库联网更新，离线时使用备用数据。</p><button onClick={() => openView('settings')}>了解客户端 <ArrowRight size={14} /></button></div><div className="sidebar-footer"><span className="online-dot" /> 独立开源工具 <span>v1.0</span></div></aside>

    <main className="main-content"><header className="topbar"><button className="menu-button" aria-label="打开菜单" onClick={() => setMobileMenu(true)}><Menu size={21} /></button><div className="breadcrumb">工作台 <span>/</span> {nav.find(item => item.id === view)?.label}</div><div className="topbar-actions"><span className="today-label">按自己的节奏，认真做题</span><button className="avatar-button" title="客户端与设置" onClick={() => openView('settings')}><Settings2 size={18} /></button></div></header>
      <div className="page-content">
        {view === 'random' && <>
          <div className="page-eyebrow"><span className="eyebrow-line" /> YOUR DAILY PRACTICE</div>
          <div className="page-title-row"><div><h1>今天，来一道<span>好题。</span></h1><p className="page-subtitle">按来源、难度和标签筛选，在刚刚好的范围里发现下一道题。</p></div><div className="title-counter"><div className="counter-icon"><BookOpen size={20} /></div><div><strong>{nf.format(items.length)}</strong><span>题目可探索</span></div></div></div>
          <div className="random-layout"><FilterPanel source={source} setSource={switchSource} filters={filters} setFilters={setFilters} tags={tags} poolSize={pool.length} cfCount={cfProblems.length} cfOrigin={cfOrigin} cfStatus={cfStatus} atCount={atProblems.length} atOrigin={atOrigin} atStatus={atStatus} onReset={() => { setFilters(defaultFilters); setCycleIds(new Set()); }} />
            <div className="random-column"><div className="result-card"><div className="result-card-top"><span className="section-kicker"><span className="pulse-dot" /> 随机抽取结果</span><span className="draw-count">本轮已抽 {cycleIds.size} 题</span></div>
              {current ? <><div className="problem-topline"><span className="problem-id">{current.id}</span><Pill tone="rating">{current.rating ?? '未评级'}</Pill><Pill tone="source">{current.source === 'codeforces' ? 'CODEFORCES' : 'ATCODER'}</Pill></div><h2 className="problem-title"><a href={current.url} target="_blank" rel="noopener noreferrer" title="打开原题">{current.title}</a></h2><div className="problem-tags">{current.tags.map(tag => <Pill key={tag}>{tag}</Pill>)}</div><p className="problem-intro">{`一道来自 ${current.source === 'atcoder' ? 'AtCoder' : 'Codeforces'} 的练习题。打开原题阅读完整题面，或将题面保存到工作台以便离线导出。`}</p>{!currentInPool && <div className="inline-notice"><Info size={15} /> 当前题目不在新筛选范围内，下一次抽取将按新条件进行。</div>}<div className="problem-actions"><button className="primary-button" onClick={draw}><Shuffle size={17} /> 换一题 <ArrowRight size={16} /></button><button className={`icon-action ${isFavorite ? 'selected' : ''}`} onClick={() => toggleFavorite()} title={isFavorite ? '取消收藏' : '加入题单'} aria-label={isFavorite ? '取消收藏' : '加入题单'}><Bookmark size={19} fill={isFavorite ? 'currentColor' : 'none'} /></button><button className={`icon-action ${isSolved ? 'selected green' : ''}`} onClick={() => toggleSolved()} title={isSolved ? '已完成' : '标记为已完成'} aria-label={isSolved ? '已完成' : '标记为已完成'}><CheckCircle2 size={19} /></button></div></> : <div className="empty-result"><div className="dice-illustration"><Shuffle size={39} /></div><h2>{(cfStatus === 'loading' || atStatus === 'loading') && !items.length ? '题库正在加载…' : '下一道题，在这里等你'}</h2><p>设置好难度与标签，点击按钮开始抽题。</p><button className="primary-button" disabled={!pool.length} onClick={draw}><Shuffle size={17} /> 随机一题 <ArrowRight size={16} /></button></div>}
            </div>
            {current && <div className="quick-actions"><div><strong>准备开始？</strong><span>阅读题目、保存题面，或者前往原始题目页面。</span></div><div className="quick-buttons"><button className="secondary-button" onClick={() => selectProblem(current)}><FileText size={16} /> 查看题面</button>{current.url && <a className="secondary-button" href={current.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> 打开原题</a>}{current.url && <button className="subtle-icon" title="复制原题链接" onClick={() => notifyCopy(current.url)}><Link2 size={16} /></button>}</div></div>}
            <div className="tip-row"><CircleHelp size={17} /><span>同一轮抽题不会重复；筛选范围抽完后会自动开启新一轮。</span></div></div></div>
          <div className="bottom-cards"><button className="feature-card" onClick={() => openView('library')}><span className="feature-icon peach"><Bookmark size={20} /></span><div><strong>把好题收进题单</strong><small>收藏、标记完成，保留自己的练习轨迹</small></div><ArrowRight size={18} /></button><button className="feature-card" onClick={() => openView('studio')}><span className="feature-icon lilac"><FileDown size={20} /></span><div><strong>获取并导出题面</strong><small>中文镜像、原文、PNG 与 PDF</small></div><ArrowRight size={18} /></button></div>
        </>}

        {view === 'library' && <><div className="page-eyebrow"><span className="eyebrow-line" /> YOUR COLLECTION</div><div className="page-title-row"><div><h1>我的<span>题单。</span></h1><p className="page-subtitle">把想做的题留在这里，随时接着练。</p></div></div><div className="library-toolbar"><div className="tabs"><button className={libraryTab === 'favorites' ? 'active' : ''} onClick={() => setLibraryTab('favorites')}><Bookmark size={16} /> 收藏题目 <span>{favorites.length}</span></button><button className={libraryTab === 'history' ? 'active' : ''} onClick={() => setLibraryTab('history')}><History size={16} /> 最近抽取 <span>{history.length}</span></button></div><div className="toolbar-right"><div className="library-search"><Search size={17} /><input placeholder="搜索题目或标签" value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)} /></div><button className="outline-button" onClick={() => downloadLibrary('csv')}><Download size={16} /> 导出 CSV</button><button className="outline-button small-export" onClick={() => downloadLibrary('json')}>JSON</button></div></div><div className="library-list">{listed.length ? listed.map((problem, index) => <div className="library-item" key={problem.id}><span className="item-number">{String(index + 1).padStart(2, '0')}</span><div className="item-main"><div className="item-title"><strong><a href={problem.url} target="_blank" rel="noopener noreferrer" title="打开原题">{problem.title}</a></strong><span>{problem.id}</span></div><div className="item-tags">{problem.tags.slice(0, 3).map(tag => <Pill key={tag}>{tag}</Pill>)}</div></div><Pill tone="rating">{problem.rating ?? '未评级'}</Pill>{solvedIds.has(problem.id) && <span className="done-label"><CheckCircle2 size={14} /> 已完成</span>}<button className="open-item" title="打开题面" onClick={() => selectProblem(problem)}><ArrowRight size={18} /></button></div>) : <div className="library-empty"><Bookmark size={30} /><strong>{libraryQuery ? '没有找到匹配题目' : libraryTab === 'favorites' ? '还没有收藏题目' : '还没有抽题记录'}</strong><p>去随机练题页抽一题，找到喜欢的就收藏起来。</p><button className="secondary-button" onClick={() => openView('random')}>去抽一道题 <ArrowRight size={15} /></button></div>}</div></>}

        {view === 'studio' && <>
          <div className="page-eyebrow"><span className="eyebrow-line" /> STATEMENT STUDIO</div>
          <div className="page-title-row"><div><h1>题面<span>工作台。</span></h1><p className="page-subtitle">自动获取中文镜像与原文，并导出图片、Markdown、HTML 或 PDF。</p></div></div>
          {current ? <div className="studio-layout">
            <div className="statement-card" ref={statementRef}>
              <div className="statement-header"><div><span className="section-kicker"><FileText size={15} /> 题面预览</span><h2><a href={current.url} target="_blank" rel="noopener noreferrer" title="打开原题">{currentStatement.trim() ? current.title : currentAuto?.[statementLocale]?.title || current.title}</a></h2><span className="statement-meta">{current.id} · {current.source === 'atcoder' ? 'AtCoder' : 'Codeforces'} · {current.rating ?? '未评级'}{currentAuto && !currentStatement.trim() ? ` · ${statementLocale === 'chinese' ? '中文译文' : '原文'}` : ''}</span></div><Pill tone={canExport ? 'ready' : 'draft'}>{canExport ? '可导出' : '待获取'}</Pill></div>
              {currentAuto && !currentStatement.trim() && <div className="statement-language"><span>洛谷镜像题面</span><div>{currentAuto.chinese && <button className={statementLocale === 'chinese' ? 'active' : ''} onClick={() => setStatementLocale('chinese')}>中文</button>}{currentAuto.original && <button className={statementLocale === 'original' ? 'active' : ''} onClick={() => setStatementLocale('original')}>原文</button>}</div></div>}
              <ProblemArticle problem={current} customText={currentStatement} autoStatement={currentAuto} locale={statementLocale} />
            </div>
            <aside className="studio-side">
              <div className="studio-tool-card auto-card"><div className="card-heading"><div><Sparkles size={17} /><strong>自动获取题面</strong></div></div><p>优先读取洛谷收录的中文译文，也可切换到原文。原题链接始终保留。</p>
                {currentAuto ? <div className="auto-status success"><CheckCircle2 size={16} /><span>已获取{currentAuto.chinese ? '中文译文' : '题面'}{currentAuto.original ? '和原文' : ''}</span></div>
                  : statementStatus.id === current.id && statementStatus.state === 'loading' ? <div className="auto-status"><span className="cf-spinner" /> 正在读取题面…</div>
                    : statementStatus.id === current.id && statementStatus.state === 'error' ? <div className="auto-status error"><Info size={16} /><span>{statementStatus.error}</span></div> : null}
                <div className="auto-actions">{(window.contestNative?.fetchStatement || import.meta.env.VITE_STATEMENT_API) && <button className="outline-button" onClick={retryAutoStatement} disabled={statementStatus.id === current.id && statementStatus.state === 'loading'}><RotateCcw size={15} /> {currentAuto ? '重新获取' : '重试获取'}</button>}<a className="source-link" href={current.url} target="_blank" rel="noopener noreferrer">打开原题 <ExternalLink size={14} /></a>{currentAuto && <a className="source-link" href={currentAuto.mirrorUrl} target="_blank" rel="noopener noreferrer">查看中文镜像 <ExternalLink size={14} /></a>}</div>
              </div>
              <div className="studio-tool-card"><div className="card-heading"><div><ArrowDownToLine size={17} /><strong>导出题面</strong></div></div><p>按当前显示的语言导出，保留样例与来源。</p>
                <button className="export-option" disabled={!canExport} onClick={() => exportStatement('png')}><span className="export-icon png"><FileDown size={18} /></span><span><strong>PNG 图片</strong><small>适合聊天分享与保存</small></span><Download size={16} /></button>
                <button className="export-option" disabled={!canExport} onClick={() => exportStatement('md')}><span className="export-icon md"><FileCode2 size={18} /></span><span><strong>Markdown</strong><small>适合笔记与题解仓库</small></span><Download size={16} /></button>
                <button className="export-option" disabled={!canExport} onClick={() => exportStatement('html')}><span className="export-icon html"><Code2 size={18} /></span><span><strong>HTML 网页</strong><small>可离线打开和分享</small></span><Download size={16} /></button>
                <button className="export-option" disabled={!canExport} onClick={() => exportStatement('pdf')}><span className="export-icon pdf"><FileText size={18} /></span><span><strong>打印 / PDF</strong><small>在打印窗口选择另存为 PDF</small></span><ExternalLink size={16} /></button>
                {!canExport && <div className="mini-warning"><Info size={15} /> 等待自动获取，或在下方粘贴题面正文。</div>}
              </div>
              <div className="studio-tool-card editor-card"><div className="card-heading"><div><BookOpen size={17} /><strong>我的题面</strong></div></div><p>可自行粘贴或修改。填写后优先显示此版本；清空后显示镜像题面。</p><textarea aria-label="题面正文" placeholder="在这里粘贴题目描述、输入输出、样例等内容…" value={currentStatement} onChange={e => setCustomStatements(previous => ({ ...previous, [current.id]: e.target.value }))} /><span className="save-indicator"><Check size={13} /> 自动保存到本机</span></div>
              <div className="studio-hint"><Info size={17} /><span>译文来自洛谷镜像；请以原题页面为准。</span></div>
            </aside>
          </div> : <div className="library-empty studio-none"><FileText size={32} /><strong>先选一道题目</strong><p>从随机练题或我的题单中选择题目，即可在这里查看与导出。</p><button className="secondary-button" onClick={() => openView('random')}>去抽一道题 <ArrowRight size={15} /></button></div>}
        </>}

        {view === 'settings' && <><div className="page-eyebrow"><span className="eyebrow-line" /> MAKE IT YOURS</div><div className="page-title-row"><div><h1>随时随地，<span>继续练习。</span></h1><p className="page-subtitle">安装客户端，或绑定 Codeforces 账号自动排除已 AC 的题。</p></div></div><div className="settings-grid"><section className="settings-card"><div className="settings-icon orange"><Laptop size={24} /></div><h2>下载客户端</h2><p>网页版支持安装为独立应用；Windows、macOS 和 Linux 桌面包由 GitHub Releases 提供。备用题库离线可用。</p><div className="setting-actions"><button className="primary-button" disabled={!installEvent} onClick={() => { installEvent?.prompt(); installEvent?.userChoice.finally(() => setInstallEvent(null)); }}><Download size={17} /> 安装网页客户端</button>{releasesUrl ? <div className="platform-links">{['Windows', 'macOS', 'Linux'].map(platform => <a key={platform} className="outline-button" href={releasesUrl} target="_blank" rel="noopener noreferrer"><Download size={15} /> {platform} 包</a>)}</div> : <span className="setting-muted">仓库发布 Release 后可下载 Windows、macOS 和 Linux 桌面包</span>}</div><div className="setting-foot"><Info size={15} /> {installEvent ? '浏览器已准备好安装。' : '若安装按钮不可用，可使用浏览器菜单中的“安装应用”。'}</div></section><section className="settings-card"><div className="settings-icon purple"><Code2 size={24} /></div><h2>Codeforces 账号</h2><p>读取你的公开提交记录，自动从 Codeforces 随机题库里排除已 AC 的题。用户名和结果仅保存在本机。</p><div className="cf-form"><input aria-label="Codeforces 用户名" placeholder="输入 Codeforces 用户名" value={cfInput} onChange={e => setCfInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && bindCf()} /><button className="secondary-button" disabled={cfLoading} onClick={bindCf}>{cfLoading ? '同步中…' : cfBinding.handle ? '更新 AC' : '绑定账号'}</button></div>{cfBinding.handle && <div className="binding-status"><CheckCircle2 size={17} /><span><strong>{cfBinding.handle}</strong> · 已收录 {nf.format(cfBinding.ids.length)} 道 AC{cfBinding.truncated ? '（提交过多，已读取前 3 万条）' : ''}</span><button onClick={() => { setCfBinding({ handle: '', ids: [], updatedAt: 0 }); setCfInput(''); }}>解绑</button></div>}</section><section className="settings-card info-card"><div className="settings-icon green"><BookOpen size={23} /></div><h2>关于题库与导出</h2><p>题库 API 只提供元数据。桌面版可读取洛谷中文镜像与原文；网页版配置题面服务后也可自动获取，并导出图片、Markdown、HTML 或 PDF。</p><div className="stat-line"><span>AtCoder 题目</span><strong>{nf.format(atProblems.length)} 题</strong></div><div className="stat-line"><span>Codeforces 题目</span><strong>{nf.format(cfProblems.length)} 题</strong></div><div className="stat-line"><span>本机已保存题面</span><strong>{Object.values(customStatements).filter(Boolean).length} 份</strong></div></section><section className="settings-card info-card"><div className="settings-icon blue"><CircleHelp size={23} /></div><h2>数据留在本机</h2><p>题单、抽题历史、已完成记录和题面保存在当前浏览器或桌面客户端。不同设备之间不会自动同步。</p><div className="setting-foot"><Info size={15} /> 在“我的题单”中可下载 CSV 和 JSON 备份。</div></section></div></>}
      </div><footer className="site-footer"><span>© {new Date().getFullYear()} Contest Compass</span><span>Made for the next problem <span className="footer-heart">♥</span></span></footer>
    </main>{toast && <div className="toast" role="status"><CheckCircle2 size={17} /> {toast}</div>}
  </div>;
}

export default App;
