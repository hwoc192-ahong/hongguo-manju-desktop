# 下载、安装与使用指南

[返回项目首页](../README.md) · [查看界面截图](../README.md#界面预览) · [发布页面](https://github.com/lhljpt-web/hongguo-manju-desktop/releases)

## 先确认下载状态

0.2.1 Windows x64 测试版已提供安装包、源码归档和 SHA-256 校验文件。

**[直接下载 Windows x64 安装包](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/download/v0.2.1/Hongguo-Manju-0.2.1-Windows-x64.exe)** · [发布页面与校验文件](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/tag/v0.2.1)

普通用户选择 `.exe`，下载后双击安装即可。Source code ZIP 或 Code → Download ZIP 得到的是开发源码，不能双击安装。此版本为测试版，仍有 [已知限制](releases/v0.2.1.md#验证与已知限制)。

## 系统要求

| 项目 | 要求或说明 |
| --- | --- |
| 系统 | Windows 10 / 11，x64（64 位） |
| 网络 | 获取榜单、搜索、作品详情和播放内容需要联网 |
| 磁盘 | 需留出应用安装和整集媒体缓存所需空间；缓存大小随观看内容增加 |
| 手机 | 完整个人构建运行时不需要手机或 Android 模拟器 |
| 开发环境 | 完整安装包不需要额外安装 Node.js、Python 或 Java |
| 其他平台 | 暂未提供 macOS、Linux 或 Windows ARM64 安装包 |

可在 Windows「设置 → 系统 → 关于 → 系统类型」核对设备是否为 x64。项目做过本机安装与隔离运行环境检查，尚未在全新的无开发环境 Windows 电脑上完成验证。

## 在 GitHub 哪里找安装包

1. 打开 [本仓库](https://github.com/lhljpt-web/hongguo-manju-desktop)，核对地址中的账号为 `lhljpt-web`，仓库名为 `hongguo-manju-desktop`。
2. 电脑宽屏页面通常在右侧显示 Releases；窗口较窄时位置可能变化，也可直接进入 [发布列表](https://github.com/lhljpt-web/hongguo-manju-desktop/releases)。
3. 打开 0.2.1 测试版，展开 Assets，选择 `Hongguo-Manju-0.2.1-Windows-x64.exe` 安装附件。
4. `.exe` 是 Windows 安装程序；`SHA256SUMS.txt` 用于校验文件。Source code (zip) 和 Source code (tar.gz) 是 GitHub 自动提供的源码归档。

此版本标记为 Pre-release（测试版）。如果没有显示在 Latest 入口，请直接进入 [0.2.1 发布页面](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/tag/v0.2.1)。

## 安装程序

1. 保存 `Hongguo-Manju-0.2.1-Windows-x64.exe`。文件约 173 MiB，下载或复制时需等待文件完整写入。
2. 如果同时取得 `SHA256SUMS.txt`，可以按下一节核对文件摘要。
3. 双击 `.exe`，按安装向导选择安装目录，再执行安装。
4. 完成后从桌面快捷方式或开始菜单启动「红果漫剧桌面版」。
5. 进入首页后等待榜单载入，点击作品，再进入播放或选择指定集数。

此个人构建尚未配置 Windows 发布者代码签名。若系统提示未知发布者，先核对文件来源和摘要；摘要只能证明文件一致，不能代替发布者身份认证。不需要关闭系统防护。

### 可选：核对文件摘要

在安装文件所在文件夹打开 PowerShell，执行：

```powershell
Get-FileHash -LiteralPath '.\Hongguo-Manju-0.2.1-Windows-x64.exe' -Algorithm SHA256
```

当前本机 0.2.1 安装包的 SHA-256 为：

```text
e0193adb6229adfda01b9c48f81cb6218cf644934e7ec69023a4f7d7600706f8
```

逐字符核对结果；十六进制字母大小写不影响比较。同版本如果重新构建，应以对应附件同时提供的校验文件为准。

## 首次打开后怎么用

### 浏览与搜索

顶部「推荐」「热播」「新剧」切换不同榜单。点击作品卡片查看详情和剧集列表；搜索框可以输入完整剧名。对相近标题、不同季数或同名版本，请先核对作品名称，再播放。

![首页推荐与搜索入口](screenshots/home.webp)

### 导入分享链接

1. 在手机端打开作品的分享功能，复制链接或分享文字。
2. 在桌面端点击右上角「导入链接」。
3. 将内容粘贴到输入框，点击「导入并收藏」。
4. 解析成功后核对作品标题、集数和顺序，再开始观看。导入成功的作品会加入本地收藏。

![分享导入窗口](screenshots/share-import.webp)

导入只识别受支持的来源链接。链接失效或解析失败会显示错误，不会自动替换为其他作品。

### 播放、选集与续播

右侧点击集数切换剧集；播放器下方可暂停、拖动进度、调整音量和倍速，或进入全屏。开启自动连播后，当前集结束时进入下一集。首版会先准备完整单集再起播，首次加载耗时取决于网络与文件大小。

![播放与选集界面](screenshots/player.webp)

收藏和播放进度保存在当前电脑。下次打开后，可以从首页继续观看卡片或「历史」返回作品；收藏列表与观看历史不是手机账号同步数据。

## 升级、卸载与记录

目前没有公开自动更新源，「检查更新」只显示当前版本信息。取得新的可信个人构建后，先关闭应用，再运行新安装包；保留相同的应用数据目录才能沿用本机记录。

卸载可在 Windows「设置 → 应用 → 已安装的应用」（不同系统名称可能略有差异）中找到「红果漫剧桌面版」并选择卸载。默认保留个人记录。

数据目录：

```text
%APPDATA%\红果漫剧桌面版\
```

`library.json` 保存收藏与观看位置，`media-cache` 保存媒体缓存。需要备份时，先关闭程序，再复制 `library.json`。清理空间时不要误删观看记录；缓存损坏可在程序关闭后仅清理 `media-cache`，下次播放会重新准备媒体。

## 从源码运行（适合开发者）

### 1. 下载源码

在仓库首页点击 Code → Download ZIP，解压到本地文件夹。安装 Node.js 22 或更新版本，并在解压后的项目根目录打开 PowerShell；这里应能看到 `package.json`。

也可以使用 Git：

```powershell
git clone https://github.com/lhljpt-web/hongguo-manju-desktop.git
cd hongguo-manju-desktop
```

### 2. 安装依赖并检查

```powershell
npm ci
npm test
npm run typecheck
npm run build
```

上述步骤用于源码检查与编译；通过不表示已经具备连接内容服务的全部运行组件。

### 3. 准备运行组件

当前仓库没有自动补齐全部组件的下载器。需要先准备 [运行组件说明](runtime-components.md) 中的 Java、桥接类、依赖 JAR、SDK 和 FFmpeg，再形成下列目录：

```text
runtime-bundle/
├── java/bin/java.exe
├── classes/app/hongguo/runtime/SignerBridge.class
├── dependencies.jar
├── sdk/
│   ├── libmetasec_ml.so
│   ├── libc++_shared.so
│   └── ms_16777218.bin
├── ffmpeg.exe
└── notices/
```

已有完整本机个人构建时，可从安装目录的 `resources/runtime-bundle` 复制整个目录到源码根目录。仅安装系统 Java 或 FFmpeg 不能替代这套固定组件。`npm run runtime` 依赖原研究环境的输入文件，不能在全新电脑上直接自动下载完成配置。

### 4. 启动或打包

```powershell
npm start
```

准备好完整组件后，如需生成供本机使用的安装包：

```powershell
npm run package:win
```

输出在 `release/`。个人构建成功不等于所有第三方组件的公开分发许可已经确认，许可状态请查阅运行组件说明。

## 常见问题

| 现象 | 说明与处理 |
| --- | --- |
| 右侧没有找到安装包 | 直接进入 [0.2.1 发布页面](https://github.com/lhljpt-web/hongguo-manju-desktop/releases/tag/v0.2.1)，展开 Assets 并选择 `.exe`；不要下载 Source code ZIP 作为安装包。 |
| 下载了 ZIP，找不到可执行程序 | 这是源码归档。开发者可按上面的源码运行步骤操作，仍需准备完整运行组件。 |
| 启动提示应用数据或运行组件无法读取 | 检查安装是否完整、应用数据目录是否可写；源码运行时还需检查 `runtime-bundle` 是否齐全。 |
| 首页为空、搜索失败 | 检查网络并重试。同一网络能打开网页，不代表所有内容接口都可用；也可能是上游接口变化。 |
| 分享链接导入失败 | 重新复制作品的原始分享内容，检查链接是否完整；仍失败时记录提示原文和作品标题。 |
| 点击播放后需要等待 | 当前版本先准备完整单集再起播。持续失败时重试当前集一次，再换另一部作品对照。 |
| 黑屏或中途报错 | 查看错误提示，手动重试当前集；若只在特定剧集出现，反馈作品、集数与操作步骤。 |
| 手机收藏和观看历史没有出现 | 首版只保存在本机，不接入手机账号，也不支持跨设备同步。 |
| 推荐内容与手机不同 | 榜单来自当前接入的内容来源，不是手机账号的个性化推荐。 |
| 这是独立漫剧 APP 的完整电脑版吗 | 尚不能这样称呼。正式客户端仍使用现有短剧/TV 接入，独立漫剧 APP 的原生搜索与首页未完成验证，详见 [接入报告](independent-app-validation.md)。 |

如果仍有问题，请到 [本仓库 Issues](https://github.com/lhljpt-web/hongguo-manju-desktop/issues) 提交 Windows 版本、应用版本、作品与集数、复现步骤、预期结果和错误提示。截图请遮住无关个人信息，不要提交账号凭据、签名或完整播放地址。
