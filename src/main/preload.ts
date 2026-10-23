import {contextBridge,ipcRenderer} from 'electron';import type {DesktopApi} from '../shared/types';
const api:DesktopApi={
 bufferEpisodes:ids=>ipcRenderer.invoke('buffer-episodes',ids),
 bufferState:()=>ipcRenderer.invoke('buffer-state'),retryBuffer:()=>ipcRenderer.invoke('buffer-retry'),
 catalog:(board,offset)=>ipcRenderer.invoke('catalog',board,offset),search:(query,offset)=>ipcRenderer.invoke('search',query,offset),importShare:text=>ipcRenderer.invoke('share',text),series:id=>ipcRenderer.invoke('series',id),playback:(id,force)=>ipcRenderer.invoke('playback',id,force),library:()=>ipcRenderer.invoke('library'),favorite:(work,enabled)=>ipcRenderer.invoke('favorite',work,enabled),progress:value=>ipcRenderer.invoke('progress',value),checkUpdate:()=>ipcRenderer.invoke('update'),
 updateState:()=>ipcRenderer.invoke('update-state'),downloadUpdate:()=>ipcRenderer.invoke('update-download'),installUpdate:()=>ipcRenderer.invoke('update-install'),
 onUpdate:listener=>{const handler=(_event:Electron.IpcRendererEvent,state:Parameters<typeof listener>[0])=>listener(state);ipcRenderer.on('update-status',handler);return ()=>{ipcRenderer.removeListener('update-status',handler);};},
};contextBridge.exposeInMainWorld('desktop',api);
