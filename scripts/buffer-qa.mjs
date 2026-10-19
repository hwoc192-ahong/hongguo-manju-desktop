// Real Electron renderer + production preload/MediaCache + local HTTP media + bundled FFmpeg.
// Isolated profile, generated video and no third-party content requests.
import {_electron as electron} from 'playwright-core';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const output=path.resolve(`outputs/buffer-qa-${Date.now()}`);await mkdir(output,{recursive:true});
const video=path.join(output,'fixture.mp4'),ffmpeg=path.resolve('runtime-bundle/ffmpeg.exe');
execFileSync(ffmpeg,['-y','-f','lavfi','-i','testsrc2=s=640x360:r=24','-f','lavfi','-i','sine=frequency=440','-t','10','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',video],{stdio:'ignore',windowsHide:true});
await build({entryPoints:['src/main/media.ts'],outfile:path.join(output,'media.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const main=path.join(output,'main.cjs');
await writeFile(main,`
const {app,BrowserWindow,protocol,ipcMain}=require('electron');
const {MediaCache}=require('./media.cjs');const fs=require('node:fs/promises');const http=require('node:http');
protocol.registerSchemesAsPrivileged([{scheme:'manju-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true}}]);
app.setPath('userData',${JSON.stringify(path.join(output,'profile'))});
const ids=Array.from({length:8},(_,i)=>String(7695386527160863700n+BigInt(i)));
const work={id:'7695370827507698713',title:'滚动缓存验收',cover:'',description:'本地生成视频，真实缓存和转码',total:8};
const requests=[],windows=[],playbacks=[];let library={favorites:[],history:[]},media,server;
global.qa=async()=>({requests,windows,playbacks,completed:await Promise.all((await fs.readdir(${JSON.stringify(path.join(output,'cache'))})).filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await fs.readFile(require('node:path').join(${JSON.stringify(path.join(output,'cache'))},n),'utf8')).episodeId))});
app.whenReady().then(async()=>{
 const bytes=await fs.readFile(${JSON.stringify(video)});
 server=http.createServer((req,res)=>{requests.push(req.url.slice(1));setTimeout(()=>{res.writeHead(200,{'content-type':'video/mp4'});res.end(bytes)},150)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 media=new MediaCache(${JSON.stringify(path.join(output,'cache'))},${JSON.stringify(ffmpeg)},async id=>({episodeId:id,duration:10,definition:'test',codec:'h264',encrypted:false,url:'http://127.0.0.1:'+server.address().port+'/'+id,size:bytes.length}));await media.init();
 protocol.handle('manju-media',request=>media.response(request.url,request.headers.get('range')));
 const handle=(channel,fn)=>ipcMain.handle(channel,async(_event,...args)=>{try{return {ok:true,data:await fn(...args)}}catch(e){return {ok:false,error:{code:e.code,message:e.message}}}});
 handle('catalog',()=>({items:[work],hasMore:false,nextOffset:1,label:'测试',source:'local'}));handle('series',()=>({...work,episodes:ids.map((id,i)=>({id,order:i+1,duration:10}))}));
 handle('library',()=>library);handle('progress',v=>(library={...library,history:[{...v,updatedAt:Date.now()}]}));
 handle('playback',async(id,force)=>{const start=performance.now();const value=await media.prepare(id,force);playbacks.push({id,ms:performance.now()-start});return value});
 handle('buffer-episodes',ids=>{windows.push(ids);media.setBufferWindow(ids)});
 handle('update-state',()=>({status:'current',currentVersion:'test',message:'测试'}));
 const w=new BrowserWindow({width:1280,height:800,webPreferences:{preload:${JSON.stringify(path.resolve('dist/main/preload.cjs'))},contextIsolation:true,nodeIntegration:false,sandbox:true}});await w.loadFile(${JSON.stringify(path.resolve('dist/renderer/index.html'))});
});
app.on('window-all-closed',()=>{media?.close().then(()=>{server?.close();app.quit()})});
`);
let app,page;const errors=[],events=[];let snapshot;
const ids=Array.from({length:8},(_,i)=>String(7695386527160863700n+BigInt(i)));
try{
 app=await electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:[main]});page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
 const state=()=>app.evaluate(()=>global.qa());
 const until=async check=>{for(let i=0;i<400;i++){const value=await state();if(check(value))return value;await page.waitForTimeout(50)}assert.fail('buffer QA timeout')};
 const playing=async order=>{await page.waitForSelector(`.player[aria-label="第${order}集播放器"] video`);await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.currentTime>.1;})};
 await page.locator('.work-card').first().click();await playing(1);await page.getByRole('button',{name:'暂停',exact:true}).click();
 snapshot=await until(s=>s.completed.length===5);assert.deepEqual(snapshot.requests,ids.slice(0,5));assert.deepEqual(snapshot.windows.at(-1),ids.slice(0,5));events.push('first episode starts first; five full files downloaded and transcoded via real FFmpeg');
 await page.getByRole('button',{name:'切换全屏'}).click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.evaluate(()=>{window.qaSurface=document.fullscreenElement});
 await page.getByRole('button',{name:'下一集',exact:true}).click();await playing(2);await page.getByRole('button',{name:'暂停',exact:true}).click();
 snapshot=await until(s=>s.completed.length===6);assert.deepEqual(snapshot.requests,ids.slice(0,6));assert.deepEqual(snapshot.windows.at(-1),ids.slice(1,6));
 assert.equal(await page.evaluate(()=>document.fullscreenElement===window.qaSurface),true);assert.ok(snapshot.playbacks.find(p=>p.id===ids[1]).ms<100,'prepared episode must resolve without download or transcode');events.push('episode 2 reuses ready media in under 100 ms; window advances to episodes 2–6 without leaving fullscreen');
 await page.locator('video').evaluate(v=>{v.currentTime=v.duration-.25;void v.play()});await playing(3);await page.getByRole('button',{name:'暂停',exact:true}).click();
 snapshot=await until(s=>s.completed.length===7);assert.equal(await page.evaluate(()=>document.fullscreenElement===window.qaSurface),true);events.push('natural ended event autoplays cached episode 3 in fullscreen and prepares episode 7');
 await page.getByRole('button',{name:'切换全屏'}).click();await page.waitForFunction(()=>!document.fullscreenElement);
 await page.getByRole('button',{name:'播放第8集',exact:true}).click();await playing(8);await page.getByRole('button',{name:'暂停',exact:true}).click();snapshot=await until(s=>s.windows.at(-1)?.length===1);assert.deepEqual(snapshot.windows.at(-1),[ids[7]]);
 await page.getByRole('button',{name:'返回',exact:true}).click();await until(s=>s.windows.at(-1)?.length===0);events.push('jumping near the end truncates the window; leaving the detail page clears it');
 assert.deepEqual(errors,[]);snapshot=await state();await writeFile(path.join(output,'report.json'),JSON.stringify({passed:true,events,errors,snapshot},null,2));console.log(JSON.stringify({passed:true,events,playbacks:snapshot.playbacks,output},null,2));
}catch(error){await writeFile(path.join(output,'report.json'),JSON.stringify({passed:false,events,errors,failure:error.message,snapshot,text:await page?.locator('body').innerText().catch(()=>undefined)},null,2));throw error}
finally{if(app)await app.close()}
