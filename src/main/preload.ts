import {contextBridge,ipcRenderer} from 'electron';import type {DesktopApi} from '../shared/types';
const api:DesktopApi={
 catalog:(board,offset)=>ipcRenderer.invoke('catalog',board,offset),search:(query,offset)=>ipcRenderer.invoke('search',query,offset),importShare:text=>ipcRenderer.invoke('share',text),series:id=>ipcRenderer.invoke('series',id),playback:(id,force)=>ipcRenderer.invoke('playback',id,force),library:()=>ipcRenderer.invoke('library'),favorite:(work,enabled)=>ipcRenderer.invoke('favorite',work,enabled),progress:value=>ipcRenderer.invoke('progress',value),checkUpdate:()=>ipcRenderer.invoke('update'),
};contextBridge.exposeInMainWorld('desktop',api);
