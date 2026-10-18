import {app,BrowserWindow,ipcMain,protocol,dialog} from 'electron';import path from 'node:path';import {LibraryStore} from './library';import {MediaCache} from './media';import {Signer,Transport} from './transport';import {ContentProvider,ProviderError} from './provider';import {AppError} from './errors';import type {Result,Work,Progress,Board} from '../shared/types';
protocol.registerSchemesAsPrivileged([{scheme:'manju-media',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
app.setName('红果漫剧桌面版');if(process.env.HONGGUO_TEST_DATA)app.setPath('userData',process.env.HONGGUO_TEST_DATA);
if(!app.requestSingleInstanceLock()){app.quit()}else{
 let window:BrowserWindow|null=null;let signer:Signer,media:MediaCache,library:LibraryStore;let quitting=false;
 async function result<T>(fn:()=>Promise<T>|T):Promise<Result<T>>{try{return {ok:true,data:await fn()}}catch(error){if(error instanceof AppError||error instanceof ProviderError)return {ok:false,error:{code:String((error as any).code),message:String((error as any).message)}};return {ok:false,error:{code:'UNAVAILABLE',message:'操作暂未完成，请重试'}}}}
 function handle(channel:string,fn:(...args:any[])=>unknown){ipcMain.handle(channel,(event,...args)=>{if(!window||event.sender!==window.webContents)return {ok:false,error:{code:'IPC_DENIED',message:'请求无效'}};return result(()=>fn(...args))})}
 function createWindow(){
  window=new BrowserWindow({width:1400,height:920,minWidth:1040,minHeight:720,title:'红果漫剧桌面版',backgroundColor:'#f4f0e8',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',(event,url)=>{if(url!==window?.webContents.getURL())event.preventDefault()});
  window.loadFile(path.join(__dirname,'../renderer/index.html'));window.on('closed',()=>{window=null});
 }
 app.whenReady().then(async()=>{
  const runtime=app.isPackaged?path.join(process.resourcesPath,'runtime-bundle'):path.join(app.getAppPath(),'runtime-bundle');signer=new Signer(runtime,path.join(app.getPath('userData'),'runtime-work'));const provider=new ContentProvider(new Transport(signer,app.getPath('userData')));library=new LibraryStore(app.getPath('userData'));await library.init();media=new MediaCache(path.join(app.getPath('userData'),'media-cache'),path.join(runtime,'ffmpeg.exe'),id=>provider.getResource(id));await media.init();
  protocol.handle('manju-media',request=>media.response(request.url,request.headers.get('range')));
  handle('catalog',(board:Board,offset=0)=>provider.catalog(board,offset));handle('search',(query:string,offset=0)=>provider.search(query,offset));handle('series',(id:string)=>provider.getSeries(id));
  handle('share',async(text:string)=>{const series=await provider.resolveShare(text);await library.favorite(series,true);return series});handle('playback',(id:string,force=false)=>media.prepare(id,force));handle('library',()=>library.snapshot());handle('favorite',(work:Work,enabled:boolean)=>library.favorite(work,enabled));handle('progress',(progress:Omit<Progress,'updatedAt'>)=>library.progress(progress));
  handle('update',()=>({message:`当前版本 ${app.getVersion()} 为本机个人版本，暂无公开更新来源。`}));createWindow();
 }).catch(()=>{dialog.showErrorBox('红果漫剧启动失败','应用数据或运行组件无法读取，请检查安装是否完整，以及应用数据目录是否可写。');app.quit()});
 app.on('second-instance',()=>{window?.show();window?.focus()});app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',event=>{if(quitting)return;event.preventDefault();if(window&&!window.isDestroyed()){window.close();return}quitting=true;signer?.close();Promise.allSettled([media?.close(),library?.flush()]).finally(()=>{signer?.close();app.quit()})});
}
