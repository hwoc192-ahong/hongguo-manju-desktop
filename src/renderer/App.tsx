import {readPlaybackRate,savePlaybackRate,PLAYBACK_RATES} from './player-preferences';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from 'react';
import type { Board, BufferState, CacheOverview, Catalog, Episode, Library, Playback, Progress, Result, Series, Work } from '../shared/types';
import { formatTime, resumeTime, selectEpisode } from './playback-state';
import {UpdateControl} from './UpdateControl';
import {PlayerSurface} from './PlayerSurface';
import {CacheProgress,cacheProgressText} from './CacheProgress';
import {CacheCenter} from './CacheCenter';

let backgrounded=false;
type View = 'discover' | 'favorites' | 'history' | 'search' | 'cache';
type IconName = 'home' | 'heart' | 'clock' | 'search' | 'plus' | 'play' | 'pause' | 'back' | 'refresh' | 'close' | 'next' | 'previous' | 'volume' | 'muted' | 'fullscreen' | 'check' | 'arrow' | 'film' | 'link';
const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="m8 4 13 8-13 8Z" />,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  back: <path d="m14 5-7 7 7 7M7 12h14" />,
  refresh: <><path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  next: <><path d="m5 5 11 7-11 7ZM19 5v14" /></>,
  previous: <><path d="m19 5-11 7 11 7ZM5 5v14" /></>,
  volume: <><path d="M4 9h4l5-4v14l-5-4H4ZM17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14" /></>,
  muted: <><path d="M4 9h4l5-4v14l-5-4H4ZM17 9l5 6M17 15l5-6" /></>,
  fullscreen: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />,
  check: <path d="m5 12 4 4 10-10" />,
  arrow: <path d="m9 5 7 7-7 7" />,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  link: <><path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(0 -1)" /></>,
};
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
async function call<T>(operation: () => Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try { result = await operation(); }
  catch { throw new Error('连接暂时中断，请重试。'); }
  if (!result.ok || result.data === undefined) throw new Error(result.error?.message || '暂时无法获取内容，请稍后重试。');
  return result.data;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : '发生了一个问题，请重试。'; }
const emptyLibrary: Library = { favorites: [], history: [] };
// Keep writes ordered even when changing an episode unmounts its player.
let progressWrites: Promise<void> = Promise.resolve();

function Cover({ work, className = '' }: { work: Work; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [work.cover]);
  return <div className={`cover ${className}`}>
    {work.cover && !failed ? <img src={work.cover} alt={`${work.title}封面`} loading="lazy" onError={() => setFailed(true)} /> : <div className="cover-placeholder"><Icon name="film" size={34} /><span>{work.title}</span></div>}
  </div>;
}
function ErrorState({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
  return <div className={`error-state ${compact ? 'compact' : ''}`} role="alert"><div className="state-icon"><Icon name="refresh" size={27} /></div><h3>暂时没有连上</h3><p>{message}</p><button className="secondary-button" onClick={onRetry}><Icon name="refresh" size={16} />重新尝试</button></div>;
}
function EmptyState({ icon, title, description, action }: { icon: IconName; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="state-icon"><Icon name={icon} size={32} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
function WorkCard({ work, onOpen, progress }: { work: Work; onOpen: () => void; progress?: Progress }) {
  const percent = progress?.duration ? Math.min(100, progress.time / progress.duration * 100) : 0;
  return <button className="work-card" onClick={onOpen}>
    <div className="poster-wrap"><Cover work={work} /><span className="episode-badge">{work.total ? `${work.total}集` : '漫剧'}</span><div className="poster-hover"><span><Icon name="play" size={23} /></span></div>
      {progress && <div className="poster-progress"><i style={{ width: `${percent}%` }} /></div>}
    </div>
    <h3>{work.title}</h3><p>{progress ? `看到第${progress.order}集 · ${formatTime(progress.time)}` : work.categories?.join(' / ') || '点击观看'}</p>
  </button>;
}

function ResumeCard({ progress, onOpen }: { progress: Progress; onOpen: () => void }) {
  const percent = progress.duration > 0 ? Math.max(0, Math.min(100, progress.time / progress.duration * 100)) : 0;
  return <button className="resume-card" onClick={onOpen} aria-label={`继续观看${progress.work.title}`}>
    <Cover work={progress.work} />
    <div className="resume-caption"><div><h3>{progress.work.title}</h3><p>第{progress.order}集 · {formatTime(progress.time)}</p></div><span className="resume-play"><Icon name="play" size={16} /></span></div>
    <span className="resume-progress"><i style={{ width: `${percent}%` }} /></span>
  </button>;
}

export default function App() {
  const [view, setView] = useState<View>('discover');
  const [board, setBoard] = useState<Board>('recommend');
  const [heroIndex, setHeroIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [libraryError, setLibraryError] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [rate, setRate] = useState(readPlaybackRate);
  const changeRate = (value: number) => { setRate(value); if (!savePlaybackRate(value)) notify('倍速已应用，但未能保存，重开软件后可能需要重新设置。'); };
  const [importOpen, setImportOpen] = useState(false);
  const [shareText, setShareText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [toast, setToast] = useState('');
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [cache,setCache]=useState<CacheOverview|null>(null);
  const [cacheError,setCacheError]=useState('');
  const refreshCache=useCallback(async()=>{try{setCache(await call(()=>window.desktop.cacheState()));setCacheError('')}catch(error){setCacheError(errorMessage(error))}},[]);
  useEffect(()=>{let live=true,timer:number;const poll=async()=>{await refreshCache();if(live)timer=window.setTimeout(()=>void poll(),1000)};void poll();return()=>{live=false;window.clearTimeout(timer)}},[refreshCache]);
  useEffect(()=>window.desktop.onBackground?.(hidden=>{backgrounded=hidden;if(hidden)document.querySelector('video')?.pause()}),[]);
  const requestId = useRef(0);
  const scrollArea = useRef<HTMLDivElement>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    let allowClose = false;
    let closing = false;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowClose) return;
      event.preventDefault(); event.returnValue = '';
      if (closing) return;
      closing = true;
      // Player listeners enqueue their last snapshot during this same event.
      void Promise.resolve().then(() => progressWrites).finally(() => { allowClose = true; window.setTimeout(() => window.close(), 0); });
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 4500); return () => window.clearTimeout(timer); }, [toast]);
  const updateLibrary = useCallback((value: Library) => { setLibrary(value); setLibraryError(''); }, []);
  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true); setLibraryError('');
    try { updateLibrary(await call(() => window.desktop.library())); }
    catch (error) { setLibraryError(errorMessage(error)); }
    finally { setLibraryLoading(false); }
  }, [updateLibrary]);
  useEffect(() => { void loadLibrary(); }, [loadLibrary]);
  const loadCatalog = useCallback(async (append = false) => {
    if (view !== 'discover' && view !== 'search') return;
    const token = ++requestId.current;
    if (append) { setMoreLoading(true); setMoreError(''); }
    else { setLoading(true); setCatalogError(''); setMoreError(''); setMoreLoading(false); setHeroIndex(0); }
    const offset = append ? catalog?.nextOffset || 0 : 0;
    try {
      const value = await call(() => view === 'search' ? window.desktop.search(searchTerm, offset) : window.desktop.catalog(board, offset));
      if (token !== requestId.current) return;
      setCatalog(previous => append && previous ? { ...value, items: [...previous.items, ...value.items.filter(item => !previous.items.some(old => old.id === item.id))] } : value);
    } catch (error) {
      if (token !== requestId.current) return;
      if (append) setMoreError(errorMessage(error)); else setCatalogError(errorMessage(error));
    } finally {
      if (token === requestId.current) { setLoading(false); setMoreLoading(false); }
    }
  }, [view, board, searchTerm, catalog?.nextOffset]);
  useEffect(() => {
    setCatalog(null); scrollArea.current?.scrollTo({ top: 0 });
    if (view === 'discover' || view === 'search') void loadCatalog();
    return () => { requestId.current++; };
    // A nextOffset update must not reload the first page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, board, searchTerm]);
  async function toggleFavorite(work: Work) {
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    const enabled = !library.favorites.some(item => item.id === work.id);
    try { updateLibrary(await call(() => window.desktop.favorite(work, enabled))); notify(enabled ? '已加入收藏' : '已取消收藏'); }
    catch (error) { notify(errorMessage(error)); }
    finally { setFavoriteBusy(false); }
  }
  function navigate(next: View) { setActiveId(null); setView(next); if (next === 'favorites' || next === 'history') void loadLibrary(); }
  function submitSearch(event: FormEvent) {
    event.preventDefault(); const term = query.trim(); if (!term) return;
    setActiveId(null); if (term === searchTerm && view === 'search') void loadCatalog();
    setSearchTerm(term); setView('search');
  }
  async function importWork(event: FormEvent) {
    event.preventDefault(); if (!shareText.trim() || importing) return;
    setImporting(true); setImportError('');
    try {
      const series = await call(() => window.desktop.importShare(shareText.trim()));
      updateLibrary(await call(() => window.desktop.favorite(series, true)));
      setImportOpen(false); setShareText(''); setActiveId(series.id); notify('导入成功，已加入收藏');
    } catch (error) { setImportError(errorMessage(error)); }
    finally { setImporting(false); }
  }
  useEffect(() => {
    if (!importOpen) return;
    const handler = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !importing) setImportOpen(false); };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [importOpen, importing]);
  const heading = view === 'favorites' ? '我的收藏' : view === 'history' ? '继续你的故事' : `“${searchTerm}”的搜索结果`;
  const subheading = view === 'favorites' ? '喜欢的故事，都在这里。' : view === 'history' ? '从上次停下的地方，继续看。' : '找到下一部想看的漫剧。';
  const featuredWorks = !loading && !catalogError && view === 'discover' ? catalog?.items.slice(0, 3) || [] : [];
  const spotlight = featuredWorks[heroIndex] || featuredWorks[0];
  const spotlightFavorite = spotlight && library.favorites.some(item => item.id === spotlight.id);
  const list = view === 'favorites' ? library.favorites : view === 'history' ? library.history.map(item => item.work) : catalog?.items || [];
  return <div className="app-shell">
    <div className="workspace">
      <header className="topbar">
        <button className="brand" onClick={() => navigate('discover')} aria-label="发现" title="返回首页">漫剧</button>
        <nav className="board-tabs" role="tablist" aria-label="漫剧榜单">{([['recommend', '推荐', '推荐榜'], ['hot', '热播', '热播榜'], ['new', '新剧', '新剧榜']] as const).map(([key, label, accessibleLabel]) => <button key={key} role="tab" aria-label={accessibleLabel} aria-selected={view === 'discover' && !activeId && board === key} className={view === 'discover' && !activeId && board === key ? 'selected' : ''} onClick={() => { setActiveId(null); setView('discover'); setBoard(key); }}>{label}</button>)}</nav>
        <form className="search-box" onSubmit={submitSearch}><Icon name="search" size={18} /><input value={query} onChange={event => setQuery(event.target.value)} aria-label="搜索漫剧名称" placeholder="搜索漫剧" maxLength={200} /><button type="submit" aria-label="搜索" title="搜索"><Icon name="arrow" size={16} /></button></form>
        <button className="top-import" aria-label="导入分享" onClick={() => { setImportError(''); setImportOpen(true); }}><Icon name="link" size={17} /><span>导入链接</span></button>
        <nav className="library-nav" aria-label="个人记录"><button className={view === 'favorites' && !activeId ? 'active' : ''} aria-label="我的收藏" onClick={() => navigate('favorites')}>收藏</button><button className={view === 'history' && !activeId ? 'active' : ''} aria-label="观看历史" onClick={() => navigate('history')}>历史</button></nav>
        <UpdateControl/>
        <button className={`cache-nav ${view==='cache'&&!activeId?'active':''}`} onClick={()=>navigate('cache')} aria-label="缓存中心">缓存{cache?.tasks.some(task=>!task.paused&&task.state.status!=='complete')&&<i/>}</button>
      </header>
      <main className="content-scroll" ref={scrollArea}>
        {activeId ? <Detail rate={rate} onRateChange={changeRate} key={activeId} id={activeId} library={library} onLibrary={updateLibrary} onFavorite={toggleFavorite} favoriteBusy={favoriteBusy} onBack={() => setActiveId(null)} notify={notify} /> : view==='cache'?<CacheCenter state={cache} error={cacheError} onRefresh={()=>void refreshCache()} onOpen={setActiveId} favorites={library.favorites}/>:<div className={`catalog-page ${view === 'discover' ? 'discover-page' : ''}`}>
          {view !== 'discover' && <div className="page-heading"><div><h1>{heading}</h1><p>{subheading}</p></div>{view === 'search' && <button className="refresh-button" onClick={() => void loadCatalog()} disabled={loading}><Icon name="refresh" size={17} />刷新</button>}</div>}
          {spotlight && <section className="spotlight" aria-label="作品推荐">
            <Cover work={spotlight} className="spotlight-art" />
            <div className="spotlight-copy"><span className="featured-label">{spotlight.categories?.join(' · ') || (board === 'hot' ? '热门故事' : board === 'new' ? '新鲜上线' : '推荐开看')}</span><h2>{spotlight.title}</h2><div className="spotlight-meta">{spotlight.total ? `全${spotlight.total}集` : '漫剧'}</div><p>{spotlight.description || '打开这个故事，精彩即将开始。'}</p><div className="spotlight-actions"><button className="primary-button" aria-label="立即观看" onClick={() => setActiveId(spotlight.id)}><Icon name="play" size={18} />播放</button><button className={`secondary-button ${spotlightFavorite ? 'is-favorite' : ''}`} disabled={favoriteBusy} onClick={() => void toggleFavorite(spotlight)}><Icon name="heart" size={17} />{spotlightFavorite ? '已收藏' : '收藏'}</button></div></div>
            {featuredWorks.length > 1 && <div className="hero-pagination" aria-label="切换推荐作品">{featuredWorks.map((work, index) => <button key={work.id} aria-label={`切换推荐作品${index + 1}`} aria-pressed={spotlight.id === work.id} title={work.title} className={spotlight.id === work.id ? 'selected' : ''} onClick={() => setHeroIndex(index)}><span /></button>)}</div>}
          </section>}
          <div className="catalog-body">
          {view === 'discover' && <section className="resume-section" aria-label="继续观看"><div className="section-heading"><h2>继续观看</h2><span className="section-rule" /><button className="text-button" onClick={() => navigate('history')}>全部历史<Icon name="arrow" size={14} /></button></div>{libraryLoading ? <p className="resume-empty">正在读取观看记录…</p> : libraryError ? <div className="resume-empty" role="alert">{libraryError}<button className="text-button" onClick={() => void loadLibrary()}>重新尝试</button></div> : library.history.length ? <div className="resume-grid">{library.history.slice(0, 3).map(progress => <ResumeCard key={progress.seriesId} progress={progress} onOpen={() => setActiveId(progress.seriesId)} />)}</div> : <p className="resume-empty">开始观看一部漫剧，下次就能从这里继续。</p>}</section>}
          {view === 'discover' && <div className="section-heading"><h2>{loading ? '正在寻找好故事' : catalog?.label || '精选漫剧'}</h2><span className="section-rule" /><button className="refresh-button" onClick={() => void loadCatalog()} disabled={loading}><Icon name="refresh" size={16} />刷新</button></div>}
          {(view === 'discover' || view === 'search') && loading ? <div className="skeleton-grid" aria-label="正在加载漫剧" aria-busy="true">{Array.from({ length: 10 }, (_, index) => <div className="skeleton-card" key={index}><div /><i /><span /></div>)}</div> : catalogError && (view === 'discover' || view === 'search') ? <ErrorState message={catalogError} onRetry={() => void loadCatalog()} /> : (view === 'favorites' || view === 'history') && libraryLoading ? <div className="center-loading"><span className="spinner" /><p>正在整理你的漫剧…</p></div> : libraryError && (view === 'favorites' || view === 'history') ? <ErrorState message={libraryError} onRetry={() => void loadLibrary()} /> : <>
            {list.length > 0 ? <>{view !== 'discover' && <div className="section-heading"><h2>{view === 'search' ? '搜索结果' : view === 'favorites' ? '已收藏的漫剧' : '最近观看'}</h2><span>{list.length}部漫剧</span></div>}<div className="work-grid">{list.map(work => <WorkCard key={work.id} work={work} progress={view === 'history' ? library.history.find(item => item.seriesId === work.id) : undefined} onOpen={() => setActiveId(work.id)} />)}</div></> : <EmptyState icon={view === 'favorites' ? 'heart' : view === 'history' ? 'clock' : 'search'} title={view === 'favorites' ? '收藏你的第一部漫剧' : view === 'history' ? '故事还没开始' : view === 'search' ? '没有找到相关漫剧' : '暂时没有推荐内容'} description={view === 'favorites' ? '在作品页面点击收藏，或导入一条分享内容。' : view === 'history' ? '看过的漫剧会出现在这里，随时接着看。' : view === 'search' ? '换一个剧名或关键词，再试试。' : '点击刷新，再来看看。'} action={view === 'favorites' || view === 'history' ? <button className="primary-button" onClick={() => navigate('discover')}>去发现<Icon name="arrow" size={16} /></button> : undefined} />}
            {(view === 'discover' || view === 'search') && catalog?.hasMore && <div className="load-more">{moreError && <p role="alert">{moreError}</p>}<button className="secondary-button" disabled={moreLoading} onClick={() => void loadCatalog(true)}>{moreLoading ? <><span className="spinner small" />正在加载…</> : moreError ? '重新加载' : '发现更多'}{!moreLoading && <Icon name="arrow" size={16} />}</button></div>}
          </>}
          <footer className="page-footer"><span>好故事，值得慢慢看</span><span>自动检查更新 · 顶部「更新」查看</span></footer>
          </div>
        </div>}
      </main>
    </div>
    {importOpen && <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget && !importing) setImportOpen(false); }}><section className="import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><button className="modal-close icon-button" aria-label="关闭导入" disabled={importing} onClick={() => setImportOpen(false)}><Icon name="close" /></button><div className="modal-icon"><Icon name="plus" size={27} /></div><h2 id="import-title">把好故事带回来</h2><p>粘贴红果漫剧的分享文本或链接，导入后会自动加入收藏。</p><form onSubmit={importWork}><textarea autoFocus placeholder="在这里粘贴分享内容或链接…" value={shareText} onChange={event => setShareText(event.target.value)} maxLength={10000} disabled={importing} aria-label="分享文本或链接" />{importError && <p className="inline-error" role="alert">{importError}</p>}<button className="primary-button full-width" type="submit" disabled={!shareText.trim() || importing}>{importing ? <><span className="spinner small" />正在找到这部漫剧…</> : <><Icon name="plus" size={18} />导入并收藏</>}</button></form></section></div>}
    {toast && <div className="toast" role="status"><Icon name="check" size={18} /><span>{toast}</span><button aria-label="关闭提示" onClick={() => setToast('')}><Icon name="close" size={15} /></button></div>}
  </div>;
}

function Detail({ rate, onRateChange, id, library, onLibrary, onFavorite, favoriteBusy, onBack, notify }: { rate: number; onRateChange: (rate: number) => void; id: string; library: Library; onLibrary: (library: Library) => void; onFavorite: (work: Work) => void; favoriteBusy: boolean; onBack: () => void; notify: (message: string) => void }) {
  const [series, setSeries] = useState<Series | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [autoNext, setAutoNext] = useState(true);
  const [sortDescending, setSortDescending] = useState(false);
  const [reload, setReload] = useState(0);
  const [buffer, setBuffer] = useState<BufferState | null>(null);
  const [bufferError, setBufferError] = useState('');
  const [bufferRetry, setBufferRetry] = useState(0);
  const appliedBufferRetry = useRef(0);
  const resume = useRef(library.history.find(item => item.seriesId === id));
  useEffect(() => {
    let live = true; setLoading(true); setError('');
    void call(() => window.desktop.series(id)).then(value => {
      if (!live) return; const ordered = { ...value, episodes: [...value.episodes].sort((a, b) => a.order - b.order) };
      setSeries(ordered); setEpisode(selectEpisode(ordered.episodes, resume.current?.episodeId) || null);
    }).catch(error => { if (live) setError(errorMessage(error)); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [id, reload]);
  useEffect(() => { document.querySelector('.content-scroll')?.scrollTo({ top: 0 }); }, []);
  const index = series?.episodes.findIndex(item => item.id === episode?.id) ?? -1;
  useEffect(() => {
    if (!series || index < 0) return;
    let live = true; let timer: number | undefined;
    setBuffer(null); setBufferError('');
    const refresh = async () => {
      try { const value = await call(() => window.desktop.bufferState()); if (live) { setBuffer(value); setBufferError(''); } }
      catch (error) { if (live) setBufferError(errorMessage(error)); }
    };
    // Prepare the current episode and all later episodes, then fill earlier gaps.
    const ordered = [...series.episodes.slice(index), ...series.episodes.slice(0, index)].map(item => item.id);
    void (async () => {
      await call(() => window.desktop.bufferEpisodes(ordered));
      if (bufferRetry !== appliedBufferRetry.current) { appliedBufferRetry.current = bufferRetry; await call(() => window.desktop.retryBuffer()); }
      if (!live) return; await refresh();
      if (live) timer = window.setInterval(() => { void refresh(); }, 1000);
    })().catch(error => { if (live) setBufferError(errorMessage(error)); });
    return () => { live = false; window.clearInterval(timer); };
  }, [series, index, bufferRetry]);
  useEffect(() => () => { void call(() => window.desktop.bufferEpisodes([])).catch(() => {}); }, []);
  const favorite = library.favorites.some(item => item.id === id);
  const episodes = sortDescending ? [...(series?.episodes || [])].reverse() : series?.episodes || [];
  const next = () => { if (series && index >= 0 && index < series.episodes.length - 1) setEpisode(series.episodes[index + 1]); };
  return <div className="detail-page"><button className="back-button" onClick={onBack}><Icon name="back" size={18} />返回</button>
    {loading ? <div className="center-loading"><span className="spinner" /><p>正在打开这个故事…</p></div> : error ? <ErrorState message={error} onRetry={() => setReload(value => value + 1)} /> : series && <>
      <div className="detail-heading"><div><span className="eyebrow">NOW SHOWING</span><h1>{series.title}</h1><p>{series.categories?.join(' · ')}{series.categories?.length ? ' · ' : ''}{series.total ? `全${series.total}集` : `${series.episodes.length}集`}</p></div><button className={`favorite-button ${favorite ? 'is-favorite' : ''}`} disabled={favoriteBusy} onClick={() => onFavorite(series)}><Icon name="heart" size={18} />{favorite ? '已收藏' : '收藏漫剧'}</button></div>
      <div className="watch-layout"><section className="watch-main">
        {episode&&<div className="background-cache-entry"><span>当前作品可加入队列，切换页面后继续缓存</span><button className="secondary-button" onClick={()=>void call(()=>window.desktop.cacheAdd(series.id)).then(()=>notify('已加入后台缓存，可在顶部“缓存”查看进度和托盘设置。')).catch(error=>notify(errorMessage(error)))}>加入后台缓存</button></div>}
        {episode && <CacheProgress state={buffer} episodes={series.episodes} error={bufferError} onRetry={()=>setBufferRetry(value=>value+1)} />}
        {episode ? <PlayerSurface episodeId={episode.id}><Player buffer={buffer} bufferError={bufferError} rate={rate} onRateChange={onRateChange} key={episode.id} series={series} episode={episode} initialTime={library.history.find(item => item.seriesId === id && item.episodeId === episode.id)?.time || 0} onLibrary={onLibrary} onPrevious={index > 0 ? () => setEpisode(series.episodes[index - 1]) : undefined} onNext={index < series.episodes.length - 1 ? next : undefined} autoNext={autoNext} onEnded={next} notify={notify} /></PlayerSurface> : <div className="unavailable-player"><Icon name="film" size={34} /><h3>这部漫剧暂时没有可播放剧集</h3><button className="secondary-button" onClick={() => setReload(value => value + 1)}>重新获取剧集</button></div>}
        <div className="now-playing"><div><span className="playing-dot" /><strong>{episode ? `第${episode.order}集` : '剧集待更新'}</strong><span>{episode?.title && episode.title !== `第${episode.order}集` ? episode.title : series.title}</span></div><label className="toggle-label"><input type="checkbox" checked={autoNext} onChange={event => setAutoNext(event.target.checked)} /><span className="toggle-track" />自动连播</label></div>
        <section className="story-info"><Cover work={series} /><div><h2>关于这部漫剧</h2><div className="category-chips">{series.categories?.map(category => <span key={category}>{category}</span>)}</div><p>{series.description || '暂无作品简介。'}</p></div></section>
      </section><aside className="episode-panel"><div className="episode-heading"><div><h2>选集</h2><span>{series.episodes.length}集可播放</span></div><button onClick={() => setSortDescending(value => !value)}>{sortDescending ? '倒序 ↓' : '正序 ↑'}</button></div><div className="episode-grid">{episodes.map(item => <button key={item.id} className={item.id === episode?.id ? 'current' : ''} onClick={() => setEpisode(item)} title={item.title || `第${item.order}集`} aria-label={`播放第${item.order}集`} aria-current={item.id === episode?.id ? 'true' : undefined}>{item.id === episode?.id && <span className="equalizer"><i /><i /><i /></span>}{item.order}</button>)}</div></aside></div>
    </>}
  </div>;
}

function Player({ rate, onRateChange, series, episode, initialTime, onLibrary, onPrevious, onNext, autoNext, onEnded, notify, buffer, bufferError }: { rate: number; onRateChange: (rate: number) => void; series: Series; episode: Episode; initialTime: number; onLibrary: (library: Library) => void; onPrevious?: () => void; onNext?: () => void; autoNext: boolean; onEnded: () => void; notify: (message: string) => void; buffer:BufferState|null;bufferError:string }) {
  const video = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [resource, setResource] = useState<Playback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(episode.duration || 0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const automaticRetry = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const desiredTime = useRef(initialTime);
  const progress = useRef({ time: 0, duration: episode.duration || 0, ready: false });
  const persisted = useRef<string>('');
  const callbacks = useRef({ onLibrary, notify });
  callbacks.current = { onLibrary, notify };
  const mounted = useRef(true);
  const save = useCallback(async () => {
    const element = video.current;
    if (element && progress.current.ready) {
      progress.current.time = element.currentTime;
      if (Number.isFinite(element.duration) && element.duration > 0) progress.current.duration = element.duration;
    }
    const state = { ...progress.current };
    if (!state.ready || state.duration <= 0) return progressWrites;
    const fingerprint = `${Math.floor(state.time)}:${Math.floor(state.duration)}`;
    if (persisted.current === fingerprint) return progressWrites;
    persisted.current = fingerprint;
    const { episodes: _, ...work } = series;
    progressWrites = progressWrites.then(async () => {
      try {
        const result = await call(() => window.desktop.progress({ seriesId: series.id, episodeId: episode.id, order: episode.order, time: state.time, duration: state.duration, work }));
        callbacks.current.onLibrary(result);
      } catch (error) { persisted.current = ''; if (mounted.current) callbacks.current.notify(`观看进度未保存：${errorMessage(error)}`); }
    });
    return progressWrites;
  }, [series, episode.id, episode.order]);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => { void save(); }, 5000);
    const beforeUnload = () => { video.current?.pause(); void save(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener('beforeunload', beforeUnload); void save(); };
  }, [save]);
  useEffect(() => {
    let live = true; setLoading(true); setError(''); setResource(null); setElapsed(0); setPlaying(false);
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    void call(() => window.desktop.playback(episode.id, attempt > 0)).then(value => { if (live) setResource(value); }).catch(error => { if (live) setError(errorMessage(error)); }).finally(() => { if (live) setLoading(false); window.clearInterval(timer); });
    return () => { live = false; window.clearInterval(timer); };
  }, [episode.id, attempt]);
  const trackStyle = (value: number, max: number): CSSProperties => ({ '--range-progress': `${max > 0 ? Math.min(100, value / max * 100) : 0}%` } as CSSProperties);
  function captureProgress() {
    const element = video.current; if (!element || !progress.current.ready) return;
    const total = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : progress.current.duration;
    progress.current = { ready: true, time: element.currentTime, duration: total };
    setTime(element.currentTime); setDuration(total);
  }
  function retry() { captureProgress(); void save(); desiredTime.current = progress.current.ready ? progress.current.time : desiredTime.current; setAttempt(value => value + 1); }
  async function togglePlay() {
    const element = video.current; if (!element || loading || error) return;
    if (element.paused) { try { await element.play(); } catch { notify('点击播放，继续观看。'); } } else element.pause();
  }
  function seek(value: number) { if (!video.current || !progress.current.ready) return; video.current.currentTime = value; captureProgress(); }
  function move(action?: () => void) { captureProgress(); void save(); action?.(); }
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => notify('暂时无法退出全屏。'));
    else void container.current?.closest('.player-surface')?.requestFullscreen().catch(() => notify('暂时无法进入全屏。'));
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).matches('input, select, button')) return;
    if (event.key === ' ' || event.key.toLowerCase() === 'k') { event.preventDefault(); void togglePlay(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); seek(Math.max(0, time - 5)); }
    if (event.key === 'ArrowRight') { event.preventDefault(); seek(Math.min(duration, time + 5)); }
    if (event.key.toLowerCase() === 'f') toggleFullscreen();
    if (event.key.toLowerCase() === 'm') setMuted(value => !value);
  }
  useEffect(() => { if (video.current) { video.current.volume = volume; video.current.muted = muted; video.current.playbackRate = rate; } }, [volume, muted, rate, resource]);
  return <div className="player" ref={container} tabIndex={0} onKeyDown={keyboard} aria-label={`第${episode.order}集播放器`}>
    <div className="video-stage">
      {resource && !error && <video ref={video} src={resource.url} playsInline preload="auto" onClick={() => void togglePlay()} onDoubleClick={toggleFullscreen}
        onLoadedMetadata={() => {
          const element = video.current!; const total = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : resource.duration;
          const restored = resumeTime(desiredTime.current, total); element.currentTime = restored; element.volume = volume; element.muted = muted; element.playbackRate = rate;
          progress.current = { ready: true, time: restored, duration: total }; setDuration(total); setTime(restored); setWaiting(false);
          if(!backgrounded)void element.play().catch(() => setPlaying(false));
        }}
        onTimeUpdate={captureProgress} onPlay={() => {if(backgrounded){video.current?.pause();return}setPlaying(true)}} onPause={() => { setPlaying(false); captureProgress(); void save(); }} onWaiting={() => setWaiting(true)} onCanPlay={() => setWaiting(false)} onPlaying={() => setWaiting(false)}
        onError={() => { captureProgress(); void save(); if (!automaticRetry.current) { automaticRetry.current = true; retry(); return; } setError('这一集暂时无法播放，请重新获取资源后再试。'); setPlaying(false); }}
        onEnded={() => { captureProgress(); void save(); setPlaying(false); if (!backgrounded && autoNext && onNext) onEnded(); }} />}
      {loading ? <div className="player-overlay"><span className="spinner" /><strong>{elapsed >= 5 ? '正在准备播放资源…' : '正在获取这一集…'}</strong><p>{elapsed >= 5 ? '正在准备完整单集，所需时间取决于网络和视频长度。' : `第${episode.order}集即将开始`}</p></div> : error ? <div className="player-overlay player-error" role="alert"><div className="state-icon"><Icon name="film" size={30} /></div><strong>播放遇到了一点问题</strong><p>{error}</p><button className="primary-button" onClick={retry}><Icon name="refresh" size={17} />重试当前集</button></div> : waiting ? <div className="buffering"><span className="spinner" /><span>正在缓冲…</span></div> : !playing && resource && <button className="big-play" onClick={() => void togglePlay()} aria-label="播放"><Icon name="play" size={33} /></button>}
    </div>
    <div className="player-controls"><input className="seek-range" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(time, duration || 1)} style={trackStyle(time, duration)} disabled={!resource || !!error || loading} onChange={event => seek(Number(event.target.value))} onPointerUp={() => void save()} onKeyUp={() => void save()} aria-label="播放进度" aria-valuetext={`${formatTime(time)} / ${formatTime(duration)}`} />
      <div className="fullscreen-cache">{buffer?`整剧缓存 ${buffer.ready}/${buffer.total} 集 · ${buffer.total?Math.floor(buffer.ready/buffer.total*100):0}%`:'正在读取缓存状态…'}<span>{cacheProgressText(buffer,series.episodes,bufferError)}</span></div>
      <div className="control-row"><button className="control-button" onClick={() => void togglePlay()} disabled={!resource || !!error} aria-label={playing ? '暂停' : '播放'} title={playing ? '暂停（空格）' : '播放（空格）'}><Icon name={playing ? 'pause' : 'play'} size={19} /></button><button className="control-button" disabled={!onPrevious} onClick={() => move(onPrevious)} aria-label="上一集" title="上一集"><Icon name="previous" size={18} /></button><button className="control-button" disabled={!onNext} onClick={() => move(onNext)} aria-label="下一集" title="下一集"><Icon name="next" size={18} /></button><span className="time-label">{formatTime(time)}<i>/</i>{formatTime(duration)}</span><span className="controls-spacer" /><span className="definition-label" title="优先使用来源提供的最高可播放清晰度">{resource?.definition || ''}</span><div className="volume-controls"><button className="control-button" onClick={() => setMuted(value => !value)} aria-label={muted || !volume ? '取消静音' : '静音'} title="静音（M）"><Icon name={muted || !volume ? 'muted' : 'volume'} size={18} /></button><input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} style={trackStyle(muted ? 0 : volume, 1)} onChange={event => { setVolume(Number(event.target.value)); setMuted(false); }} aria-label="音量" /></div><select className="speed-select" value={rate} onChange={event => onRateChange(Number(event.target.value))} aria-label="播放倍速" title="播放倍速">{PLAYBACK_RATES.map(value => <option key={value} value={value}>{value === 1 ? '倍速 1×' : `${value}×`}</option>)}</select><button className="control-button" onClick={toggleFullscreen} aria-label="切换全屏" title="全屏（F）"><Icon name="fullscreen" size={18} /></button></div>
    </div>
  </div>;
}
