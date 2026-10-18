import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Signer, Transport} from '../src/main/transport';
import {ContentProvider} from '../src/main/provider';

const VID='7695075636313852953';
const endpoint='/novel/player/video_model/v1/';
const body={video_id:VID,content_type:1,biz_param:{need_all_video_definition:true,video_platform:3}};
async function fixture(run:(dir:string)=>Promise<void>){
 const dir=await mkdtemp(path.join(tmpdir(),'manju-player-profile-'));
 try{await run(dir)}finally{await rm(dir,{recursive:true,force:true})}
}

test('playback obtains resources with a persisted installation identity and no legacy signatures',async t=>fixture(async dir=>{
 const signer=new Signer('unused');
 const sign=t.mock.method(signer,'sign',async()=>({'X-Argus':'legacy','X-Gorgon':'legacy'}));
 const identities:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{
  const url=new URL(String(input));const headers=new Headers(init.headers);
  if(!/^[1-9]\d{18}$/.test(url.searchParams.get('device_id')??'')||!/^[1-9]\d{18}$/.test(url.searchParams.get('iid')??'')||headers.has('X-Argus'))return new Response('');
  identities.push(`${url.searchParams.get('device_id')}:${url.searchParams.get('iid')}`);
  assert.equal(url.searchParams.get('aid'),'8704');assert.deepEqual(JSON.parse(init.body),body);
  return Response.json({code:0,data:{video_model:{status:10,video_duration:153.206,video_list:[{main_url:'https://media.example/episode',definition:'540p',codec_type:'bytevc1',size:9754856,encrypt:false}]}}});
 });
 const first=await new ContentProvider(new Transport(signer,dir)).getResource(VID);
 const reopened=await new ContentProvider(new Transport(signer,dir)).getResource(VID);
 assert.equal(first.duration,153.206);assert.equal(reopened.episodeId,VID);
 assert.equal(identities.length,2);assert.equal(identities[0],identities[1]);assert.equal(sign.mock.callCount(),0);
 const stored=JSON.parse(await readFile(path.join(dir,'player-profile.json'),'utf8'));
 assert.equal(`${stored.device_id}:${stored.iid}`,identities[0]);
}));

test('concurrent playback requests reuse one identity and callers cannot override it',async t=>fixture(async dir=>{
 const signer=new Signer('unused');t.mock.method(signer,'sign',async()=>({}));
 const ids:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any)=>{const u=new URL(String(input));ids.push(`${u.searchParams.get('device_id')}:${u.searchParams.get('iid')}`);return Response.json({code:0,data:{}})});
 const transport=new Transport(signer,dir);
 await Promise.all([transport.request(endpoint,body),transport.request(endpoint,body,{device_id:'invalid',iid:'invalid'})]);
 assert.equal(new Set(ids).size,1);assert.doesNotMatch(ids[0],/invalid|null/);
}));

test('a failed playback request does not rotate the stored identity on retry',async t=>fixture(async dir=>{
 const signer=new Signer('unused');t.mock.method(signer,'sign',async()=>({}));
 const ids:string[]=[];
 t.mock.method(globalThis,'fetch',async(input:any)=>{
  const url=new URL(String(input));ids.push(`${url.searchParams.get('device_id')}:${url.searchParams.get('iid')}`);
  return ids.length===1?new Response(''):Response.json({code:0,data:{}});
 });
 const transport=new Transport(signer,dir);
 await assert.rejects(transport.request(endpoint,body),{code:'API_EMPTY'});
 await transport.request(endpoint,body);assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);
}));

test('a corrupt identity is reported without rotating it or making network requests',async t=>fixture(async dir=>{
 const file=path.join(dir,'player-profile.json'),bad='{"device_id":"broken","iid":"123"}';await writeFile(file,bad);
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>Response.json({code:0,data:{}}));
 const signer=new Signer('unused');t.mock.method(signer,'sign',async()=>({}));
 await assert.rejects(new Transport(signer,dir).request(endpoint,body),{code:'PLAYER_PROFILE'});
 assert.equal(await readFile(file,'utf8'),bad);assert.equal(fetchMock.mock.callCount(),0);
}));

test('an unwritable profile path fails explicitly before requesting playback',async t=>fixture(async dir=>{
 const file=path.join(dir,'file');await writeFile(file,'occupied');
 const fetchMock=t.mock.method(globalThis,'fetch',async()=>Response.json({code:0,data:{}}));
 const signer=new Signer('unused');t.mock.method(signer,'sign',async()=>({}));
 await assert.rejects(new Transport(signer,file).request(endpoint,body),{code:'PLAYER_PROFILE'});
 assert.equal(fetchMock.mock.callCount(),0);
}));

test('catalog requests keep the signed transport and do not require a player identity',async t=>fixture(async dir=>{
 const signer=new Signer('unused');const sign=t.mock.method(signer,'sign',async()=>({'X-Argus':'signed','X-Gorgon':'signed'}));
 t.mock.method(globalThis,'fetch',async(input:any,init:any)=>{
  assert.equal(new Headers(init.headers).get('X-Argus'),'signed');assert.equal(new URL(String(input)).searchParams.has('device_id'),false);
  return Response.json({code:0,data:{}});
 });
 await new Transport(signer,dir).request('/reading/bookapi/bookmall/cell/change/v');
 assert.equal(sign.mock.callCount(),1);await assert.rejects(readFile(path.join(dir,'player-profile.json')),{code:'ENOENT'});
}));
