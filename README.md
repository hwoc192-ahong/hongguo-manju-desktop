# 红果漫剧桌面版 · 非官方

在 Windows 电脑上找漫剧、导入分享链接，并接着上次的进度观看。使用 Electron + React + TypeScript 开发，支持 Windows 10/11 x64。

**[下载 Windows x64 安装包 · 0.2.9 测试版](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/download/v0.2.9/Hongguo-Manju-0.2.9-Windows-x64.exe)** · [发布说明与校验文件](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/tag/v0.2.9) · [安装指南](docs/installation.md)

> 本项目是个人维护的第三方非官方客户端，与红果官方及其运营方没有隶属、合作或授权关系。相关品牌、作品、封面及其他内容的权利归各自权利方所有。

项目借鉴了渠道有数维护的 [hongguo-desktop（公开发行仓库）](https://github.com/waligoraamodio288-rgb/hongguo-desktop-releases) 的桌面端使用思路，并在研究其 TV 版请求结构后，实现了本项目的桥接与播放流程。感谢原项目提供的参考。本项目由本仓库作者独立维护，与原项目的发行、更新和反馈渠道分开。

Releases 提供 Windows x64 测试版安装包，仓库提供源码、测试和验证报告。独立「红果免费漫剧」APP 接入仍处于验证阶段，具体能力和限制见下文。

[界面预览](#界面预览) · [下载与安装指南](docs/installation.md) · [使用方法](#开始观看) · [常见问题](docs/installation.md#常见问题) · [发布页面](https://github.com/lhljpt-web/hongguo-manju-desktop/releases) · [问题反馈](https://github.com/lhljpt-web/hongguo-manju-desktop/issues)

## 界面预览

以下为 0.2.1 桌面程序在 2026 年 10 月 14 日验证时的实际界面截图。截图中的作品、封面与片单来自当时的内容来源，不代表当前始终可用。应用需要在 Windows 上运行；本仓库没有提供浏览器在线播放网站。

### 推荐首页

米白背景、朱红按钮，顶部切换推荐、热播和新剧，也可以搜索剧名或导入链接。

![推荐首页：顶部导航、作品推荐和榜单卡片](docs/screenshots/home.webp)

### 播放与选集

左侧按原比例播放，右侧选集；下方提供进度、音量、倍速、全屏和自动连播。

![播放界面：作品详情、155 集选集列表及播放控制](docs/screenshots/player.webp)

<details>
<summary>查看更多：继续观看与分享导入</summary>

验证过程中产生的观看记录会显示为首页的继续观看卡片，可直接回到对应作品。

![继续观看：验证用观看记录与作品卡片](docs/screenshots/continue-watching.webp)

分享导入窗口支持粘贴链接或整段分享文字，解析成功后自动加入收藏。下图截取自导入弹窗，输入框尚未填写。

![分享导入弹窗](docs/screenshots/share-import.webp)

</details>

## 下载前先看

| 项目 | 当前状态 |
| --- | --- |
| 系统 | Windows 10 / 11 x64；暂无 macOS、Linux 或 Windows ARM64 安装包 |
| 版本 | 0.2.9，测试版（Pre-release） |
| 安装包 | [Windows x64 · 约 174 MiB](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/download/v0.2.9/Hongguo-Manju-0.2.9-Windows-x64.exe) |
| 源码 | 可通过本页绿色 Code 按钮 → Download ZIP 下载 |
| 运行依赖 | 源码包不含完整运行组件，仅下载 ZIP 无法直接观看 |
| 手机与账号 | 完整个人构建无需手机或模拟器；不接入手机账号与跨设备同步 |

普通用户下载 `.exe` 安装即可，详细步骤见 [下载与安装指南](docs/installation.md)。也可以从 GitHub 右侧 Releases 进入 0.2.9，在 Assets 中选择 `.exe`。GitHub 自动生成的 Source code ZIP 是源码，不是安装程序。

## 功能

- 浏览来源提供的推荐榜、热播榜和新剧榜，按剧名搜索作品。
- 导入分享链接，查看作品详情和剧集列表，并加入本地收藏。
- 播放、选集、进度拖动、音量、倍速、全屏、上下集和自动连播。
- 优先选择来源提供的最高可播放清晰度；倍速记住上次设置，换集、换作品和重开软件均沿用。
- 当前集优先准备，再后台逐集缓冲后四集；进入下一集后自动补足五集窗口，减少反复等待。
- 保存本机收藏、最近观看和播放进度，退出重开后继续观看。
- 启动后自动检查并提示新版；点击“立即更新”才下载，下载完成后点击“重启安装”升级。

推荐与榜单来自内容来源；收藏和观看记录保存在当前电脑。首版不接入手机账号，也不同步手机个性化推荐。下载导出、评论和签到福利暂未提供。

## 安装使用

从 [0.2.9 发布页面](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/tag/v0.2.9) 下载 `Hongguo-Manju-0.2.9-Windows-x64.exe`。下载源码 ZIP 后不能直接运行应用。

安装包包含精简 Java、签名桥接和 FFmpeg，不需要另行安装 Node、Python、Java、手机 APP 或 Android 模拟器，也不需要手动启动服务。

双击 `.exe`，按向导选择安装目录，安装完成后从桌面或开始菜单启动「红果漫剧桌面版」。逐步操作、文件校验、升级和卸载说明见 [安装指南](docs/installation.md)。

0.2.9 使用米白背景、墨黑文字和朱红点缀，首页包含顶部导航、宽幅作品推荐和继续观看卡片。顶部可切换三个榜单或搜索剧名；推荐区下方圆点可切换作品，收藏按钮收藏当前作品。首页最多显示三部最近观看作品，点击后接着看。

点击「导入链接」粘贴链接或包含链接的分享文字，导入后自动收藏。播放器支持进度、音量、倍速、全屏和上下集；全屏播放时控制栏闲置约 2.5 秒自动隐藏，移动鼠标后显示，暂停时保持显示。手动上下集与自动连播会保持全屏；视频按原比例显示。首版先完整准备单集再起播，首次加载比流媒体播放器慢一些。

记录与缓存位于 `%APPDATA%/红果漫剧桌面版/`，其中 `library.json` 保存收藏和观看位置，`player-profile.json` 保存本次安装的固定播放标识。卸载默认保留个人记录。完整损坏的记录文件会先备份为 `library.json.corrupt-*`；单条坏记录会过滤，其余记录保留。

应用从本仓库 GitHub Releases 获取更新（含测试版）。启动后自动检查，运行期间每 4 小时检查；发现新版后提示，点击「立即更新」才下载并校验；选择「暂不更新」可继续使用当前版本。点击顶部「更新」可查看状态、重试或「重启安装」。普通退出不安装更新。0.2.2 及更早版本需先手动安装一次 0.2.9；0.2.3 仍采用旧的自动下载行为，要避免后台下载可直接手动覆盖安装本版。升级保留收藏、进度和播放标识，详见 [更新说明](docs/auto-update.md)。安装包尚未配置 Windows 发布者代码签名。

## 开始观看

1. **从首页选剧**：在顶部切换推荐、热播或新剧，点击作品卡片进入详情，再点击播放或右侧集数。
2. **搜索作品**：在右上方搜索框输入剧名并提交，核对结果的完整标题和季数后打开作品。
3. **导入分享**：在手机端复制作品分享内容，点击桌面端「导入链接」，粘贴链接或整段文字，再点「导入并收藏」。
4. **控制播放**：拖动进度条定位，调整音量和倍速；点击全屏按钮放大画面。右侧可选集，下方可开关自动连播。
5. **接着上次看**：下次启动时点击首页的继续观看卡片，或从「历史」打开作品。「收藏」保存的是作品列表。

首集需要先准备完整媒体，再开始播放，加载时间受视频大小和网络影响。加载失败时请按 [常见问题](docs/installation.md#常见问题) 排查；不要反复点击不同集数。

## 验证记录

0.2.9 修复清晰度选择与倍速记忆，并保留官方搜索页面改版后的搜索修复，并支持按来源分页加载。搜索词最多 30 字，结果可能包含近似匹配作品，请核对标题和季数。见 [搜索修复记录](docs/search-fix-2026-10-23.md)。

0.2.7 修复旧播放接口空响应及新版嵌套资源格式兼容，已验证完整连续播放和后续集数，见 [2026-10-22 检查与修复](docs/health-check-2026-10-22.md)。0.2.6 及更早版本出现此问题时，请升级当前版本。

0.2.2 修复播放请求空响应及部分集数编码不兼容，见 [故障排查与修复](docs/playback-incident-2026-10-18.md)。

阶段一已抽查两部作品共十集，核对正片时长并完整播放到结尾，详见 [播放验证报告](research/NATIVE-REPORT.md)。桌面版验证见 [桌面验收记录](docs/desktop-validation.md)；0.2.1 的界面、播放和安装验证见 [版本验收记录](docs/bc-ui-validation.md)。原始机器记录保存在本机，未上传到仓库。抽样通过不代表所有作品和剧集均已验收。

独立「红果免费漫剧」接入实验见 [验证报告](docs/independent-app-validation.md)。使用独立 APP 的 `com.kylin.read` / `aid=8704` / `app_name=kylin_read` 身份，已验证分享导入、两部作品共十集完整播放及漫剧榜单进入新作品播放。原生搜索和独立首页尚未通过，签名组件仍复用已有 SDK；这些实验尚未替换正式客户端的接入实现，不能将当前版本称为完全独立接入。正式搜索仍来自红果短剧网页搜索页。

## 开发与重建

开发需要 Windows x64、Node.js 22+。完整个人构建的运行依赖位于安装目录的 `resources/runtime-bundle`；重建时需将已准备好的运行组件放入源码根目录的 `runtime-bundle`。组件清单和准备条件见 [运行组件说明](docs/runtime-components.md)。

Git 源码目录包含源码、文档、截图、测试和整理后的验证报告；安装包单独放在 Releases，源码 ZIP 不含完整运行组件或媒体缓存。`npm ci` 后可以执行测试、类型检查和构建；从源码启动播放需要准备上述运行组件。静态 APK 研究脚本还需要另行准备官方 APK 和 Python androguard 环境，原研究数据不随源码上传。

下载源码后，先安装依赖并执行自动检查：

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

只有准备好完整 `runtime-bundle` 后，才运行应用或打包：

```powershell
npm start
npm run package:win
```

从下载 ZIP、打开终端到检查运行组件的完整步骤见 [源码运行指南](docs/installation.md#从源码运行适合开发者)。

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

自有源码采用 GPL-3.0-only，见 [LICENSE](LICENSE)。第三方运行组件保留各自许可；项目许可证不授予任何作品、品牌或第三方 SDK 的使用与分发权。当前 Android 签名 SDK 的再分发许可尚未核实，安装包发布不表示该事项已解决，详见 [运行组件说明](docs/runtime-components.md)。

## 问题反馈

使用或重建本项目时遇到问题，可在 [本仓库 Issues](https://github.com/lhljpt-web/hongguo-manju-desktop/issues) 提交系统版本、应用版本、复现步骤和错误提示。请将本项目的问题提交到本仓库，避免混淆官方平台和参考项目的维护渠道。
