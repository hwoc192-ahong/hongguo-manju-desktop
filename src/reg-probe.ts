import {Transport} from '../src/main/transport';
const t=new Transport(null as any,'/tmp/regtest');
try{
  const r=await t.request('/novel/player/video_model/v1/',{video_id:'7677804745699888153'});
  const item=r.data?.['7677804745699888153']?.video_model;
  console.log('原生接口成功');
}catch(e:any){console.log('最终错误:',e.code,e.message)}
