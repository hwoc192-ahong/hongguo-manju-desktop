import {createServer,ServerResponse} from 'node:http';import {createReadStream,existsSync} from 'node:fs';import {mkdir,readFile,stat} from 'node:fs/promises';import {Readable} from 'node:stream';import path from 'node:path';import os from 'node:os';
import {Signer,Transport} from '../main/transport';import {ContentProvider,ProviderError} from '../main/provider';import {MediaCache} from '../main/media';import {CacheManager} from '../main/cache-manager';import {LibraryStore} from '../main/library';import {RecommendationService} from '../main/recommendations';import {Diagnostics} from '../main/diagnostics';import {AppError} from '../main/errors';import {resolveFfmpeg} from '../main/runtime-paths';
import type {Board,CacheLimits,CachePriority,Progress,Result,UpdateState,VideoQuality,Work} from '../shared/types';

// 红果漫剧网页版：用 Node HTTP 服务复刻 Electron 主进程的全部内容/缓存能力。
// 渲染层 UI 不做修改，由 web-shim 把 window.desktop 调用转发到这里的 /api 接口。
const MIME:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2','.map':'application/json'};

async function main(){
  const version=JSON.parse(await readFile(path.resolve(__dirname,'../../package.json'),'utf8')).version as string;
  const rendererDir=path.resolve(__dirname,'../renderer');
  const userData=process.env.HONGGUO_WEB_DATA||(process.platform==='win32'&&process.env.APPDATA?path.join(process.env.APPDATA,'红果漫剧网页版'):path.join(os.homedir(),'.local','share','红果漫剧网页版'));
  const runtime=process.env.HONGGUO_RUNTIME||path.resolve(process.cwd(),'runtime-bundle');
  const port=Number(process.env.HONGGUO_WEB_PORT||8080),host=process.env.HONGGUO_WEB_HOST||'127.0.0.1';

  await mkdir(userData,{recursive:true});
  const diagnostics=new Diagnostics();
  const sdkReady=['libmetasec_ml.so','libc++_shared.so','ms_16777218.bin'].every(name=>existsSync(path.join(runtime,'sdk',name)));
  const sdkHint='榜单、剧集详情与分享导入需要签名组件：请把 libmetasec_ml.so、libc++_shared.so、ms_16777218.bin 放入 runtime-bundle/sdk/ 目录后重启服务（详见 docs/web.md）。搜索功能不受影响。';
  const signer=new Signer(runtime,path.join(userData,'runtime-work'));
  const provider=new ContentProvider(new Transport(signer,userData));
  const recommendations=new RecommendationService(provider);
  const library=new LibraryStore(userData);await library.init();
  const media=new MediaCache(await CacheManager.directory(userData),resolveFfmpeg(runtime),(id,quality)=>provider.getResource(id,quality),{concurrency:4,diagnostics});
  await media.init();
  const cache=new CacheManager(userData,media,()=>library.snapshot().history);await cache.init();

  const updateDisabled=():UpdateState=>({status:'unsupported',currentVersion:version,message:'网页版不提供应用内自动更新，请关注项目仓库获取新版本。'});
  type Handler=(...args:any[])=>unknown;
  const routes:Record<string,Handler>={
   'catalog':(board:Board,offset=0)=>provider.catalog(board,offset),
   'search':(query:string,offset=0)=>provider.search(query,offset),
   'share':(text:string)=>provider.resolveShare(text).then(async series=>{await library.favorite(series,true);return series}),
   'series':async(id:string)=>{const series=await provider.getSeries(id);await cache.remember(series);return series},
   'recommendations':(id:string,refresh=false)=>recommendations.get(id,refresh),
   'playback':(id:string,force=false,quality?:VideoQuality)=>{if(quality!==undefined)media.setQuality(quality);return media.prepare(id,force)},
   'video-quality':(quality:VideoQuality)=>{media.setQuality(quality);return true},
   'library':()=>library.snapshot(),
   'favorite':(work:Work,enabled:boolean)=>library.favorite(work,enabled),
   'progress':(progress:Omit<Progress,'updatedAt'>)=>library.progress(progress),
   'buffer-episodes':(ids:string[])=>media.setBufferWindow(ids),
   'buffer-state':()=>media.bufferState(),
   'buffer-retry':()=>media.retryBuffer(),
   'cache-state':()=>cache.snapshot(),
   'cache-add':async(id:string)=>cache.add(await provider.getSeries(id)),
   // 网页版没有原生确认对话框：删除操作直接执行，语义与桌面版确认后一致。
   'cache-action':(id:string,action:'pause'|'resume'|'retry'|'remove'|'delete')=>cache.action(id,action),
   'cache-delete-watched':()=>cache.deleteWatched(),
   'cache-concurrency':(value:number)=>cache.setConcurrency(value),
   'cache-limits':(value:CacheLimits)=>cache.setLimits(value),
   'cache-priority':(id:string,priority:CachePriority)=>cache.setPriority(id,priority),
   'cache-directory':()=>cache.snapshot(),
   'cache-open-directory':()=>{throw new AppError('WEB_UNSUPPORTED','网页版无法打开本地缓存目录，请在缓存中心查看目录路径')},
   'cache-close-to-tray':(enabled:boolean)=>cache.setCloseToTray(enabled),
   'update':()=>updateDisabled(),'update-state':()=>updateDisabled(),'update-download':()=>updateDisabled(),'update-install':()=>updateDisabled(),
  };
  async function result<T>(fn:()=>Promise<T>|T):Promise<Result<T>>{try{return {ok:true,data:await fn()}}catch(error){
    // SDK 缺失时签名必然失败；把晦涩的错误码转换为可直接执行的指引。
    if(!sdkReady&&error instanceof AppError&&['SIGN_FAILED','SIGN_RUNTIME'].includes(String(error.code)))return {ok:false,error:{code:'SIGN_SDK_MISSING',message:`签名组件未就绪，${sdkHint}`}};
    if(error instanceof AppError||error instanceof ProviderError)return {ok:false,error:{code:String((error as any).code),message:String((error as any).message)}};
    return {ok:false,error:{code:'UNAVAILABLE',message:'操作暂未完成，请重试'}}}}

  async function serveIndex(res:ServerResponse){
    let html=await readFile(path.join(rendererDir,'index.html'),'utf8');
    // 播放地址改由同源 /media 提供；web-shim 需在渲染层模块之前注册 window.desktop。
    html=html.replace('media-src manju-media:','media-src \'self\'');
    html=html.replace('<script type="module"','<script src="./web-shim.js"></script>\n    <script type="module"');
    res.writeHead(200,{'content-type':MIME['.html']!,'cache-control':'no-cache'});res.end(html);
  }
  async function serveStatic(pathname:string,res:ServerResponse):Promise<boolean>{
    if(pathname==='/'||pathname==='')pathname='/index.html';
    const relative=path.normalize(decodeURIComponent(pathname)).replace(/^([.][.][/\\])+|^[/\\]+/g,'');
    const file=path.resolve(rendererDir,'.'+path.sep+relative);
    if(file!==rendererDir&&!file.startsWith(rendererDir+path.sep))return false;
    const info=await stat(file).catch(()=>null);
    if(!info||!info.isFile())return false;
    if(relative==='index.html'){await serveIndex(res);return true}
    res.writeHead(200,{'content-type':MIME[path.extname(file).toLowerCase()]??'application/octet-stream','cache-control':relative.startsWith('assets')?'public, max-age=604800':'no-cache'});
    createReadStream(file).pipe(res);return true;
  }

  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
      if(req.method==='GET'&&url.pathname==='/diagnostics.json'){
        res.writeHead(200,{'content-type':'application/json','content-disposition':'attachment; filename="Hongguo-Web-diagnostics.json"','cache-control':'no-store'});
        res.end(JSON.stringify(diagnostics.snapshot(version),null,2));return;
      }
      if(req.method==='GET'&&/^\/media\/local\/[a-f0-9]{32}$/.test(url.pathname)){
        // MediaCache 校验 manju-media://local/<key> 的主机名必须是 local。
        const response=await media.response(`manju-media://local/${url.pathname.slice('/media/local/'.length)}`,req.headers.range||null);
        res.statusCode=response.status;response.headers.forEach((value,name)=>res.setHeader(name,value));
        if(response.body){
          const stream=Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
          // 渐进转码中断会让上游流发出 error；未监听会以未处理异常拖垮整个进程。
          stream.on('error',()=>{res.destroy()});
          res.on('close',()=>stream.destroy());
          stream.pipe(res);
        }else res.end();
        return;
      }
      if(req.method==='POST'&&url.pathname.startsWith('/api/')){
        const channel=url.pathname.slice(5);
        const handler=routes[channel];
        if(!handler){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:{code:'NOT_FOUND',message:'接口不存在'}} satisfies Result<never>));return}
        const limit=1024*1024;const chunks:Buffer[]=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>limit){req.destroy();return}chunks.push(chunk as Buffer)}
        let args:unknown[]=[];
        try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8')||'[]');if(!Array.isArray(parsed))throw new Error();args=parsed}catch{res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:{code:'INVALID_INPUT',message:'请求参数无效'}} satisfies Result<never>));return}
        const payload=await result(()=>handler(...args));
        if(!payload.ok)diagnostics.record({stage:'ipc',code:payload.error?.code});
        res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
        res.end(JSON.stringify(payload));return;
      }
      if(req.method==='GET'&&await serveStatic(url.pathname,res))return;
      res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('未找到页面');
    }catch(error){
      if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});
      res.end(JSON.stringify({ok:false,error:{code:'SERVER',message:'服务暂时不可用，请重试'}}));
      console.error(error);
    }
  });
  server.listen(port,host,()=>{/* 启动信息在下方统一打印 */});

  console.log(`红果漫剧网页版 v${version} 已启动：http://${host}${port===80?'/':':'+port+'/'}`);
  console.log(`数据目录：${userData}`);
  console.log(`运行组件：${runtime}`);
  console.log(sdkReady?'签名组件就绪：榜单、剧集详情、分享导入可用。':'未找到签名 SDK（runtime-bundle/sdk）。搜索与播放资源仍可用；榜单、剧集详情、分享导入需要补齐 SDK 后重启。');
  let closing=false;
  async function shutdown(){
    if(closing)return;closing=true;server.close();
    console.log('正在保存数据并退出…');
    await Promise.allSettled([signer.shutdown(),media.close(),library.flush(),cache.flush()]);
    process.exit(0);
  }
  process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
}
// 流断开类异常不应让进程直接崩溃丢失数据；记录后继续服务。
process.on('uncaughtException',error=>console.error('UNCAUGHT_EXCEPTION',error));
process.on('unhandledRejection',reason=>console.error('UNHANDLED_REJECTION',reason));
void main();
