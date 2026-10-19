import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import {mkdtemp,rm,writeFile,open,readdir,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

const ids=Array.from({length:12},(_,i)=>String(7695386527160863700n+BigInt(i)));
const tick=()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(check:()=>boolean){for(let i=0;i<300;i++){if(check())return;await tick()}assert.fail('timed out waiting for buffer');}

async function fixture(t:any,options:{hold?:string;large?:boolean;fail?:string;holdEncode?:number}={}){
 const dir=await mkdtemp(path.join(tmpdir(),'manju-buffer-'));
 const fetched:string[]=[],aborted:string[]=[],encoded:string[]=[],killed:string[]=[];
 let active=0,maxActive=0,release:(()=>void)|undefined;
 const spawnMock=t.mock.method(childProcess,'spawn',(_exe:string,args:readonly string[])=>{
  const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>{killed.push(id);queueMicrotask(()=>child.emit('close',null));return true}});
  const id=path.basename(args[args.indexOf('-i')+1]);encoded.push(id);
  if(options.holdEncode===encoded.length)return child;
  queueMicrotask(async()=>{
   const file=args.at(-1)!;
   if(options.large){const handle=await open(file,'w');await handle.truncate(140*1024*1024);await handle.close()}
   else await writeFile(file,'prepared-video');
   child.stdout.write('out_time_us=1000000\n');child.emit('close',0);
  });return child;
 });
 const fetchMock=t.mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{
  const id=new URL(url).pathname.slice(1);fetched.push(id);active++;maxActive=Math.max(active,maxActive);
  try{
   if(id===options.hold)await new Promise<void>((resolve,reject)=>{
    release=resolve;init?.signal?.addEventListener('abort',()=>{aborted.push(id);reject(init.signal?.reason)},{once:true});
   });
   if(id===options.fail)throw Error('offline');
   return new Response(Buffer.from('source'));
  }finally{active--}
 });syncBuiltinESMExports();
 const {MediaCache}=await import('../src/main/media');
 const media=new MediaCache(dir,'fake-ffmpeg',async id=>({episodeId:id,duration:1,definition:'540p',codec:'h264',encrypted:false,url:`https://example.com/${id}`,size:6}));await media.init();
 t.after(async()=>{await media.close();spawnMock.mock.restore();fetchMock.mock.restore();syncBuiltinESMExports();await rm(dir,{recursive:true,force:true})});
 return {media,dir,fetched,aborted,encoded,killed,get maxActive(){return maxActive},release:()=>release?.()};
}

test('当前集完成后顺序缓冲至第五集，第二集复用缓存并补第六集',async t=>{
 const f=await fixture(t);f.media.setBufferWindow(ids.slice(0,5));
 assert.equal(f.fetched.length,0,'buffer must not delay the initial episode');
 const first=await f.media.prepare(ids[0]);await until(()=>f.encoded.length===5);await f.media.prepare(ids[4]);
 await until(()=>f.fetched.length===5);await tick();
 assert.deepEqual(f.fetched,ids.slice(0,5));assert.equal(f.maxActive,1);
 f.media.setBufferWindow(ids.slice(1,6));const next=await f.media.prepare(ids[1]);
 assert.equal(next.episodeId,ids[1]);await until(()=>f.encoded.length===6);await tick();
 assert.deepEqual(f.fetched,ids.slice(0,6));assert.equal((await f.media.response(first.url,null)).status,200);
});

test('播放正在缓冲的同一集时接管任务，不重复下载',async t=>{
 const f=await fixture(t,{hold:ids[1]});f.media.setBufferWindow(ids.slice(0,5));await f.media.prepare(ids[0]);await until(()=>f.fetched.includes(ids[1]));
 f.media.setBufferWindow(ids.slice(1,6));const next=f.media.prepare(ids[1]);f.release();await next;
 assert.equal(f.fetched.filter(id=>id===ids[1]).length,1);assert.equal(f.aborted.length,0);
});

test('跳集取消过时缓冲，当前集优先，退出详情页停止后台下载',async t=>{
 const f=await fixture(t,{hold:ids[1]});f.media.setBufferWindow(ids.slice(0,5));await f.media.prepare(ids[0]);await until(()=>f.fetched.includes(ids[1]));
 f.media.setBufferWindow(ids.slice(7,12));await f.media.prepare(ids[7]);
 assert.deepEqual(f.aborted,[ids[1]]);assert.deepEqual(f.fetched.slice(0,3),[ids[0],ids[1],ids[7]]);
 f.media.setBufferWindow([]);await tick();const count=f.fetched.length;await tick();assert.equal(f.fetched.length,count);assert.equal(f.maxActive,1);
});

test('缓冲失败有限重试且不阻塞后续集，当前集可以手动重试',async t=>{
 const f=await fixture(t,{fail:ids[1]});f.media.setBufferWindow(ids.slice(0,5));await f.media.prepare(ids[0]);await until(()=>f.encoded.length===4);await tick();
 assert.equal(f.fetched.filter(id=>id===ids[1]).length,2);assert.ok(f.fetched.includes(ids[4]));
 await assert.rejects(f.media.prepare(ids[1]));assert.equal(f.fetched.filter(id=>id===ids[1]).length,4);
});

test('五集窗口不被磁盘淘汰，旧缓存清理使完整缓存不超过 1 GiB',async t=>{
 const f=await fixture(t,{large:true});f.media.setBufferWindow(ids.slice(0,5));const first=await f.media.prepare(ids[0]);await until(()=>f.encoded.length===5);await f.media.prepare(ids[4]);
 assert.equal((await f.media.response(first.url,'bytes=0-0')).status,206);
 for(const id of ids.slice(5,9))await f.media.prepare(id);
 const metadata=(await readdir(f.dir)).filter(name=>name.endsWith('.json'));
 assert.ok(metadata.length<=7,'140 MiB entries must fit within 1 GiB');
 const retained=await Promise.all(metadata.map(async name=>JSON.parse(await readFile(path.join(f.dir,name),'utf8')).episodeId));
 for(const id of ids.slice(0,5))assert.ok(retained.includes(id),`window episode ${id} must be retained`);
});

test('只接受最多五个有效且不重复的编号',async t=>{
 const f=await fixture(t);
 for(const value of [ids.slice(0,6),['bad'],[ids[0],ids[0]],null])assert.throws(()=>f.media.setBufferWindow(value as any),{code:'INVALID_INPUT'});
});

test('关闭应用取消后台任务且不重试、不启动后续集',async t=>{
 const f=await fixture(t,{hold:ids[1]});f.media.setBufferWindow(ids.slice(0,5));await f.media.prepare(ids[0]);await until(()=>f.fetched.includes(ids[1]));await f.media.close();
 assert.deepEqual(f.fetched,ids.slice(0,2));assert.deepEqual(f.aborted,[ids[1]]);assert.equal(f.encoded.length,1);
});

test('跳集终止正在后台转码的进程，取消的集不重试且清理临时文件',async t=>{
 const f=await fixture(t,{holdEncode:2});f.media.setBufferWindow(ids.slice(0,5));await f.media.prepare(ids[0]);await until(()=>f.encoded.length===2);
 f.media.setBufferWindow([ids[8]]);await f.media.prepare(ids[8]);
 assert.equal(f.killed.length,1);assert.deepEqual(f.fetched,[ids[0],ids[1],ids[8]]);
 assert.ok(!(await readdir(f.dir)).some(name=>/\.(input|working)\.mp4$/.test(name)));
});

test('重开后复用已完成的五集缓存，不重新请求视频资源',async t=>{
 const f=await fixture(t);f.media.setBufferWindow(ids.slice(0,5));await f.media.prepare(ids[0]);await until(()=>f.encoded.length===5);await f.media.prepare(ids[4]);await f.media.close();
 const {MediaCache}=await import('../src/main/media');
 const reopened=new MediaCache(f.dir,'fake-ffmpeg',async()=>{throw Error('unexpected resource lookup')});
 try{
  await reopened.init();reopened.setBufferWindow(ids.slice(0,5));
  for(const id of ids.slice(0,5))assert.equal((await reopened.prepare(id)).episodeId,id);
  assert.equal(f.fetched.length,5);
 }finally{await reopened.close()}
});
