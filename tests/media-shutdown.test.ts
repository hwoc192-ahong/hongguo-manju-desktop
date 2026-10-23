import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import type {Resource} from '../src/shared/types';

test('下载完成后开始退出不能再启动 FFmpeg，关闭等待中的准备必须取消',async t=>{
 let cache:import('../src/main/media').MediaCache;
 let closing:Promise<void>|undefined;
 const patches=[
  t.mock.method(fs,'statfs',async()=>({bavail:10*1024**3,bsize:1})),
  t.mock.method(fs,'open',async()=>({write:async()=>{},close:async()=>{closing=cache.close()}})),
  t.mock.method(fs,'rename',async()=>{}),
  t.mock.method(fs,'writeFile',async()=>{}),
  t.mock.method(fs,'unlink',async()=>{}),
  t.mock.method(fs,'stat',async()=>({size:1})),
 ];
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>new Response(Buffer.from('source')));
 const spawnMock=t.mock.method(childProcess,'spawn',()=>{
  const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stderr:new PassThrough(),kill:()=>true});
  queueMicrotask(()=>{child.stdout.write('out_time_us=1000000\n');child.emit('close',0)});return child;
 });
 syncBuiltinESMExports();
 const {MediaCache}=await import('../src/main/media');
 cache=new MediaCache('unused-directory','unused-ffmpeg',async id=>({episodeId:id,duration:1,definition:'540p',codec:'h264',encrypted:false,url:'https://example.com/video',size:6}));
 try{
  await assert.rejects(cache.prepare('7695386527160863769'),{code:'CANCELLED'});
  assert.ok(closing);await closing;
  assert.equal(spawnMock.mock.callCount(),0,'shutdown must prevent the decoder from starting');
  assert.equal(fetchMock.mock.callCount(),1,'shutdown must not retry resource preparation');
 }finally{
  await cache.close();for(const patch of patches)patch.mock.restore();fetchMock.mock.restore();spawnMock.mock.restore();syncBuiltinESMExports();
 }
});

test('退出期间才返回的资源不能开始下载',async t=>{
 let resolveResource!:(resource:Resource)=>void;
 const resource=new Promise<Resource>(resolve=>{resolveResource=resolve});
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>{throw new Error('unexpected download')});
 const unlinkMock=t.mock.method(fs,'unlink',async()=>{});syncBuiltinESMExports();
 const {MediaCache}=await import('../src/main/media');
 const cache=new MediaCache('unused-directory','unused-ffmpeg',()=>resource);
 try{
  const prepared=cache.prepare('7695386527160863769');
  const rejected=assert.rejects(prepared,{code:'CANCELLED'});const closing=cache.close();
  resolveResource({episodeId:'7695386527160863769',duration:1,definition:'540p',codec:'h264',encrypted:false,url:'https://example.com/video',size:6});
  await rejected;await closing;assert.equal(fetchMock.mock.callCount(),0);
 }finally{await cache.close();fetchMock.mock.restore();unlinkMock.mock.restore();syncBuiltinESMExports()}
});
