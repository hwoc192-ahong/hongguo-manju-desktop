import {build} from 'esbuild';
// 网页版产物：Node 服务端（复用主进程逻辑）+ 浏览器端 desktop shim。
// 注意 vite build 会清空 dist/renderer，因此本脚本必须在 vite build 之后执行。
await build({entryPoints:['src/web/server.ts'],outfile:'dist/web/server.cjs',bundle:true,platform:'node',format:'cjs',target:'node22'});
await build({entryPoints:['src/web/shim.ts'],outfile:'dist/renderer/web-shim.js',bundle:true,platform:'browser',format:'iife',target:'es2022',minify:true});
