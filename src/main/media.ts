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
export class MediaCache {
 private entries=new Map<string,CacheEntry>();private inFlight=new Map<string,Promise<Playback>>();private processes=new Set<ReturnType<typeof spawn>>();private closing=false;private downloads=new Set<AbortController>();
 constructor(private directory:string,private ffmpeg:string,private getResource:(id:string)=>Promise<Resource>){}
 async init(){await mkdir(this.directory,{recursive:true});for(const name of await readdir(this.directory)){
  if(/^[a-f0-9]{32}\.json$/.test(name)){try{const e=JSON.parse(await readFile(path.join(this.directory,name),'utf8'));if(validId(e.episodeId)&&Number.isFinite(e.duration)&&e.duration>0&&typeof e.definition==='string'&&e.key===name.slice(0,32)){e.file=path.join(this.directory,e.key+'.mp4');const info=await stat(e.file);if(info.size>0)this.entries.set(e.episodeId,e)}}catch{}}
  if(/^[a-f0-9]{32}\.(?:input|working)\.mp4$/.test(name))await unlink(path.join(this.directory,name)).catch(()=>{});
 }
  const liveKeys=new Set([...this.entries.values()].map(e=>e.key));for(const name of await readdir(this.directory)){if(/^[a-f0-9]{32}\.(?:mp4|json)$/.test(name)&&!liveKeys.has(name.split('.')[0]))await unlink(path.join(this.directory,name)).catch(()=>{})}
  await this.trim()}
 async prepare(id:string,force=false):Promise<Playback>{
  if(!validId(id))throw new AppError('INVALID_INPUT','剧集编号无效');if(this.closing)throw new AppError('CANCELLED','应用正在退出');
  const cached=this.entries.get(id);if(cached&&!force){cached.touched=Date.now();return this.result(cached)}
  const current=this.inFlight.get(id);if(current)return current;
  const job=(async()=>{let last:unknown;for(let attempt=0;attempt<2;attempt++){try{return await this.create(await this.getResource(id))}catch(e){last=e;if(this.closing)break}}throw last})();this.inFlight.set(id,job);try{return await job}finally{this.inFlight.delete(id)}
 }
 private result(e:CacheEntry):Playback{return {url:`manju-media://local/${e.key}`,duration:e.duration,definition:e.definition,episodeId:e.episodeId}}
 private async create(resource:Resource):Promise<Playback>{
  if(this.closing)throw new AppError('CANCELLED','应用正在退出');
  if(!(resource.duration>0)||resource.duration>1800||!(resource.size>0)||resource.size>150*1024*1024)throw new AppError('UNSUPPORTED_RESOURCE','播放资源不完整或大小暂不支持');
  const key=randomUUID().replaceAll('-','');const input=path.join(this.directory,key+'.input.mp4'),working=path.join(this.directory,key+'.working.mp4'),output=path.join(this.directory,key+'.mp4');
  const contentKey=resource.encrypted?decodeContentKey(resource.spade||''):null;const controller=new AbortController();this.downloads.add(controller);
  try{
   let response:Response;try{response=await fetch(resource.url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])})}catch{throw new AppError('NETWORK','视频连接失败，请检查网络后重试')}
   if(!response.ok||!response.body)throw new AppError('RESOURCE_EXPIRED','视频资源已失效，请重试当前集');
   const handle=await open(input,'w');let bytes=0;try{for await(const chunk of response.body){if(this.closing)throw new AppError('CANCELLED','应用正在退出');bytes+=chunk.length;if(bytes>resource.size)throw new AppError('INCOMPLETE_RESOURCE','视频资源大小不一致');await handle.write(chunk)}}finally{await handle.close()}
   if(bytes!==resource.size)throw new AppError('INCOMPLETE_RESOURCE','视频读取不完整，请重试当前集');
   await this.transcode(input,working,contentKey,resource.duration);contentKey?.fill(0);await rename(working,output);
   const entry:CacheEntry={key,file:output,episodeId:resource.episodeId,duration:resource.duration,definition:resource.definition,touched:Date.now()};
   await writeFile(path.join(this.directory,key+'.json'),JSON.stringify({...entry,file:undefined}));const previous=this.entries.get(resource.episodeId);this.entries.set(resource.episodeId,entry);if(previous){await unlink(path.join(this.directory,previous.key+'.json')).catch(()=>{});await unlink(previous.file).catch(()=>{})}await this.trim();return this.result(entry);
  }catch(error){if(error instanceof AppError)throw error;throw new AppError('MEDIA_CACHE','视频准备失败，请检查磁盘空间后重试当前集')}finally{this.downloads.delete(controller);contentKey?.fill(0);await unlink(input).catch(()=>{});await unlink(working).catch(()=>{})}
 }
 private transcode(input:string,output:string,key:Buffer|null,duration:number):Promise<void>{
  // Check synchronously with spawn: close() may have run while the input file was closing.
  if(this.closing)return Promise.reject(new AppError('CANCELLED','应用正在退出'));
  return new Promise((resolve,reject)=>{
  const args=['-hide_banner','-loglevel','error','-nostats','-progress','pipe:1',...(key?['-decryption_key',key.toString('hex')]:[]),'-i',input,'-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-c:v','libx264','-preset','veryfast','-threads','2','-crf','25','-c:a','aac','-movflags','+faststart','-y',output];
  const child=spawn(this.ffmpeg,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});this.processes.add(child);let progress='';const timeout=setTimeout(()=>child.kill(),180000);child.stdout.on('data',data=>{progress+=data;if(progress.length>50000)progress=progress.slice(-25000)});child.stderr.resume();child.once('error',()=>{clearTimeout(timeout);reject(new AppError('MEDIA_RUNTIME','媒体组件无法启动'))});child.once('close',code=>{clearTimeout(timeout);this.processes.delete(child);const actual=Number([...progress.matchAll(/^out_time_us=(\d+)$/gm)].at(-1)?.[1])/1e6;code===0&&Math.abs(actual-duration)<1?resolve():reject(new AppError('MEDIA_DECODE','视频处理未完成，请重试当前集'))});
 })}
 async response(url:string,range:string|null):Promise<Response>{
  const uri=new URL(url);if(uri.hostname!=='local'||!/^\/[a-f0-9]{32}$/.test(uri.pathname))return new Response(null,{status:404});
  const entry=[...this.entries.values()].find(e=>e.key===uri.pathname.slice(1));if(!entry)return new Response(null,{status:404});
  const info=await stat(entry.file).catch(()=>null);if(!info)return new Response(null,{status:404});const slice=parseRange(range,info.size);if(!slice)return new Response(null,{status:416,headers:{'content-range':`bytes */${info.size}`}});
  entry.touched=Date.now();const stream=Readable.toWeb(createReadStream(entry.file,{start:slice.start,end:slice.end}));return new Response(stream as ReadableStream,{status:slice.status,headers:{'content-type':'video/mp4','accept-ranges':'bytes','content-length':String(slice.end-slice.start+1),...(slice.status===206?{'content-range':`bytes ${slice.start}-${slice.end}/${info.size}`}:{})}});
 }
 private async trim(){const entries=[...this.entries.values()].sort((a,b)=>b.touched-a.touched);let total=0;for(let index=0;index<entries.length;index++){const e=entries[index],s=await stat(e.file).catch(()=>null);if(!s){this.entries.delete(e.episodeId);continue}total+=s.size;if(index>=3&&(total>600*1024*1024||Date.now()-e.touched>86400000)){await unlink(e.file).catch(()=>{});await unlink(path.join(this.directory,e.key+'.json')).catch(()=>{});this.entries.delete(e.episodeId)}}}
 async close(){this.closing=true;for(const controller of this.downloads)controller.abort();for(const process of this.processes)process.kill();await Promise.allSettled([...this.inFlight.values()])}
}
