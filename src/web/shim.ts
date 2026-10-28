import type {Board,BufferState,CacheLimits,CacheOverview,CachePriority,Catalog,DesktopApi,Library,Playback,Progress,Recommendations,Result,Series,UpdateState,VideoQuality,Work} from '../shared/types';

// 浏览器端 window.desktop 实现：把 preload 的 ipcRenderer.invoke 契约
// 逐方法映射到网页版后端 /api/<channel>。UI 组件零改动。
const invoke=(channel:string)=>async(...args:unknown[]):Promise<unknown>=>{
  let response:Response;
  try{response=await fetch(`/api/${channel}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)})}
  catch{throw new Error('无法连接本地网页服务，请确认服务仍在运行。')}
  if(!response.ok)throw new Error(`服务请求失败（${response.status}），请稍后重试。`);
  return response.json();
};
// 桌面版播放地址 manju-media://local/<key> 在网页版由同源 /media/local/<key> 提供。
const rewriteMedia=<T>(value:T):T=>{
  if(typeof value==='string')return (value.startsWith('manju-media://local/')?`/media/local/${value.slice('manju-media://local/'.length)}`:value) as unknown as T;
  if(Array.isArray(value))return value.map(item=>rewriteMedia(item)) as unknown as T;
  if(value&&typeof value==='object'){const copy:Record<string,unknown>={};for(const [key,item] of Object.entries(value))copy[key]=rewriteMedia(item);return copy as unknown as T}
  return value;
};
const call=(channel:string)=>async(...args:unknown[])=>rewriteMedia(await invoke(channel)(...args));

const desktop:DesktopApi={
  catalog:(board:Board,offset=0)=>invoke('catalog')(board,offset) as Promise<Result<Catalog>>,
  search:(query,offset=0)=>invoke('search')(query,offset) as Promise<Result<Catalog>>,
  importShare:(text)=>invoke('share')(text) as Promise<Result<Series>>,
  series:(id)=>invoke('series')(id) as Promise<Result<Series>>,
  recommendations:(id,refresh=false)=>invoke('recommendations')(id,refresh) as Promise<Result<Recommendations>>,
  playback:(id,force=false,quality)=>call('playback')(id,force,quality) as Promise<Result<Playback>>,
  videoQuality:(quality:VideoQuality)=>invoke('video-quality')(quality) as Promise<Result<boolean>>,
  exportDiagnostics:async()=>{
    try{
      const response=await fetch('/diagnostics.json');if(!response.ok)throw new Error();
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
      link.href=url;link.download='Hongguo-Web-diagnostics.json';link.click();URL.revokeObjectURL(url);
      return {ok:true,data:{saved:true}};
    }catch{return {ok:false,error:{code:'DIAGNOSTICS_WRITE',message:'诊断文件下载失败，请重试'}}}
  },
  bufferEpisodes:(ids)=>call('buffer-episodes')(ids) as Promise<Result<BufferState>>,
  bufferState:()=>call('buffer-state')() as Promise<Result<BufferState>>,
  retryBuffer:()=>call('buffer-retry')() as Promise<Result<BufferState>>,
  cacheState:()=>invoke('cache-state')() as Promise<Result<CacheOverview>>,
  cacheAdd:(seriesId)=>invoke('cache-add')(seriesId) as Promise<Result<CacheOverview>>,
  cacheAction:(seriesId,action)=>invoke('cache-action')(seriesId,action) as Promise<Result<CacheOverview>>,
  cacheDeleteWatched:()=>invoke('cache-delete-watched')() as Promise<Result<CacheOverview>>,
  cacheConcurrency:(value)=>invoke('cache-concurrency')(value) as Promise<Result<CacheOverview>>,
  cacheLimits:(limits:CacheLimits)=>invoke('cache-limits')(limits) as Promise<Result<CacheOverview>>,
  cachePriority:(seriesId,priority:CachePriority)=>invoke('cache-priority')(seriesId,priority) as Promise<Result<CacheOverview>>,
  cacheChooseDirectory:()=>invoke('cache-directory')() as Promise<Result<CacheOverview>>,
  cacheOpenDirectory:()=>invoke('cache-open-directory')() as Promise<Result<boolean>>,
  cacheCloseToTray:(enabled)=>invoke('cache-close-to-tray')(enabled) as Promise<Result<CacheOverview>>,
  // 桌面专属事件在网页版没有对应生命周期，返回空取消函数即可。
  onBackground:()=>()=>{},
  onUpdate:()=>()=>{},
  library:()=>invoke('library')() as Promise<Result<Library>>,
  favorite:(work:Work,enabled)=>invoke('favorite')(work,enabled) as Promise<Result<Library>>,
  progress:(progress:Omit<Progress,'updatedAt'>)=>invoke('progress')(progress) as Promise<Result<Library>>,
  checkUpdate:()=>invoke('update')() as Promise<Result<UpdateState>>,
  updateState:()=>invoke('update-state')() as Promise<Result<UpdateState>>,
  downloadUpdate:()=>invoke('update-download')() as Promise<Result<UpdateState>>,
  installUpdate:()=>invoke('update-install')() as Promise<Result<UpdateState>>,
};
window.desktop=desktop;
