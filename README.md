# 红果漫剧 Windows 个人客户端

Electron + React + TypeScript，面向 Windows 10/11 x64。提供来源推荐榜、热播榜、新剧榜、搜索、分享链接导入、完整播放、选集、自动连播、本地收藏和断点续播。推荐榜来自内容来源，不同步手机个性化推荐或手机账号。

## 安装使用

运行 `release/Hongguo-Manju-0.2.1-Windows-x64.exe`，选择安装目录后启动「红果漫剧桌面版」。运行时自带精简 Java、签名桥接和 FFmpeg，不需要安装 Node、Python、Java、手机 APP 或 Android 模拟器，也不需要另开服务。

0.2.1 使用已确认的 B/C 融合界面：米白背景、墨黑文字、朱红点缀；顶部导航、宽幅作品推荐与横向继续观看卡片。顶部可切换三个榜单或搜索剧名；主视觉下方圆点可切换作品，收藏按钮收藏当前作品。首页最多显示三部最近观看作品，点击后接着看；没有观看记录时显示真实空状态。

点击「导入链接」粘贴链接或包含链接的分享文字，导入后自动收藏。播放器支持进度、音量、倍速、全屏和上下集；启用自动连播会在结束后进入下一集。首版先完整准备单集再起播，首次加载比流媒体播放器慢一些。

记录与缓存位于 `%APPDATA%/红果漫剧桌面版/`，其中 `library.json` 保存收藏和观看位置。卸载默认保留个人记录。完整损坏的记录文件会先备份为 `library.json.corrupt-*`；单条坏记录会过滤，其余记录保留。

这是本机个人构建，安装包没有代码签名证书。内容依赖上游接口，不保证全部作品和未来版本一直可用。没有公开更新源，「检查更新」会说明当前版本；下载导出、评论、签到、手机账号同步均未提供。

## 验证记录

阶段一已抽查两部作品共十集，核对正片时长并完整播放到结尾，详见 `research/NATIVE-REPORT.md`。阶段二原版验证见 `docs/desktop-validation.md`；0.2.1 界面、实际播放和安装验证见 `docs/bc-ui-validation.md`，机器记录在 `outputs/bc-ui/`。测试通过不代表所有作品/剧集均逐一验收。

独立「红果免费漫剧」接入实验见 [验证报告](docs/independent-app-validation.md)。使用独立 APP 的 `com.kylin.read` / `aid=8704` / `app_name=kylin_read` 身份，已验证分享导入、两部作品共十集完整播放及漫剧榜单进入新作品播放。原生搜索和独立首页尚未通过，签名组件仍复用已有 SDK；这些实验尚未替换正式客户端的接入实现，不能将当前版本称为完全独立接入。正式搜索仍来自红果短剧网页搜索页。

## 开发与重建

开发需要 Windows x64、Node.js 22+。运行依赖已包含于安装版的 `resources/runtime-bundle`。如果使用精简源码 ZIP，先将此目录复制到源码根目录的 `runtime-bundle`；ZIP 不附带研究仓库快照、SDK、个人记录或媒体缓存。

GitHub 仓库同样只包含源码、测试和经过整理的验证报告，不提供安装包、第三方 APK/SDK、Java/FFmpeg 运行依赖或媒体缓存。`npm ci` 后可以执行测试、类型检查和构建；实际启动播放需要自行准备上述本机运行组件。静态 APK 研究脚本还需要独立准备官方 APK 和 Python androguard 环境，原研究数据不随源码上传。

```powershell
npm ci
npm test
npm run typecheck
npm run build
npm start
npm run package:win
```

修改 `runtime/SignerBridge.java` 后，设置 `HONGGUO_JDK` 为完整 JDK 17+ 目录并运行 `node scripts/rebuild-bridge.mjs`；它利用已有运行组件的依赖重新编译桥接类。`npm run runtime` 是原研究环境的完整运行组件准备脚本，需要 `docs/runtime-components.md` 中记载的输入快照，不是自动下载器。

`src/main/provider.ts` 提供榜单、搜索、分享解析、剧集与播放资源能力；`transport.ts` 管理签名子进程，`media.ts` 负责媒体准备与本地 Range 协议，`library.ts` 原子保存记录。`src/renderer/` 只调用有限的 preload API，不能获取签名或内容密钥。`src/probe/` 与旧探测脚本是阶段一研究工具。

## 来源与许可

自有源码采用 GPL-3.0-only，见 `LICENSE`。第三方运行组件保留各自许可；项目许可证不能重新授权第三方 SDK。当前 Android 签名 SDK 的再分发许可未核实，因此本包仅用于用户本机个人构建，不做公共发布，详见 `docs/runtime-components.md`。

用户提供的 [hongguo-desktop-releases](https://github.com/waligoraamodio288-rgb/hongguo-desktop-releases) 不公开应用源码；研究其 TV APK 的请求结构后，独立实现了桥接与媒体流程。未将未明确许可的研究仓库业务类打入正式应用。研究来源和历史接入失败记录保留在 `research/`，不应把早期网页预览结果当成完整客户端的现状。
