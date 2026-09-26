# 群组接口契约（前端要求）

> 统一约定：所有接口返回 `{"code": 200, "message": "ok", "data": <下面列的结构>}`
> 请求头带 `token: <登录返回的 token>`
> 前端 http.ts 自动解包：code===200 时拿到 data 内容，code!==200 时 message 直接弹给用户

---

## 一、Group 对象结构（核心）

前端 GET /api/groups、GET /api/groups/:id 期望的群对象（**建议后端按驼峰返回，前端转换层统一映射下划线**）：

```json
{
  "id": 1,
  "name": "项目讨论组",
  "avatar": "a1b2c3d4...",          // 群头像：文件 hash，空字符串则无头像；前端自动拼 /api/file/preview/{hash}
  "ownerId": 2,                      // 群主用户 id
  "notice": "群公告内容",
  "autoDelete": 0,                   // 自动删除秒数，0=关闭
  "muted": false,                    // 【当前登录用户】是否静音此群（个人设置，存 group_members 表，查群时按当前用户带出）
  "encrypted": false,                // 是否加密（明文模式恒 false 即可）
  "members": [
    {
      "id": 2,
      "username": "whx",
      "nickname": "王恒星",
      "avatar": "a1b2c3d4...",        // 成员头像：文件 hash 或空
      "role": "owner",                // 角色："owner" 群主 / "admin" 管理员 / "member" 成员
      "muted": false                  // 该成员是否被【群主】禁言（群里所有人可见的禁言状态）
    }
  ]
}
```

> 字段语义区分：
> - `group.muted`：**当前登录用户**对这个群的消息提醒开关（每个人不同，存 group_members 表）
> - `members[].muted`：**群主对某成员**的禁言状态（群维度，所有成员可见）
> - GET /api/groups 返回**当前登录用户加入的所有群**；GET /api/groups/:id 返回单个群详情（都要带当前用户的 muted）

前端字段映射（转换层做，你后端不用管）：
- ownerId → owner_id（群主判断：`group.owner_id === 当前用户id`）
- autoDelete → auto_delete
- members[].role === 'owner' → 前端显示"群主"标签（**role 必须用字符串 'owner'/'admin'/'member'**）

## 二、接口清单（前端调用点已写死，按这个路径实现即可）

### 1. GET /api/groups —— 群列表
- 返回 data: `[Group...]`（数组）

### 2. GET /api/groups/:id —— 群详情
- 返回 data: `Group`（单个对象，含 members 完整成员列表）

### 3. POST /api/groups —— 创建群
- body: `{"name": "群名", "member_ids": [3, 5, 7]}`（member_ids 是邀请的用户 id 数组，uint）
- 返回 data: `{"id": 1}`（新群 id，前端创建后跳转群聊页）

### 4. PUT /api/groups/:id —— 修改群信息（改名/公告/头像，三个字段都是可选）
- body: `{"name": "新群名"}` 或 `{"notice": "新公告"}` 或 `{"avatar": "文件hash"}`
- 返回 data: 任意（成功即可）

### 5. PUT /api/groups/:id/auto-delete —— 自动删除消息设置
- body: `{"auto_delete": 86400}`（秒数，0 关闭）
- 返回 data: 任意

### 6. PUT /api/groups/:id/encryption —— 加密开关（明文模式前端会调，返回成功即可）
- body: `{"encrypted": false}`
- 返回 data: 任意

### 7. POST /api/groups/:id/members —— 邀请成员进群
- body: `{"user_ids": [3, 5]}`（**注意：这个接口用 user_ids**，跟创建群用的 member_ids 字段名不同，前端已按此写死）
- 返回 data: 任意

### 8. POST /api/groups/:id/mute —— 群静音开关
- body: `{"muted": true}`
- 返回 data: 任意

### 9. POST /api/groups/:id/invite —— 生成邀请（二维码分享）
- body: `{"expires_days": 7}`
- 返回 data: `{"invite_id": "xxx"}`（invite_id 是字符串，前端拼 `paperphoneplus://invite/{invite_id}` 生成二维码）

### 10. POST /api/groups/:id/leave —— 退出群
- 无 body
- 返回 data: 任意

### 11. DELETE /api/groups/:id —— 解散群（仅群主）
- 无 body
- 返回 data: 任意

### 12. POST /api/groups/join/:inviteId —— 通过邀请链接/扫码加入
- 返回 data: `{"group_id": 1}`（加入的群 id，前端跳转群聊页）

---

## 三、数据表设计建议（参考）

```sql
-- 群组表
CREATE TABLE groups (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  name        VARCHAR(64)  NOT NULL,
  avatar      VARCHAR(128) DEFAULT '',        -- 文件 hash
  owner_id    BIGINT       NOT NULL,          -- 群主用户 id
  notice      VARCHAR(512) DEFAULT '',
  auto_delete INT          DEFAULT 0,         -- 秒数
  encrypted   TINYINT      DEFAULT 0,
  created_at  DATETIME,
  updated_at  DATETIME
);

-- 群成员表
CREATE TABLE group_members (
  id         BIGINT PRIMARY KEY AUTO_INCREMENT,
  group_id   BIGINT NOT NULL,
  user_id    BIGINT NOT NULL,
  role       VARCHAR(16) DEFAULT 'member',    -- owner / admin / member
  muted      TINYINT     DEFAULT 0,
  created_at DATETIME,
  UNIQUE KEY uk_group_user (group_id, user_id)
);

-- 群邀请表（可选）
CREATE TABLE group_invites (
  id          BIGINT PRIMARY KEY AUTO_INCREMENT,
  group_id    BIGINT      NOT NULL,
  invite_id   VARCHAR(64) NOT NULL UNIQUE,    -- 随机字符串
  expires_at  DATETIME    NOT NULL,
  created_by  BIGINT      NOT NULL
);
```

## 四、注意事项

1. **owner_id 判断**：前端用 `group.owner_id === user.id` 判断是否群主，解散/改名/公告等操作按钮只对群主显示
2. **role 字符串**：members[].role 必须是 'owner'/'admin'/'member'，前端只判断 `=== 'owner'`
3. **avatar 存 hash**：群头像和成员头像都存文件 hash（空字符串表示没有），前端 avatarUrl() 自动拼 /api/file/preview/{hash}
4. **创建群字段名注意**：创建群 body 用 `member_ids`，拉人进群 body 用 `user_ids`（前端已按此写死，别搞混）
5. **群聊消息**：前端群聊页会请求 `GET /api/messages/group/:groupId?limit=50000`，返回结构同好友消息（{data:{data:[Message...],size,total}}）——群聊功能启用时再做，现在前端不调用
