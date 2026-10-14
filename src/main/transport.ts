import {mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {safeJson} from './json';
import {spawn, type ChildProcessWithoutNullStreams} from 'node:child_process';import {createInterface} from 'node:readline';import {createHash} from 'node:crypto';import path from 'node:path';
import type {ApiTransport} from '../shared/types';import {AppError} from './errors';
type Reply={seq:number;headers?:Record<string,string>;error?:string};
export class Signer {
 private process:ChildProcessWithoutNullStreams|null=null;private seq=0;private pending=new Map<number,{resolve:(headers:Record<string,string>)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 constructor(private runtime:string,private workDirectory=path.join(tmpdir(),'hongguo-runtime')){}
 private start(){if(this.process)return;mkdirSync(this.workDirectory,{recursive:true});
  const child=spawn(path.join(this.runtime,'java/bin/java.exe'),['-Xmx384m',`-Djava.io.tmpdir=${this.workDirectory}`,'-cp',`${path.join(this.runtime,'classes')};${path.join(this.runtime,'dependencies.jar')}`,'app.hongguo.runtime.SignerBridge',path.join(this.runtime,'sdk')],{cwd:this.workDirectory,windowsHide:true,stdio:['pipe','pipe','pipe']});this.process=child;
  child.stderr.resume();const lines=createInterface({input:child.stdout});lines.on('line',line=>{
   if(line.length>100000)return;let reply:Reply;try{reply=JSON.parse(line)}catch{return}const pending=this.pending.get(reply.seq);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(reply.seq);
   if(reply.error||!reply.headers?.['X-Argus']||!reply.headers?.['X-Gorgon'])pending.reject(new AppError('SIGN_FAILED','内容连接准备失败，请重试'));else pending.resolve(reply.headers);
  });
  const fail=()=>{lines.close();if(this.process!==child)return;this.process=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new AppError('SIGN_RUNTIME','内容服务已退出，请重试'))}this.pending.clear()};child.once('error',fail);child.once('close',fail);child.stdin.on('error',()=>{});
 }
 sign(url:string,headers:Record<string,string>):Promise<Record<string,string>>{
  this.start();if(!this.process)throw new AppError('SIGN_RUNTIME','内容组件无法启动');const seq=++this.seq;return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(seq);reject(new AppError('SIGN_TIMEOUT','内容连接准备超时，请重试'));this.close()},35000);this.pending.set(seq,{resolve,reject,timer});this.process!.stdin.write(JSON.stringify({seq,url,headers})+'\n',error=>{if(error){clearTimeout(timer);this.pending.delete(seq);reject(new AppError('SIGN_RUNTIME','内容组件无法启动'))}});
  });
 }
 close(){const child=this.process;this.process=null;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new AppError('CANCELLED','内容服务已停止'))}this.pending.clear();child?.stdin.end();child?.kill()}
}
export class Transport implements ApiTransport {
 constructor(private signer:Signer){}
 async request(endpoint:string,body?:unknown,extra:Record<string,string|number|boolean>={}){
  if(!/^\/(?:novel\/player\/|reading\/bookapi\/)/.test(endpoint))throw new AppError('INVALID_ENDPOINT','内容接口无效');
  const url=new URL(endpoint,'https://api5-normal-sinfonlinea.fqnovel.com');
  for(const [k,v] of Object.entries({aid:'8704',app_name:'novelread',version_code:'72232',version_name:'7.2.2.32',channel:'audit',device_platform:'android',os_version:'12',update_version_code:'72232',_rticket:Date.now(),...extra}))url.searchParams.set(k,String(v));
  const payload=body===undefined?undefined:JSON.stringify(body);const headers:Record<string,string>={'user-agent':'HongguoTV/0.1','content-type':'application/json; charset=utf-8',...(payload?{'x-ss-stub':createHash('md5').update(payload).digest('hex').toUpperCase()}: {})};
  const signatures=await this.signer.sign(url.href,headers);let response:Response;
  try{response=await fetch(url,{method:payload?'POST':'GET',headers:{...headers,...signatures},body:payload,signal:AbortSignal.timeout(25000)})}catch{throw new AppError('NETWORK','无法连接内容来源，请检查网络后重试')}
  if(!response.ok)throw new AppError('API_HTTP',`内容来源暂不可用（${response.status}）`);
  const text=await response.text();if(!text.trim())throw new AppError('API_EMPTY','内容来源返回空结果，请稍后重试');if(text.length>8*1024*1024)throw new AppError('API_FORMAT','内容返回过大');
  let json:any;try{json=safeJson(text)}catch{throw new AppError('API_FORMAT','内容来源的数据格式发生变化')}
  if(json.code!==undefined&&json.code!==0)throw new AppError('API_UNAVAILABLE',`内容来源暂不可用（代码 ${Number(json.code)||'未知'}）`);return json;
 }
}
