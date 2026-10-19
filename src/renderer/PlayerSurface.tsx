import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';

// The fullscreen target must survive episode-keyed Player replacements.
export function PlayerSurface({episodeId,children}:{episodeId:string;children:ReactNode}){
 const surface=useRef<HTMLDivElement>(null);
 const [fullscreen,setFullscreen]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [hidden,setHidden]=useState(false);
 const [activity,setActivity]=useState(0);
 const [overControls,setOverControls]=useState(false);
 const [keyboardControls,setKeyboardControls]=useState(false);
 const [dragging,setDragging]=useState(false);
 function reveal(){setHidden(false);setActivity(value=>value+1);}
 useEffect(()=>{
  const changed=()=>{setFullscreen(document.fullscreenElement===surface.current);reveal();};
  document.addEventListener('fullscreenchange',changed);
  const released=()=>setDragging(false);window.addEventListener('pointerup',released);window.addEventListener('pointercancel',released);
  return ()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('pointerup',released);window.removeEventListener('pointercancel',released);};
 },[]);
 useEffect(()=>{setPlaying(false);setHidden(false);setOverControls(false);setKeyboardControls(false);setDragging(false);},[episodeId]);
 useEffect(()=>{
  if(!fullscreen||!playing||overControls||keyboardControls||dragging){setHidden(false);return;}
  const timer=window.setTimeout(()=>setHidden(true),2500);
  return ()=>window.clearTimeout(timer);
 },[fullscreen,playing,activity,overControls,keyboardControls,dragging]);
 const inControls=(target:EventTarget|null)=>target instanceof Element&&!!target.closest('.player-controls');
 return <div ref={surface} className={`player-surface${fullscreen&&hidden?' controls-hidden':''}`}
  onPointerMove={event=>{reveal();setOverControls(inControls(event.target));}}
  onPointerLeave={()=>setOverControls(false)}
  onPointerDown={event=>{reveal();setKeyboardControls(false);if(inControls(event.target))setDragging(true);}}
  onKeyDownCapture={event=>{reveal();if(event.key==='Tab'||inControls(event.target))setKeyboardControls(true);}}
  onBlurCapture={event=>{if(!inControls(event.relatedTarget))setKeyboardControls(false);}}
  onPlayCapture={()=>setPlaying(true)} onPauseCapture={()=>setPlaying(false)} onEndedCapture={()=>setPlaying(false)}>
  {children}
 </div>;
}
