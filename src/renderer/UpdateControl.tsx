import {useEffect,useState} from 'react';
import type {Result,UpdateState} from '../shared/types';

export function UpdateControl(){
 const [state,setState]=useState<UpdateState>();
 const [open,setOpen]=useState(false);
 const [error,setError]=useState('');
 async function invoke(operation:()=>Promise<Result<UpdateState>>){
  setError('');
  try{const result=await operation();if(!result.ok||!result.data)throw new Error(result.error?.message||'更新操作暂未完成，请重试。');setState(result.data);}
  catch(error){setError(error instanceof Error?error.message:'连接中断，请重试。');}
 }
 useEffect(()=>{
  let live=true;let status='';
  const off=window.desktop.onUpdate(value=>{
   if(!live)return;
   if(value.status!==status&&['downloading','downloaded'].includes(value.status))setOpen(true);
   status=value.status;setState(value);
  });
  void window.desktop.updateState().then(result=>{if(live&&result.ok&&result.data){setState(result.data);if(['downloading','downloaded'].includes(result.data.status))setOpen(true);}}).catch(()=>{if(live)setError('更新状态读取失败，请重试。');});
  return ()=>{live=false;off();};
 },[]);
 const busy=state&&['checking','downloading','installing'].includes(state.status);
 const ready=state?.status==='downloaded';
 const download=state?.status==='downloading';
 return <div className="update-control">
  <button className={`update-launcher ${ready?'update-ready':''}`} aria-label="应用更新" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{download?`${Math.floor(state.percent||0)}%`:ready?'安装更新':'更新'}{ready&&<i/>}</button>
  {open&&<section className="update-panel" aria-label="应用更新面板">
   <div className="update-heading"><div><span>APP UPDATE</span><h2>应用更新</h2></div><button aria-label="收起更新面板" onClick={()=>setOpen(false)}>×</button></div>
   <p className="update-version">当前版本 {state?.currentVersion||'…'}{state?.nextVersion&&<> → {state.nextVersion}</>}</p>
   <p role="status">{state?.message||'正在读取更新状态…'}</p>
   {download&&<><progress aria-label="更新下载进度" max={100} value={state.percent||0}/><p className="update-transfer">{(state.percent||0).toFixed(1)}%{state.total?` · ${((state.transferred||0)/1048576).toFixed(1)} / ${(state.total/1048576).toFixed(1)} MiB`:''}</p></>}
   {error&&<p className="inline-error" role="alert">{error}</p>}
   <div className="update-actions">{ready?<button className="primary-button" onClick={()=>void invoke(()=>window.desktop.installUpdate())}>重启安装</button>:<button className="primary-button" disabled={!!busy||state?.status==='unsupported'} onClick={()=>void invoke(()=>state?.status==='error'&&state.nextVersion?window.desktop.downloadUpdate():window.desktop.checkUpdate())}>{busy?download?'下载中…':state?.status==='installing'?'正在重启…':'检查中…':state?.status==='error'?'重试更新':'检查更新'}</button>}<button className="text-button" onClick={()=>setOpen(false)}>{ready?'稍后安装':'收起'}</button></div>
   <small>自动检查并下载本仓库更新（含测试版）。仅点击“重启安装”后升级，保留收藏与观看记录。</small>
  </section>}
 </div>;
}
