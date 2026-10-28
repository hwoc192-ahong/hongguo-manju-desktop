#!/usr/bin/env bash
# 红果漫剧网页版 · 启动脚本
# 用法：
#   ./start-web.sh          前台启动（Ctrl+C 停止并保存数据）
#   ./start-web.sh -d       后台启动（日志见 --status）
#   ./start-web.sh --stop   停止后台实例
#   ./start-web.sh --status 查看运行状态
# 可用环境变量：HONGGUO_WEB_PORT（默认 8080）、HONGGUO_WEB_HOST（默认 127.0.0.1）、
#              HONGGUO_WEB_DATA（数据目录）、HONGGUO_RUNTIME（运行组件目录）
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

PORT="${HONGGUO_WEB_PORT:-18083}"
HOST="${HONGGUO_WEB_HOST:-127.0.0.1}"
STATE="$HOME/.local/state/hongguo-web"
PIDFILE="$STATE/server.pid"
LOGFILE="$STATE/server.log"
mkdir -p "$STATE"

alive() { [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }
address() { echo "http://$HOST$( [[ $PORT == 80 ]] && echo '' || echo ":$PORT" )/"; }

ensure_ready() {
  if [[ ! -d node_modules ]]; then echo "首次运行：安装依赖（npm ci）…"; npm ci --no-audit --no-fund; fi
  if [[ ! -f dist/web/server.cjs || ! -f dist/renderer/index.html || ! -f dist/renderer/web-shim.js ]]; then
    echo "首次运行：构建产物（npm run build:web）…"; npm run build:web
  fi
  if [[ ! -f runtime-bundle/classes/app/hongguo/runtime/SignerBridge.class ]]; then
    echo "提示：runtime-bundle 未准备，执行 npm run runtime:linux …"; npm run runtime:linux
  fi
  if [[ ! -f runtime-bundle/sdk/libmetasec_ml.so ]]; then
    echo "提示：未找到签名 SDK，榜单/详情/分享导入不可用（搜索与播放仍可用），详见 docs/web.md"
  fi
}

do_start_fg() {
  alive && { echo "已在后台运行（PID $(cat "$PIDFILE")）：$(address)"; exit 0; }
  ensure_ready
  echo "前台启动：$(address)（Ctrl+C 停止并保存数据）"
  exec node dist/web/server.cjs
}

do_start_daemon() {
  if alive; then echo "已在后台运行（PID $(cat "$PIDFILE")）：$(address)"; exit 0; fi
  ensure_ready
  HONGGUO_WEB_PORT="$PORT" HONGGUO_WEB_HOST="$HOST" nohup node dist/web/server.cjs >>"$LOGFILE" 2>&1 &
  echo $! >"$PIDFILE"
  for _ in $(seq 1 30); do
    sleep 0.5
    # 进程退出（如端口被占）立即报错；健康检查校验响应确实来自本服务。
    kill -0 "$(cat "$PIDFILE")" 2>/dev/null || { echo "进程启动失败，最近日志："; tail -20 "$LOGFILE"; rm -f "$PIDFILE"; exit 1; }
    if curl -sf "http://$HOST:$PORT/" 2>/dev/null | grep -q '红果漫剧'; then
      echo "后台启动成功：$(address)（PID $(cat "$PIDFILE")）"
      echo "停止：$0 --stop    日志：$LOGFILE"
      exit 0
    fi
  done
  echo "启动失败，最近日志："; tail -20 "$LOGFILE"; exit 1
}

do_stop() {
  if ! alive; then echo "没有正在运行的后台实例。"; rm -f "$PIDFILE"; exit 0; fi
  local pid; pid=$(cat "$PIDFILE")
  echo "正在停止（PID $pid）…"
  kill "$pid"
  for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
  rm -f "$PIDFILE"
  echo "已停止（数据已保存）。"
}

do_status() {
  if alive; then
    echo "运行中：$(address)（PID $(cat "$PIDFILE")）"
  else
    rm -f "$PIDFILE"; echo "未运行。"
  fi
  [[ -f "$LOGFILE" ]] && { echo "--- 最近日志 ---"; tail -5 "$LOGFILE"; } || true
}

case "${1:-start}" in
  start)    do_start_fg ;;
  -d|--daemon) do_start_daemon ;;
  --stop)   do_stop ;;
  --status) do_status ;;
  --restart) do_stop 2>/dev/null || true; do_start_daemon ;;
  -h|--help) grep '^#' "$0" | sed 's/^# \?//' ;;
  *) echo "未知参数：$1"; grep '^#' "$0" | sed 's/^# \?//'; exit 1 ;;
esac
