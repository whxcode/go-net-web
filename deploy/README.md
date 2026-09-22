# PaperPhonePlus 部署包

一个聊天应用（前端 + 后端 + 数据库），全部用 Docker 跑，**开箱即用，不需要装 Node/Go/MySQL**。

---

## 一、三步跑起来

```bash
# 1. 解压
tar -xf im-deploy.tar          # 如果拿到的是 .tar.gz 就用 tar -xzf

# 2. 进目录（可选：改端口，见第二节）
cd im-deploy

# 3. 一键启动
./start.sh
```

`start.sh` 会自动：导入离线镜像 → 检查端口是否被占 → 启动 4 个容器 → 等后端就绪 → 打印访问地址。

跑完直接浏览器打开：

```
http://服务器IP:8081
```

第一次进去点「注册」，自己建个账号就能用了。

> 什么都不用配。如果你只想要最快的结果，这一节看完就够了，下面是备查内容。

---

## 二、想换端口怎么做（唯一需要改的地方）

编辑 `.env` 这一个文件，只改第一行：

```ini
WEB_PORT=8081        # 改成你服务器上没被占用的端口，比如 9000 / 18081
```

然后重新执行：

```bash
docker compose up -d
```

完事，访问地址变成 `http://服务器IP:9000`。

**为什么改端口不用重新构建前端？**
前端页面里所有接口地址都是相对路径（`/api/xxx`），由 nginx 在同域下转发给后端，
所以端口、域名随便换，代码都不用动，也不需要重新打包。

**子路径不支持**：也就是 `http://IP:9000/im/` 这种带目录的地址不行，
只能类似 `http://IP:9000`（换个端口来区分），这一点要注意。

---

## 三、启动前确认这两件事

1. **云服务器要放行端口**
   阿里云/腾讯云等在控制台的安全组里放行 `WEB_PORT`（例如 8081），
   服务器本机的防火墙（ufw / firewalld）也要放行，否则外面打不开。

2. **服务器内存建议 1.5G 以上**
   MySQL 8 本身占用较大，1G 内存的小机器会跑得很吃力（可以调小 MySQL 缓冲，或换 2G 以上）。

---

## 四、常用命令

在 `im-deploy` 目录下执行：

```bash
./start.sh            # 启动（也可以直接 docker compose up -d）
./start.sh stop       # 停止，数据保留，下次再 ./start.sh 就恢复
./start.sh status     # 看 4 个容器是否都在跑
./start.sh logs       # 实时看日志（后端日志也在里面）
docker compose logs -f backend    # 只看后端
# 后端单独改代码重新编译：
#   docker compose build backend && docker compose up -d backend
# 改了 nginx 配置后重载：
#   docker compose restart web
docker compose down -v            # 【危险】连数据库和上传的文件一起删掉，彻底重来
```

---

## 五、目录说明

```
im-deploy/
├─ start.sh                 ← 一键启动脚本（你只跑这个）
├─ .env                     ← 唯一需要改的文件（端口、数据库密码）
├─ docker-compose.yml       ← 4 个服务的编排，里面注释写得很细
├─ README.md                ← 本文档
├─ nginx/
│   └─ default.conf         ← nginx 配置：静态托管 + /api 反代 + WebSocket
├─ web/                     ← 前端页面文件（已构建好，改前端就替换这里的内容）
├─ backend/
│   ├─ config.json          ← 后端配置：连数据库/Redis 的地址（服务名，别改）
│   ├─ init.sql             ← 建库建表脚本，MySQL 第一次启动时自动执行
│   └─ src/                 ← 后端源码（想重新编译后端时用，平时用不到）
└─ images/
    └─ im-deploy-images.tar ← 4 个镜像的离线包，start.sh 会自动导入
```

容器和端口的关系：

```
外面只开一个端口                Docker 内部私有网络（不占服务器端口）
浏览器 ──> web(nginx) :WEB_PORT ──> backend:8080 ──> mysql:3306
                                              └──> redis:6379
```

只有 nginx 对外开端口，**后端、MySQL、Redis 都不对外暴露**，
所以不会和你服务器上已有的 MySQL / Redis / 其它服务抢端口。

---

## 六、常见问题

**Q: `./start.sh` 提示端口被占用**
编辑 `.env` 换一个 `WEB_PORT`，再跑一次。脚本会告诉你是哪个端口冲突。

**Q: 页面打开了，但一直转圈 / 提示网络错误**
`docker compose logs -f backend --tail=80` 看后端报什么错。多数是 MySQL 还在初始化，
等 30 秒刷新即可。仍然不行就 `docker compose down -v` 重新初始化一次。

**Q: 上传图片/发文件失败**
如果换过 nginx 配置，注意 `client_max_body_size`（默认给的是 100m），
小于这个值的文件才允许上传。

**Q: 一定要 HTTPS 吗？**
浏览器地址栏是 `http://IP:端口` 时可以正常聊天，但下面这些功能会被浏览器禁止（安全策略，任何网站都一样）：
- 扫码登录 / 摄像头相关功能（需要安全上下文）
- 语音、视频通话
- 消息推送、桌面通知、加到桌面（PWA / Service Worker）

想让这些功能可用：绑个域名 + 证书走 `https://`。
最省事的做法是再起一个 Caddy（自动申请 Let's Encrypt 证书）反代到本机的 `WEB_PORT`，
或者用宝塔面板申请证书后反代。这一步需要域名，按需再做。

**Q: 想改数据库密码**
两处要同时改并保持一致：`.env` 的 `MYSQL_ROOT_PASSWORD` 和 `backend/config.json` 的 `database.password`。
注意密码是存在数据卷里的，改完必须 `docker compose down -v` 重新初始化才生效（数据会清空）。

**Q: 数据在哪？怎么备份？**
全部在 Docker 数据卷里：`mysql-data`（数据库）、`backend-files`（上传的文件）、`redis-data`。
备份：`docker run --rm -v im-deploy_mysql-data:/data -v $PWD:/backup alpine tar czf /backup/mysql-data.tar.gz /data`
（卷名前缀是你解压目录的名字，可以用 `docker volume ls` 确认）。

**Q: 完全没网能跑吗？**
能。镜像都打在包里了，`start.sh` 会自动 `docker load`，不联网也能起。
只有一种情况会联网：本机缺镜像且 `images/` 里没有，才会去 Docker Hub 拉取。

**Q: 后端想改代码重新编译**
`backend/src` 是完整源码。改完在 `im-deploy` 目录执行：
`docker compose build backend && docker compose up -d backend`
（这一步需要网络下载 Go 依赖，Dockerfile 里已经配了国内 goproxy 加速。）

**Q: 想彻底重置成刚拿到的样子**
`docker compose down -v`（删数据）→ 再 `./start.sh`。
