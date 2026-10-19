import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';import {mkdir,writeFile,readFile,stat,unlink,rename,readdir,open} from 'node:fs/promises';import {createReadStream} from 'node:fs';import {Readable} from 'node:stream';import path from 'node:path';
import type {Resource,Playback} from '../shared/types';import {AppError} from './errors';import {validId} from './library';

export function parseRange(header:string|null,size:number):{start:number;end:number;status:number}|null{
 if(!Number.isSafeInteger(size)||size<=0)return null;if(!header)return {start:0,end:size-1,status:200};
 const m=/^bytes=(\d*)-(\d*)$/.exec(header);if(!m||(!m[1]&&!m[2]))return null;
 const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));const end=m[1]?(m[2]?Math.min(size-1,Number(m[2])):size-1):size-1;
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?{start,end,status:206}:null;
}

// 已观察到的 v1 包装格式：每个字节与同奇偶位的前字节异或，再减位置相关偏移。
// 这里独立实现格式解析，不包含上游 Python 实现或其样本密钥。
export function decodeContentKey(encoded:string):Buffer{
 if(typeof encoded!=='string'||encoded.length>4096||!encoded.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new AppError('UNSUPPORTED_RESOURCE','视频密钥格式暂不支持');
 const packet=Buffer.from(encoded,'base64');if(packet.length<5)throw new AppError('UNSUPPORTED_RESOURCE','视频密钥格式暂不支持');
 const tagLength=(packet[0]^packet[1]^packet[2])-48;const count=packet.length-tagLength-1;
 if(tagLength<1||tagLength>packet.length-3||count<3)throw new AppError('UNSUPPORTED_RESOURCE','视频密钥格式暂不支持');
 const salt=packet[packet.length-tagLength-2]^packet[packet.length-tagLength-1];const tag=Buffer.from(packet.subarray(packet.length-tagLength).map(b=>b^salt)).toString('ascii');
 if(tag==='app_v2'||tag==='web_v2')throw new AppError('UNSUPPORTED_RESOURCE','此作品的加密格式暂不支持');
 const original=packet.subarray(1,count+1),decoded=Buffer.alloc(count);
 for(let i=0;i<count;i++){let bits=0,n=i;while(n){bits+=n&1;n>>>=1}decoded[i]=((original[i]^(i<2?[250,85][i]:original[i-2]))-21-bits)&255}
 const prefix=String.fromCharCode(decoded[0]);if(!/^[0-9a-f]$/.test(prefix))throw new AppError('UNSUPPORTED_RESOURCE','视频密钥格式暂不支持');
 const key=decoded.subarray(1,count-Number.parseInt(prefix,16)).toString('ascii');if(!/^[0-9a-f]{32}$/.test(key))throw new AppError('UNSUPPORTED_RESOURCE','视频密钥格式暂不支持');return Buffer.from(key,'hex');
}
interface CacheEntry { key:string; file:string; episodeId:string; duration:number; definition:string; touched:number }
interface MediaJob {
 id:string; force:boolean; foreground:boolean; controller:AbortController;
 promise:Promise<Playback>; resolve:(value:Playback)=>void; reject:(error:unknown)=>void;
}
const CACHE_LIMIT=1024*1024*1024;
const FILE_LIMIT=150*1024*1024;
const cancelled=()=>new AppError('CANCELLED','播放准备已取消');
function check(signal:AbortSignal){if(signal.aborted)throw cancelled()}
// Resource lookups may finish late; cancellation must prevent them starting a download.
function abortable<T>(task:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(cancelled());
  signal.addEventListener('abort',abort,{once:true});
  task.then(value=>{signal.removeEventListener('abort',abort);signal.aborted?reject(cancelled()):resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)});
  if(signal.aborted)abort();
 });
}
export class MediaCache {
 private entries=new Map<string,CacheEntry>();
 private jobs=new Map<string,MediaJob>();
 private active?:MediaJob;
 private window:string[]=[];
 private failed=new Set<string>();
 private closing=false;
 constructor(private directory:string,private ffmpeg:string,private getResource:(id:string)=>Promise<Resource>){}
 async init(){await mkdir(this.directory,{recursive:true});for(const name of await readdir(this.directory)){
  if(/^[a-f0-9]{32}\.json$/.test(name)){try{const e=JSON.parse(await readFile(path.join(this.directory,name),'utf8'));if(validId(e.episodeId)&&Number.isFinite(e.duration)&&e.duration>0&&typeof e.definition==='string'&&e.key===name.slice(0,32)){e.file=path.join(this.directory,e.key+'.mp4');const info=await stat(e.file);if(info.size>0&&info.size<=FILE_LIMIT)this.entries.set(e.episodeId,e)}}catch{}}
  if(/^[a-f0-9]{32}\.(?:input|working)\.mp4$/.test(name))await unlink(path.join(this.directory,name)).catch(()=>{});
 }
  const liveKeys=new Set([...this.entries.values()].map(e=>e.key));for(const name of await readdir(this.directory)){if(/^[a-f0-9]{32}\.(?:mp4|json)$/.test(name)&&!liveKeys.has(name.split('.')[0]))await unlink(path.join(this.directory,name)).catch(()=>{})}
  await this.trim();
 }
 setBufferWindow(ids:string[]):void{
  if(!Array.isArray(ids)||ids.length>5||ids.some(id=>!validId(id))||new Set(ids).size!==ids.length)throw new AppError('INVALID_INPUT','缓冲剧集列表无效');
  if(this.closing)return;
  this.window=[...ids];this.failed=new Set([...this.failed].filter(id=>ids.includes(id)));
  for(const job of this.jobs.values())if(!ids.includes(job.id))this.cancel(job);
  this.pump();
 }
 prepare(id:string,force=false):Promise<Playback>{
  if(!validId(id))return Promise.reject(new AppError('INVALID_INPUT','剧集编号无效'));
  if(this.closing)return Promise.reject(cancelled());
  const cached=this.entries.get(id);if(cached&&!force){cached.touched=Date.now();return Promise.resolve(this.result(cached))}
  const existing=this.jobs.get(id);
  if(existing&&!existing.controller.signal.aborted){existing.foreground=true;return existing.promise}
  // A new current episode takes priority; a useful in-flight episode is adopted above.
  if(this.active&&!this.active.foreground&&this.active.id!==id)this.cancel(this.active);
  this.failed.delete(id);
  const job=this.enqueue(id,force,true);this.pump();return job.promise;
 }
 private enqueue(id:string,force:boolean,foreground:boolean):MediaJob{
  let resolve!:MediaJob['resolve'],reject!:MediaJob['reject'];
  const promise=new Promise<Playback>((yes,no)=>{resolve=yes;reject=no});
  const job={id,force,foreground,controller:new AbortController(),promise,resolve,reject};
  this.jobs.set(id,job);
  // Background failures are isolated from playback and retried only on a later explicit request.
  void promise.catch(()=>{});return job;
 }
 private cancel(job:MediaJob){
  job.controller.abort();
  if(job!==this.active){if(this.jobs.get(job.id)===job)this.jobs.delete(job.id);job.reject(cancelled())}
 }
 private pump(){
  if(this.closing||this.active)return;
  let job=[...this.jobs.values()].find(job=>job.foreground&&!job.controller.signal.aborted);
  // Start the advance buffer only after the current episode is ready.
  if(!job&&this.window[0]&&this.entries.has(this.window[0])){
   const id=this.window.slice(1).find(id=>!this.entries.has(id)&&!this.failed.has(id)&&!this.jobs.has(id));
   if(id)job=this.enqueue(id,false,false);
  }
  if(!job)return;
  const running=job;this.active=running;
  const finish=()=>{
   if(this.jobs.get(running.id)===running)this.jobs.delete(running.id);
   this.active=undefined;
  };
  void this.run(running).then(value=>{finish();running.resolve(value);this.pump()},error=>{
   if(!running.controller.signal.aborted)this.failed.add(running.id);
   finish();running.reject(error);this.pump();
  });
 }
 private async run(job:MediaJob):Promise<Playback>{
  const signal=job.controller.signal;let last:unknown;
  for(let attempt=0;attempt<2;attempt++){
   check(signal);
   try{const resource=await abortable(this.getResource(job.id),signal);check(signal);return await this.create(resource,signal)}
   catch(error){last=error;if(signal.aborted||this.closing)throw cancelled()}
  }
  throw last;
 }
 private result(e:CacheEntry):Playback{return {url:`manju-media://local/${e.key}`,duration:e.duration,definition:e.definition,episodeId:e.episodeId}}
 private async create(resource:Resource,signal:AbortSignal):Promise<Playback>{
  check(signal);
  if(!(resource.duration>0)||resource.duration>1800||!(resource.size>0)||resource.size>FILE_LIMIT)throw new AppError('UNSUPPORTED_RESOURCE','播放资源不完整或大小暂不支持');
  const key=randomUUID().replaceAll('-','');const input=path.join(this.directory,key+'.input.mp4'),working=path.join(this.directory,key+'.working.mp4'),output=path.join(this.directory,key+'.mp4');
  const metadata=path.join(this.directory,key+'.json');let committed=false;
  const contentKey=resource.encrypted?decodeContentKey(resource.spade||''):null;
  try{
   let response:Response;try{response=await fetch(resource.url,{signal:AbortSignal.any([signal,AbortSignal.timeout(45000)])})}catch{check(signal);throw new AppError('NETWORK','视频连接失败，请检查网络后重试')}
   check(signal);
   if(!response.ok||!response.body)throw new AppError('RESOURCE_EXPIRED','视频资源已失效，请重试当前集');
   const handle=await open(input,'w');let bytes=0;try{for await(const chunk of response.body){check(signal);bytes+=chunk.length;if(bytes>resource.size)throw new AppError('INCOMPLETE_RESOURCE','视频资源大小不一致');await handle.write(chunk)}}finally{await handle.close()}
   check(signal);if(bytes!==resource.size)throw new AppError('INCOMPLETE_RESOURCE','视频读取不完整，请重试当前集');
   await this.transcode(input,working,contentKey,resource.duration,signal);contentKey?.fill(0);check(signal);
   const info=await stat(working);if(info.size<=0||info.size>FILE_LIMIT)throw new AppError('MEDIA_CACHE','单集缓存超过大小限制');
   await rename(working,output);check(signal);
   const entry:CacheEntry={key,file:output,episodeId:resource.episodeId,duration:resource.duration,definition:resource.definition,touched:Date.now()};
   await writeFile(metadata,JSON.stringify({...entry,file:undefined}));check(signal);
   const previous=this.entries.get(resource.episodeId);this.entries.set(resource.episodeId,entry);committed=true;
   if(previous){await unlink(path.join(this.directory,previous.key+'.json')).catch(()=>{});await unlink(previous.file).catch(()=>{})}
   await this.trim();return this.result(entry);
  }catch(error){check(signal);if(error instanceof AppError)throw error;throw new AppError('MEDIA_CACHE','视频准备失败，请检查磁盘空间后重试当前集')}
  finally{contentKey?.fill(0);await unlink(input).catch(()=>{});await unlink(working).catch(()=>{});if(!committed){await unlink(output).catch(()=>{});await unlink(metadata).catch(()=>{})}}
 }
 private transcode(input:string,output:string,key:Buffer|null,duration:number,signal:AbortSignal):Promise<void>{
  check(signal);
  return new Promise((resolve,reject)=>{
   const args=['-hide_banner','-loglevel','error','-nostats','-progress','pipe:1',...(key?['-decryption_key',key.toString('hex')]:[]),'-i',input,'-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','veryfast','-threads','2','-crf','25','-c:a','aac','-movflags','+faststart','-y',output];
   const child=spawn(this.ffmpeg,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let progress='';
   const abort=()=>{child.kill()};signal.addEventListener('abort',abort,{once:true});
   const timeout=setTimeout(()=>child.kill(),180000);
   const cleanup=()=>{clearTimeout(timeout);signal.removeEventListener('abort',abort)};
   child.stdout.on('data',data=>{progress+=data;if(progress.length>50000)progress=progress.slice(-25000)});child.stderr.resume();
   child.once('error',()=>{cleanup();reject(signal.aborted?cancelled():new AppError('MEDIA_RUNTIME','媒体组件无法启动'))});
   child.once('close',code=>{cleanup();const actual=Number([...progress.matchAll(/^out_time_us=(\d+)$/gm)].at(-1)?.[1])/1e6;signal.aborted?reject(cancelled()):code===0&&Math.abs(actual-duration)<1?resolve():reject(new AppError('MEDIA_DECODE','视频处理未完成，请重试当前集'))});
  });
 }
 async response(url:string,range:string|null):Promise<Response>{
  const uri=new URL(url);if(uri.hostname!=='local'||!/^\/[a-f0-9]{32}$/.test(uri.pathname))return new Response(null,{status:404});
  const entry=[...this.entries.values()].find(e=>e.key===uri.pathname.slice(1));if(!entry)return new Response(null,{status:404});
  const info=await stat(entry.file).catch(()=>null);if(!info)return new Response(null,{status:404});const slice=parseRange(range,info.size);if(!slice)return new Response(null,{status:416,headers:{'content-range':`bytes */${info.size}`}});
  entry.touched=Date.now();const stream=Readable.toWeb(createReadStream(entry.file,{start:slice.start,end:slice.end}));return new Response(stream as ReadableStream,{status:slice.status,headers:{'content-type':'video/mp4','accept-ranges':'bytes','content-length':String(slice.end-slice.start+1),...(slice.status===206?{'content-range':`bytes ${slice.start}-${slice.end}/${info.size}`}:{})}});
 }
 private async trim(){
  const entries=[...this.entries.values()].sort((a,b)=>a.touched-b.touched);
  const sizes=new Map<string,number>();let total=0;
  for(const e of entries){const info=await stat(e.file).catch(()=>null);if(!info){this.entries.delete(e.episodeId);continue}sizes.set(e.episodeId,info.size);total+=info.size}
  for(const e of entries){
   // Five pinned files are bounded to 750 MiB; the current foreground is also protected.
   if(this.window.includes(e.episodeId)||this.active?.id===e.episodeId||!sizes.has(e.episodeId))continue;
   if(total>CACHE_LIMIT||Date.now()-e.touched>86400000){
    try{await unlink(e.file);await unlink(path.join(this.directory,e.key+'.json')).catch(()=>{});this.entries.delete(e.episodeId);total-=sizes.get(e.episodeId)!}catch{/* Windows may still have an old file open; retry on the next trim. */}
   }
  }
 }
 async close(){this.closing=true;this.window=[];const pending=[...new Set([...this.jobs.values(),...(this.active?[this.active]:[])])];for(const job of pending)this.cancel(job);await Promise.allSettled(pending.map(job=>job.promise))}
}
