#!/usr/bin/env node
// 在 Linux/macOS 上准备 runtime-bundle：从 Maven Central 下载 unidbg 依赖、
// 编译签名桥、检查签名 SDK 与 ffmpeg。Windows 安装包请继续使用 prepare-runtime.mjs。
// 签名 SDK 的三个文件必须自行从 com.dragon.read.oversea.gp 6.8.1.32 APK 提取，
// 脚本不会也不会尝试下载它们。
import {spawn,spawnSync} from 'node:child_process';
import {createWriteStream,existsSync,mkdirSync,readFileSync,statSync,writeFileSync} from 'node:fs';
import path from 'node:path';import readline from 'node:readline';
import {createHash,randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {pipeline} from 'node:stream/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bundle=path.join(root,'runtime-bundle');
const maven='https://repo1.maven.org/maven2';
const ARTIFACTS=[
  ['com/github/zhkl0228','unidbg-android','0.9.8'],
  ['com/github/zhkl0228','unidbg-api','0.9.8'],
  ['com/github/zhkl0228','unicorn','1.0.14'],
  ['com/github/zhkl0228','capstone','3.1.8'],
  ['com/github/zhkl0228','keystone','0.9.7'],
  ['com/github/zhkl0228','demumble','1.0.4'],
  ['net/dongliu','apk-parser','2.6.10'],
  ['net/java/dev/jna','jna','5.13.0'],
  ['commons-codec','commons-codec','1.15'],
  ['org/apache/commons','commons-collections4','4.4'],
  ['commons-io','commons-io','2.11.0'],
  ['commons-logging','commons-logging','1.2'],
  ['com/alibaba','fastjson','1.2.83'],
  ['org/scijava','native-lib-loader','2.3.5'],
  ['org/slf4j','slf4j-api','1.7.36'],
  ['org/slf4j','slf4j-simple','1.7.36'],
];
const SDK_FILES=['libmetasec_ml.so','libc++_shared.so','ms_16777218.bin'];
const sha256=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const log=message=>console.log(`[runtime] ${message}`);

for(const tool of ['java','javac']){
  const probe=spawnSync(tool,['-version'],{encoding:'utf8'});
  if(probe.error||probe.status!==0){console.error(`[runtime] 缺少 ${tool}：请安装 JDK 17+（Ubuntu: sudo apt install openjdk-21-jdk）`);process.exit(1)}
}
log('Java 环境可用');

for(const dir of ['classes','libs','sdk','notices'])mkdirSync(path.join(bundle,dir),{recursive:true});

// Maven 依赖下载（幂等：已存在且非空则校验跳过）。
const manifest={generatedAt:new Date().toISOString(),platform:`${process.platform}-${process.arch}`,dependencies:[]};
for(const [group,artifact,version] of ARTIFACTS){
  const file=path.join(bundle,'libs',`${artifact}-${version}.jar`);
  const url=`${maven}/${group}/${artifact}/${version}/${artifact}-${version}.jar`;
  if(existsSync(file)&&statSync(file).size>0){log(`已有 ${artifact}-${version}.jar`)}
  else{
    log(`下载 ${artifact}-${version}.jar …`);
    const response=await fetch(url);
    if(!response.ok){console.error(`[runtime] 下载失败（${response.status}）：${url}`);process.exit(1)}
    await pipeline(response.body,createWriteStream(file));
  }
  manifest.dependencies.push({artifact:`${group}:${artifact}:${version}`,sha256:sha256(file),bytes:statSync(file).size});
}

// 编译签名桥。
log('编译 SignerBridge …');
const compiled=spawnSync('javac',['--release','17','-cp',path.join(bundle,'libs','*'),'-d',path.join(bundle,'classes'),path.join(root,'runtime','SignerBridge.java')],{encoding:'utf8'});
if(compiled.error||compiled.status!==0){console.error(`[runtime] 编译失败：\n${compiled.stderr||compiled.stdout}`);process.exit(1)}
manifest.bridge='runtime/SignerBridge.java --release 17';

// 签名 SDK：无法也不应自动下载，只能由使用者从官方 APK 提取后放入。
const sdkDir=path.join(bundle,'sdk');
const missing=SDK_FILES.filter(name=>!existsSync(path.join(sdkDir,name)));
if(missing.length){
  log(`警告：签名 SDK 缺少 ${missing.join(', ')}`);
  log('请从 com.dragon.read.oversea.gp 版本 6.8.1.32 的 APK 中提取这三个文件，放入 runtime-bundle/sdk/');
  log('缺少 SDK 时：搜索、播放资源解析仍可用；榜单、剧集详情、分享导入不可用。');
}else{
  manifest.sdk=Object.fromEntries(SDK_FILES.map(name=>[name,sha256(path.join(sdkDir,name))]));
  log('签名 SDK 文件齐全，执行签名冒烟测试 …');
  const child=spawn('java',['-Xmx384m','-cp',`${path.join(bundle,'classes')}${path.delimiter}${path.join(bundle,'libs','*')}`,'app.hongguo.runtime.SignerBridge',sdkDir],{stdio:['pipe','pipe','pipe']});
  const lines=readline.createInterface({input:child.stdout});
  const smoke=await new Promise(resolve=>{
    const timer=setTimeout(()=>resolve(false),120000);
    lines.on('line',line=>{
      try{const reply=JSON.parse(line);if(reply.seq===1){clearTimeout(timer);resolve(!!(reply.headers&&reply.headers['X-Argus']&&reply.headers['X-Gorgon']))}else if(reply.seq===1&&reply.error){clearTimeout(timer);resolve(false)}}catch{}
    });
    // metasec 对无设备上下文的输入返回降级头（X-Neptune），必须用带设备参数的真实请求形状。
    child.stdin.write(JSON.stringify({seq:1,url:'https://api5-normal-sinfonlinea.fqnovel.com/reading/bookapi/bookmall/cell/change/v/?aid=8704&app_name=novelread&version_code=72232&version_name=7.2.2.32&channel=audit&device_platform=android&os_version=12&update_version_code=72232&_rticket='+Date.now()+'&cell_id=7470092475068071998&tab_type=26&client_req_type=2&client_template=2&screen_width_px=1350&selected_items=comic_series_rank&sub_selected_items=comic_series_hot_rank&session_id='+crypto.randomUUID()+'&offset=0&device_id=1234567890123456789&iid=1234567890123456789',headers:{'user-agent':'HongguoTV/0.1','content-type':'application/json; charset=utf-8'}})+'\n');
    child.once('close',()=>{clearTimeout(timer);resolve(false)});
  });
  child.stdin.end();child.kill();
  manifest.signSmokeTest=smoke;
  log(smoke?'签名冒烟测试通过：X-Argus/X-Gorgon 正常返回。':'警告：签名冒烟测试未通过（可能是 unidbg 后端或 SDK 契约差异）。榜单/详情可能不可用，请查看 docs/runtime-components.md。');
}

// ffmpeg：优先使用 bundle 内置文件，否则回退系统 PATH。
const ffmpegLocal=path.join(bundle,process.platform==='win32'?'ffmpeg.exe':'ffmpeg');
const ffmpeg=existsSync(ffmpegLocal)?ffmpegLocal:'ffmpeg';
const ffmpegProbe=spawnSync(ffmpeg,['-version'],{encoding:'utf8'});
if(ffmpegProbe.error){console.error('[runtime] 找不到可用的 ffmpeg：请安装（Ubuntu: sudo apt install ffmpeg）或放置到 runtime-bundle/ffmpeg');process.exit(1)}
const ffmpegVersion=/ffmpeg version (\S+)/.exec(ffmpegProbe.stdout)?.[1]||'unknown';
manifest.ffmpeg={source:existsSync(ffmpegLocal)?'runtime-bundle':'system-path',binary:ffmpeg,version:ffmpegVersion};
log(`ffmpeg 就绪：${ffmpegVersion}（${manifest.ffmpeg.source}）`);

writeFileSync(path.join(bundle,'notices','build-manifest.json'),JSON.stringify(manifest,null,2));
log(`runtime-bundle 准备完成：${bundle}`);
