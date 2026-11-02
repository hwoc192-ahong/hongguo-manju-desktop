import type {Catalog, Episode, Resource, Series, Work, VideoQuality} from '../shared/types';import {AppError} from './errors';

// openhongguo（Apache-2.0，https://github.com/beilunyang/openhongguo）免签内容源：
// 匿名设备注册 + 7.3.9.32 客户端参数 + player 场景端点，搜索/详情/播放全链路无需
// X-Argus/X-Gorgon 签名。作为原生通道的优先来源，失败时由 provider 回退旧通道。
// ESM-only 包通过运行时动态 import 加载，构建时保持 external 不打包。
const QUALITY_ORDER=['1080p','720p','540p','480p','360p'];
type HongguoClient=import('openhongguo').Client;
let clientPromise:Promise<HongguoClient>|undefined;
const searchCursors=new Map<string,string>();
// 匿名设备配额很低（连续数集播放即触发 ANONYMOUS_LIMITED 且恢复期长）；
// 限流后进入冷却期，期间直接走原有通道，避免每次播放都做限流往返。
let limitedUntil=0;
function limited(error:unknown):boolean{return (error as any)?.code==='ANONYMOUS_LIMITED'}
function guard():void{if(Date.now()<limitedUntil)throw new AppError('SOURCE_LIMITED','免签内容源限流冷却中')}
function note(error:unknown):never|void{if(limited(error))limitedUntil=Date.now()+10*60_000}

export function initHongguoSource(profilePath:string):void{
  if(clientPromise)return;
  clientPromise=import('openhongguo').then(module=>module.createClient({profile:profilePath}));
}
function client():Promise<HongguoClient>{
  if(!clientPromise)throw new AppError('SOURCE_UNAVAILABLE','内容源未初始化');
  return clientPromise;
}
export function hongguoReady():boolean{return clientPromise!==undefined}

function workOf(entry:any):Work{
  const title=typeof entry.title==='string'?entry.title.trim():'';
  return {id:String(entry.id),title:title||'未知作品',cover:String(entry.cover_url??''),description:String(entry.description??''),total:Number(entry.episode_count??0)||0};
}
function episodeOf(entry:any,index:number):Episode{
  const order=Number.isFinite(entry.number)&&entry.number>0?Math.floor(entry.number):index+1;
  return {id:String(entry.id),order,...(typeof entry.title==='string'&&entry.title?{title:entry.title}:{}),...(Number.isFinite(entry.duration_seconds)&&entry.duration_seconds>0?{duration:entry.duration_seconds}:{})};
}
export async function hongguoSearch(query:string,offset:number):Promise<Catalog>{
  guard();const c=await client();
  try{
   const cached=searchCursors.get(query);
   if(offset>0&&!cached)throw new AppError('SOURCE_CURSOR','站内搜索分页游标缺失');
   const page=await c.search(query,{...(cached?{cursor:cached}:{}),pageSize:10});
   const items=(page.items??[]).map(workOf);
   if(page.cursor)searchCursors.set(query,page.cursor);else searchCursors.delete(query);
   return {items,hasMore:page.has_more===true,nextOffset:offset+items.length,label:`搜索：${query}`,source:'红果站内搜索'};
  }catch(error){note(error);throw error}
}
export async function hongguoSeries(id:string):Promise<Series>{
  guard();const c=await client();
  try{
   const [series,eps]=await Promise.all([c.getSeries(id),c.listEpisodes(id)]);
   const episodes=(eps.items??[]).map(episodeOf).sort((left:Episode,right:Episode)=>left.order-right.order);
   if(!episodes.length)throw new AppError('SERIES_NOT_FOUND','接口没有返回此作品的分集');
   const base=workOf({...series,total:series.episode_count??episodes.length});
   return {...base,total:episodes.length,episodes};
  }catch(error){note(error);throw error}
}
export async function hongguoResource(episodeId:string,quality:VideoQuality='auto'):Promise<Resource>{
  guard();const c=await client();
  try{
   const {playback,contentKey,contentKeyError}=await c.resolvePlayback(episodeId);
  const streams=(playback.streams??[]).filter(stream=>typeof stream.url==='string'&&stream.url&&QUALITY_ORDER.includes(String(stream.definition)));
  if(!streams.length)throw new AppError('RESOURCE_UNAVAILABLE','此分集的播放资源暂不可用');
  const ranked=[...streams].sort((left:any,right:any)=>QUALITY_ORDER.indexOf(String(left.definition))-QUALITY_ORDER.indexOf(String(right.definition)));
  // 优先挑选不需要解密的档位；全部加密且密钥可用时映射为 ffmpeg 兼容的解密密钥。
  const plain=ranked.find(stream=>!stream.protected&&!stream.encryption);
  let stream=quality==='auto'?(plain??ranked[0]):ranked.find(item=>QUALITY_ORDER.indexOf(String(item.definition))>=QUALITY_ORDER.indexOf(quality))??ranked[ranked.length-1];
  let decryptionKey:string|undefined;
  if(!plain){
    if(!contentKey)throw new AppError(contentKeyError?'UNSUPPORTED_ENCRYPTION':'MISSING_MEDIA_KEY',contentKeyError?.message??'播放资源缺少必要的媒体参数');
    decryptionKey=contentKey.key;
  }
  if(!stream.url)throw new AppError('RESOURCE_UNAVAILABLE','此分集的播放资源暂不可用');
  const definition=String(stream.definition),duration=Number(playback.duration_seconds),size=Number(stream.size);
  if(!Number.isFinite(duration)||duration<=0||!definition)throw new AppError('INVALID_RESOURCE_MODEL','播放资源缺少完整时长或文件信息');
  return {episodeId,duration,definition,codec:String(stream.codec??''),encrypted:decryptionKey!==undefined,
   ...(decryptionKey?{spade:decryptionKey}:{}),url:String(stream.backup_url??stream.url),size:Number.isSafeInteger(size)&&size>0?size:0,
   availableQualities:[...new Set(streams.map(item=>String(item.definition)))].sort((left,right)=>QUALITY_ORDER.indexOf(left)-QUALITY_ORDER.indexOf(right))};
  }catch(error){note(error);throw error}
  }
