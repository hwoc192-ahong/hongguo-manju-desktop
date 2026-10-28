# 网页版运行指南（Linux / 浏览器）

本项目原本只提供 Windows x64 桌面安装包。现在同一套代码可以直接在 Linux 上以**网页版**运行：Node HTTP 服务复刻 Electron 主进程的内容、签名、缓存与媒体能力，浏览器打开页面即可使用，UI 与桌面版完全一致。

## 快速开始

需要 Node.js 22+、JDK 17+、ffmpeg：

```bash
npm ci                      # 安装依赖
npm run runtime:linux       # 准备 runtime-bundle（下载 unidbg 依赖、编译签名桥）
npm run web                 # 构建并启动网页版（默认 http://127.0.0.1:8080）
```

之后每次启动只需：

```bash
npm run web:start
```

## 签名 SDK（合规声明）

本仓库不包含、也不提供签名 SDK 的任何二进制或分发渠道。`runtime-bundle/sdk/` 下需要以下三个文件方可启用榜单、剧集详情与分享导入：

- `libmetasec_ml.so`（风控签名库）
- `libc++_shared.so`（C++ 运行库）
- `ms_16777218.bin`（签名证书数据）

这三个文件归各自权利方所有，再分发许可未核实。使用者须自行从官方应用安装包中提取、仅限本机个人使用，不得再分发；`runtime-bundle/` 整个目录已被 `.gitignore` 排除，请勿以任何形式提交或分享这些文件。`ms_16777218.bin` 为运行时下发的证书，安装包内并不包含，需在合规前提下自行解决。

放入文件后运行 `npm run runtime:linux`，脚本会做签名冒烟测试（校验 X-Argus/X-Gorgon 返回）。

**技术备注**：metasec 签名函数对「无设备上下文」的输入（裸路径 + 单个 header）返回降级头 `X-Neptune` 而非真签名；URL 必须带 `device_id`/`iid` 等设备参数才会输出 X-Argus/X-Gorgon/X-Ladon 等完整签名集。正式请求链路（`transport.ts`）天然满足，冒烟测试脚本已相应使用完整参数形状。

**没有 SDK 也能用**：搜索、播放资源解析、官网兼容回退播放这三条通道均不依赖签名。缺 SDK 时只有榜单首页、剧集详情和分享导入不可用（点击会提示重试）。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `HONGGUO_WEB_PORT` | `8080` | 服务端口 |
| `HONGGUO_WEB_HOST` | `127.0.0.1` | 监听地址（对外服务改 `0.0.0.0`，注意自行做好访问控制） |
| `HONGGUO_WEB_DATA` | `~/.local/share/红果漫剧网页版` | 收藏、历史、缓存与设置的数据目录 |
| `HONGGUO_RUNTIME` | `./runtime-bundle` | 运行组件目录 |

## 与桌面版的差异

- 播放地址由同源 `/media/local/<key>` 提供（带 Range 支持），不再使用 `manju-media://` 自定义协议。
- 没有系统托盘、窗口驻留、原生确认对话框：缓存删除直接执行，更换缓存目录不可用。
- 不提供应用内自动更新（更新状态显示为「不支持」）。
- 导出诊断改为浏览器下载 JSON 文件。
- 收藏、历史、进度、缓存设置保存在网页版自己的数据目录，与桌面版互不影响。

## Linux 桌面（Electron）方式

跨平台改造后同样可以在 Linux 桌面环境运行 Electron 版本（需要 `npm i -D electron` 已随依赖安装）：

```bash
npm run runtime:linux
npm start
```

自动更新在非 Windows 平台自动停用，其余功能与 Windows 版一致。

## 架构说明

- `src/web/server.ts`：Node HTTP 服务。`/api/<channel>` 对应 preload 的 27 个 IPC 通道；`/media/local/<key>` 复用 `MediaCache.response` 提供带 Range 的视频流；返回 `index.html` 时注入 CSP（`media-src 'self'`）与 `web-shim.js`。
- `src/web/shim.ts`：浏览器端 `window.desktop` 实现，把渲染层调用转发到 `/api/*`，并把 `manju-media://local/<key>` 重写为同源 `/media/local/<key>`。UI 组件零改动。
- `scripts/build-web.mjs`：esbuild 分别打包服务端（`dist/web/server.cjs`）与 shim（`dist/renderer/web-shim.js`）。必须在 `vite build` 之后执行（vite 会清空 `dist/renderer`）。
- `scripts/prepare-runtime-linux.mjs`：从 Maven Central 下载固定版本的 unidbg 0.9.8 及其依赖（清单内置），`javac --release 17` 编译签名桥，检查 SDK 与 ffmpeg，写 `notices/build-manifest.json`。
