import {existsSync} from 'node:fs';import path from 'node:path';

// 运行组件路径在 Windows 安装包与其他平台之间自动切换：
// Windows 打包环境使用 runtime-bundle 内置的二进制；其他平台回退到系统 PATH。
export function resolveFfmpeg(runtime:string):string{
  const exe=path.join(runtime,process.platform==='win32'?'ffmpeg.exe':'ffmpeg');
  return existsSync(exe)?exe:'ffmpeg'+(process.platform==='win32'?'.exe':'');
}

export function resolveJava(runtime:string):string{
  const bin=path.join(runtime,'java','bin','java'+(process.platform==='win32'?'.exe':''));
  return existsSync(bin)?bin:'java';
}
