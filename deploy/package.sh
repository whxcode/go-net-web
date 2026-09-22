#!/usr/bin/env bash
# =============================================================================
#  打包脚本（只在你自己这台机器上跑，朋友不需要）
#
#    cd /home/whx/study/im-go/deploy
#    ./package.sh                 # 默认：含离线镜像，约 300MB+，朋友无需外网
#    WITH_IMAGES=0 ./package.sh   # 精简包：约 10MB，朋友需能拉 Docker Hub 镜像
#    GZIP=1 ./package.sh          # 额外再出一份 .tar.gz
#    NO_BUILD=1 ./package.sh      # 跳过后端重新编译（复用已有 im-backend 镜像）
#
#  产物：/home/whx/study/im-go/im-deploy.tar
# =============================================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
IM_GO="$(cd "$DEPLOY_DIR/.." && pwd)"
GO_NET="$(cd "$IM_GO/../go-net" && pwd)"
STAGE_NAME="im-deploy"
BUILD_DIR="$IM_GO/build"
STAGE="$BUILD_DIR/$STAGE_NAME"
OUT_TAR="$IM_GO/$STAGE_NAME.tar"

WITH_IMAGES="${WITH_IMAGES:-1}"
GZIP_IT="${GZIP:-0}"
NO_BUILD="${NO_BUILD:-0}"

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
info() { printf '    %s\n' "$1"; }

# ---------- 0. 环境检查 ----------
command -v docker >/dev/null || { echo "缺少 docker"; exit 1; }
command -v pnpm   >/dev/null || { echo "缺少 pnpm";   exit 1; }
[ -d "$GO_NET" ]  || { echo "找不到后端目录 $GO_NET"; exit 1; }

# ---------- 1. 构建前端 ----------
step "构建前端 (pnpm build)"
cd "$IM_GO"
pnpm build
[ -f dist/index.html ] || { echo "前端构建产物缺失"; exit 1; }
info "dist 已生成: $(du -sh dist | cut -f1)"

# ---------- 2. 准备干净的输出目录 ----------
step "准备输出目录 $STAGE"
rm -rf "$STAGE"
mkdir -p "$STAGE"/{nginx,backend,web,images}

cp "$DEPLOY_DIR/docker-compose.yml" "$STAGE/docker-compose.yml"
cp "$DEPLOY_DIR/README.md"          "$STAGE/README.md"
cp "$DEPLOY_DIR/nginx/default.conf" "$STAGE/nginx/default.conf"
cp "$DEPLOY_DIR/backend/config.json" "$STAGE/backend/config.json"
# 数据库脚本：只带结构（init.sql），不带你本机的账号数据（朋友自己注册即可）
cp "$DEPLOY_DIR/backend/init.sql"   "$STAGE/backend/init.sql"
# 朋友那边的 .env（由 .env.example 生成，因为仓库里 .env 是被 git 忽略的）
cp "$DEPLOY_DIR/.env.example"       "$STAGE/.env"
cp "$DEPLOY_DIR/start.sh"           "$STAGE/start.sh"
chmod +x "$STAGE/start.sh"

# 前端静态文件：直接从 dist 同步（排除 sourcemap）
( cd "$IM_GO/dist" && tar cf - --exclude='*.map' . ) | ( cd "$STAGE/web" && tar xf - )
info "web/ = $(du -sh "$STAGE/web" | cut -f1)"

# ---------- 3. 后端源码（想重新编译时用，很小） ----------
step "复制后端源码到 backend/src"
mkdir -p "$STAGE/backend/src"
# 注意：logs/（日志库源码）和 docs/（swagger，被 http/index.go 引用）必须保留，
# 只有 log/（运行时输出）、tmp/、fileStoragePath/、.git/ 这些是垃圾
( cd "$GO_NET" && tar cf - \
    --exclude='./tmp' --exclude='./log' --exclude='./.git' \
    --exclude='./fileStoragePath' --exclude='dump.rdb' \
    --exclude='./.env' --exclude='./docker-compose.yml' \
    . ) | ( cd "$STAGE/backend/src" && tar xf - )
# 构建时排除运行时目录，避免把本机日志/上传文件打进镜像
cat > "$STAGE/backend/src/.dockerignore" <<'EOF'
.git
*.log
log
tmp
fileStoragePath
node_modules
EOF
info "backend/src = $(du -sh "$STAGE/backend/src" | cut -f1)"

# ---------- 4. 构建后端镜像 + 导出离线镜像 ----------
if [ "$WITH_IMAGES" = "1" ]; then
  if [ "$NO_BUILD" != "1" ]; then
    step "构建后端镜像 im-backend:latest"
    docker build -t im-backend:latest "$GO_NET"
  fi
  step "导出镜像到 images/（nginx + 后端 + MySQL + Redis）"
  for img in nginx:alpine mysql:8.0 redis:7-alpine; do
    docker image inspect "$img" >/dev/null 2>&1 || { info "本机没有 $img，先拉取..."; docker pull "$img"; }
  done
  docker save nginx:alpine im-backend:latest mysql:8.0 redis:7-alpine \
    -o "$STAGE/images/im-deploy-images.tar"
  info "镜像包 $(du -sh "$STAGE/images/im-deploy-images.tar" | cut -f1)"
else
  step "精简模式：不打包镜像"
  rmdir "$STAGE/images"
  info "朋友那边首次 docker compose up -d 会自动拉镜像 + 用 backend/src 编译后端"
fi

# ---------- 5. 打 tar ----------
step "打包 $OUT_TAR"
rm -f "$OUT_TAR"
# 不加压缩：镜像层本来就是压缩过的，gzip 收益很小
tar cf "$OUT_TAR" -C "$BUILD_DIR" "$STAGE_NAME"
info "完成：$OUT_TAR  ($(du -sh "$OUT_TAR" | cut -f1))"

if [ "$GZIP_IT" = "1" ]; then
  step "gzip 压缩"
  gzip -9 -c "$OUT_TAR" > "$OUT_TAR.gz"
  info "完成：$OUT_TAR.gz  ($(du -sh "$OUT_TAR.gz" | cut -f1))"
fi

cat <<EOF

============================================================
发给朋友的话，直接复制给他：

  1) 解压：  tar -xf $STAGE_NAME.tar && cd $STAGE_NAME
  2) 启动：  ./start.sh
  3) 浏览器打开 http://服务器IP:8081

  （想换端口：改 .env 里的 WEB_PORT，再 docker compose up -d）

包内容： $(du -sh "$STAGE" | cut -f1)
============================================================
EOF
