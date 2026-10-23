export const PLAYBACK_RATES=[0.5,0.75,1,1.25,1.5,2];
const RATE_KEY='hongguo.playbackRate';

export function readPlaybackRate(storage?:Pick<Storage,'getItem'>):number{
 try{
  const value=Number((storage??globalThis.localStorage).getItem(RATE_KEY));
  return PLAYBACK_RATES.includes(value)?value:1;
 }catch{return 1}
}
export function savePlaybackRate(value:number,storage?:Pick<Storage,'setItem'>):boolean{
 if(!PLAYBACK_RATES.includes(value))return false;
 try{(storage??globalThis.localStorage).setItem(RATE_KEY,String(value));return true}catch{return false}
}
