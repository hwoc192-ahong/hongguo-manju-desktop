export interface Episode { id: string; order: number; duration?: number; title?: string }
export interface Work { id: string; title: string; cover: string; description: string; total: number; categories?: string[] }
export interface Series extends Work { episodes: Episode[] }
export interface RelatedWork { work:Work; reason:string }
export interface Recommendations { seasons:RelatedWork[]; similar:RelatedWork[]; message:string }
export type Board = 'recommend' | 'hot' | 'new';
export interface Catalog { items: Work[]; hasMore: boolean; nextOffset: number; label: string; source: string }
export interface Progress { seriesId: string; episodeId: string; order: number; time: number; duration: number; updatedAt: number; work: Work }
export interface Library { favorites: Work[]; history: Progress[] }
export interface Playback { url: string; duration: number; definition: string; episodeId: string }
export interface CacheActivity {
 stage:'resolving'|'downloading'|'waiting'|'processing'|'finalizing';
 percent?:number; transferred?:number; total?:number;
}
export interface BufferState {
 status:'idle'|'preparing'|'complete'|'partial'|'paused';
 total:number; ready:number; failed:number; activeId?:string; active?:CacheActivity; message:string;
 cachedBytes?:number;
 activities?:{episodeId:string;activity?:CacheActivity}[];
}
export interface CacheTask { series:Series; paused:boolean; createdAt:number; state:BufferState; watched:boolean;registered:boolean }
export interface CacheOverview { directory:string; freeBytes:number; usedBytes:number; migrating:boolean; tasks:CacheTask[]; closeToTray:boolean; message:string; concurrency:number; bytesPerSecond:number }
export interface Result<T> { ok: boolean; data?: T; error?: { code: string; message: string } }
export interface UpdateState {
 status: 'idle'|'checking'|'current'|'available'|'downloading'|'downloaded'|'installing'|'error'|'unsupported';
 currentVersion: string;
 nextVersion?: string;
 percent?: number;
 transferred?: number;
 total?: number;
 message: string;
}
export interface DesktopApi {
 catalog(board: Board, offset?: number): Promise<Result<Catalog>>;
 search(query: string, offset?: number): Promise<Result<Catalog>>;
 importShare(text: string): Promise<Result<Series>>;
 series(id: string): Promise<Result<Series>>;
 recommendations(id:string,refresh?:boolean):Promise<Result<Recommendations>>;
 playback(id: string, force?: boolean): Promise<Result<Playback>>;
 bufferEpisodes(ids: string[]): Promise<Result<BufferState>>;
 bufferState(): Promise<Result<BufferState>>;
 retryBuffer(): Promise<Result<BufferState>>;
 cacheState():Promise<Result<CacheOverview>>;
 cacheAdd(seriesId:string):Promise<Result<CacheOverview>>;
 cacheAction(seriesId:string,action:'pause'|'resume'|'retry'|'remove'|'delete'):Promise<Result<CacheOverview>>;
 cacheDeleteWatched():Promise<Result<CacheOverview>>;
 cacheConcurrency(value:number):Promise<Result<CacheOverview>>;
 cacheChooseDirectory():Promise<Result<CacheOverview>>;
 cacheOpenDirectory():Promise<Result<boolean>>;
 cacheCloseToTray(enabled:boolean):Promise<Result<CacheOverview>>;
 onBackground(listener:(background:boolean)=>void):()=>void;
 library(): Promise<Result<Library>>;
 favorite(work: Work, enabled: boolean): Promise<Result<Library>>;
 progress(progress: Omit<Progress,'updatedAt'>): Promise<Result<Library>>;
 checkUpdate(): Promise<Result<UpdateState>>;
 updateState(): Promise<Result<UpdateState>>;
 downloadUpdate(): Promise<Result<UpdateState>>;
 installUpdate(): Promise<Result<UpdateState>>;
 onUpdate(listener: (state: UpdateState) => void): () => void;
}
export interface Resource { episodeId: string; duration: number; definition: string; codec: string; encrypted: boolean; spade?: string; url: string; size: number }
export interface ApiTransport { request(path: string, body?: unknown, extra?: Record<string,string|number|boolean>): Promise<any> }
declare global { interface Window { desktop: DesktopApi } }
