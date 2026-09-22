#!/usr/bin/env bash
# =============================================================================
#  一键启动脚本（朋友在自己服务器上执行这个就行）
#
#    ./start.sh              启动
#    ./start.sh stop         停止（数据保留）
#    ./start.sh status       看状态
#    ./start.sh logs         看日志
#
#  脚本会自动：加载镜像 -> 检查端口 -> 启动 -> 打印访问地址
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

info() { printf '\033[32m[OK]\033[0m %s\n' "$1"; }
warn() { printf '\033[33m[!!]\033[0m %s\n' "$1"; }
err()  { printf '\033[31m[XX]\033[0m %s\n' "$1" >&2; }

# ---------- 0. 读 .env ----------
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    info "已根据 .env.example 生成 .env"
  else
    err "找不到 .env 文件，请确认解压完整"
    exit 1
  fi
fi
# 只取 WEB_PORT 的值（忽略注释行）
WEB_PORT="$(grep -E '^[[:space:]]*WEB_PORT=' .env | tail -1 | cut -d= -f2- | tr -d '[:space:]')"
WEB_PORT="${WEB_PORT:-8081}"

ACTION="${1:-up}"

# ---------- 1. 环境检查 ----------
if ! command -v docker >/dev/null 2>&1; then
  err "没有安装 docker，请先安装：https://docs.docker.com/engine/install/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  err "docker 服务没运行，或者当前用户没有权限（试试 sudo ./start.sh，或把用户加入 docker 组）"
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  err "缺少 docker compose 插件（需要 Docker Engine 20.10+ 自带 compose v2）"
  exit 1
fi
info "docker 环境正常"

IMAGE_TAR="$(ls -1 images/*.tar 2>/dev/null | head -1 || true)"
case "$ACTION" in
  stop)
    docker compose down
    info "已停止（数据都还在，下次 ./start.sh 继续用）"
    exit 0
    ;;
  status)
    docker compose ps
    exit 0
    ;;
  logs)
    docker compose logs -f --tail=100
    exit 0
    ;;
esac

# ---------- 2. 加载离线镜像（如果有） ----------
NEED_IMAGES=0
for img in nginx:alpine mysql:8.0 redis:7-alpine im-backend:latest; do
  docker image inspect "$img" >/dev/null 2>&1 || NEED_IMAGES=1
done

if [ "$NEED_IMAGES" = "1" ] && [ -n "$IMAGE_TAR" ]; then
  info "正在导入离线镜像 $IMAGE_TAR（约 1~2 分钟）..."
  docker load -i "$IMAGE_TAR"
  info "镜像导入完成"
fi

MISSING=""
for img in nginx:alpine mysql:8.0 redis:7-alpine im-backend:latest; do
  docker image inspect "$img" >/dev/null 2>&1 || MISSING="$MISSING $img"
done
if [ -n "$MISSING" ]; then
  warn "本机缺少镜像：$MISSING"
  warn "外网可用的话 compose 会自己去拉取（国内服务器建议先在 /etc/docker/daemon.json 配镜像加速）"
fi

# ---------- 3. 端口占用检查 ----------
port_in_use() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}$"
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${p}$"
  elif command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1
  else
    (exec 3<>"/dev/tcp/127.0.0.1/${p}") >/dev/null 2>&1 && exec 3>&-
  fi
}

if port_in_use "$WEB_PORT"; then
  warn "端口 $WEB_PORT 已经被占用（可能是本机上别的程序）。"
  warn "换个端口：编辑 .env 里的 WEB_PORT，然后重新执行 ./start.sh"
  # 如果是我们自己这套已经在跑，就不拦
  if ! docker compose ps --services --filter status=running 2>/dev/null | grep -qx 'web'; then
    err "请先换一个端口再启动"
    exit 1
  else
    warn "检测到本套部署已在运行，继续执行（相当于重启/更新）"
  fi
fi

# ---------- 4. 启动 ----------
info "启动容器（首次启动 MySQL 初始化约需 20~60 秒）..."
docker compose up -d --remove-orphans

# ---------- 5. 等后端就绪 ----------
printf '等待后端就绪'
for i in $(seq 1 60); do
  # compose exec 按服务名找容器，不依赖固定容器名
  if docker compose exec -T backend sh -c 'wget -q -O /dev/null http://127.0.0.1:8080/redis' >/dev/null 2>&1; then
    printf '\n'
    info "后端已就绪"
    break
  fi
  printf '.'
  sleep 2
  if [ "$i" = "60" ]; then
    printf '\n'
    warn "后端还没起来，看日志排查：docker compose logs backend --tail=50"
  fi
done

# ---------- 6. 打印地址 ----------
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "${IP:-}" ] && IP="<服务器IP>"
echo
echo "================================================================"
echo "  部署完成，浏览器打开："
echo "     本机：  http://127.0.0.1:${WEB_PORT}"
echo "     局域网/公网： http://${IP}:${WEB_PORT}"
echo
echo "  注意：云服务器要在【安全组/防火墙】放行 ${WEB_PORT} 端口，否则外面打不开"
echo "  第一次使用：打开网页 -> 注册一个账号即可"
echo
echo "  常用命令："
echo "     ./start.sh logs     看日志"
echo "     ./start.sh stop     停止"
echo "     docker compose down -v   清空所有数据重来"
echo "================================================================"
