# 红果漫剧桌面版 · 非官方

在 Windows 电脑上找漫剧、导入分享链接，并接着上次的进度观看。使用 Electron + React + TypeScript 开发，支持 Windows 10/11 x64。

> 本项目是个人维护的第三方非官方客户端，与红果官方及其运营方没有隶属、合作或授权关系。相关品牌、作品、封面及其他内容的权利归各自权利方所有。

项目借鉴了渠道有数维护的 [hongguo-desktop（公开发行仓库）](https://github.com/waligoraamodio288-rgb/hongguo-desktop-releases) 的桌面端使用思路，并在研究其 TV 版请求结构后，实现了本项目的桥接与播放流程。感谢原项目提供的参考。本项目由本仓库作者独立维护，与原项目的发行、更新和反馈渠道分开。

当前仓库公开源码、测试和验证报告，暂不提供安装包或完整运行组件。独立「红果免费漫剧」APP 接入仍处于验证阶段，具体能力和限制见下文。

## 功能

- 浏览来源提供的推荐榜、热播榜和新剧榜，按剧名搜索作品。
- 导入分享链接，查看作品详情和剧集列表，并加入本地收藏。
- 播放、选集、进度拖动、音量、倍速、全屏、上下集和自动连播。
- 保存本机收藏、最近观看和播放进度，退出重开后继续观看。

推荐与榜单来自内容来源；收藏和观看记录保存在当前电脑。首版不接入手机账号，也不同步手机个性化推荐。下载导出、评论和签到福利暂未提供。

## 安装使用

以下说明适用于已准备好运行组件的本机个人构建。GitHub 仓库目前没有可直接下载的安装包，下载源码 ZIP 后不能直接运行应用。

本机安装包路径为 `release/Hongguo-Manju-0.2.1-Windows-x64.exe`，安装后启动「红果漫剧桌面版」。完整个人构建包含精简 Java、签名桥接和 FFmpeg，不需要另行安装 Node、Python、Java、手机 APP 或 Android 模拟器，也不需要手动启动服务。

0.2.1 使用米白背景、墨黑文字和朱红点缀，首页包含顶部导航、宽幅作品推荐和继续观看卡片。顶部可切换三个榜单或搜索剧名；推荐区下方圆点可切换作品，收藏按钮收藏当前作品。首页最多显示三部最近观看作品，点击后接着看。

点击「导入链接」粘贴链接或包含链接的分享文字，导入后自动收藏。播放器支持进度、音量、倍速、全屏和上下集；启用自动连播会在结束后进入下一集。首版先完整准备单集再起播，首次加载比流媒体播放器慢一些。

记录与缓存位于 `%APPDATA%/红果漫剧桌面版/`，其中 `library.json` 保存收藏和观看位置。卸载默认保留个人记录。完整损坏的记录文件会先备份为 `library.json.corrupt-*`；单条坏记录会过滤，其余记录保留。

个人构建尚未配置 Windows 发布者代码签名。当前没有公开更新源，「检查更新」仅说明当前版本。

## 验证记录

阶段一已抽查两部作品共十集，核对正片时长并完整播放到结尾，详见 [播放验证报告](research/NATIVE-REPORT.md)。桌面版验证见 [桌面验收记录](docs/desktop-validation.md)；0.2.1 的界面、播放和安装验证见 [版本验收记录](docs/bc-ui-validation.md)。原始机器记录保存在本机，未上传到仓库。抽样通过不代表所有作品和剧集均已验收。

独立「红果免费漫剧」接入实验见 [验证报告](docs/independent-app-validation.md)。使用独立 APP 的 `com.kylin.read` / `aid=8704` / `app_name=kylin_read` 身份，已验证分享导入、两部作品共十集完整播放及漫剧榜单进入新作品播放。原生搜索和独立首页尚未通过，签名组件仍复用已有 SDK；这些实验尚未替换正式客户端的接入实现，不能将当前版本称为完全独立接入。正式搜索仍来自红果短剧网页搜索页。

## 开发与重建

开发需要 Windows x64、Node.js 22+。完整个人构建的运行依赖位于安装目录的 `resources/runtime-bundle`；重建时需将已准备好的运行组件放入源码根目录的 `runtime-bundle`。组件清单和准备条件见 [运行组件说明](docs/runtime-components.md)。

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

## 参考与致谢

- [渠道有数 · hongguo-desktop](https://github.com/waligoraamodio288-rgb/hongguo-desktop-releases)：桌面端功能组织和 TV 版请求结构的研究参考。该仓库提供发行文件与反馈入口，不公开应用源码；本项目不是其源码分支，也不代表原作者的发行版本。
- [wofanqiang/hongguo-monorepo](https://github.com/wofanqiang/hongguo-monorepo)：多端架构和内容接入流程的研究参考。
- [zhenyong97/hongguo-downloader](https://github.com/zhenyong97/hongguo-downloader)：搜索、详情和原生接口的研究参考。

研究时核对的来源与许可状态见 [来源记录](research/sources.json)。未将许可不明确的研究仓库业务类打入正式应用。历史接入失败记录保留在 `research/`，应结合后续验证报告阅读。

## 项目声明与许可

本项目用于个人使用与技术学习。作品和媒体资源由上游内容服务提供，仓库不存储或分发剧集文件；播放缓存仅保存在本机。使用时请遵守内容来源的服务条款和适用法律，尊重相关权利方的权利。

内容和播放可用性取决于上游接口及网络环境，接口变化可能导致搜索、榜单或播放失效。项目不承诺全部作品可用，也不承诺长期兼容。

自有源码采用 GPL-3.0-only，见 [LICENSE](LICENSE)。第三方运行组件保留各自许可；项目许可证不授予任何作品、品牌或第三方 SDK 的使用与分发权。当前 Android 签名 SDK 的再分发许可尚未核实，因此本仓库只公开源码与报告，不公开分发包含该 SDK 的安装包，详见 [运行组件说明](docs/runtime-components.md)。

## 问题反馈

使用或重建本项目时遇到问题，可在 [本仓库 Issues](https://github.com/lhljpt-web/hongguo-manju-desktop/issues) 提交系统版本、应用版本、复现步骤和错误提示。请将本项目的问题提交到本仓库，避免混淆官方平台和参考项目的维护渠道。
