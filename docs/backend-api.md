# 后端接口契约（前端要求）

> 前端 http.ts 的 api() 统一解包规则：
> - 所有接口返回 `{"code": 200, "message": "ok", "data": <实际数据>}`
> - `code === 200` → 前端拿到 `data` 字段内容（下面的"返回"都是指 data 的内容）
> - `code !== 200` → 前端抛错并 alert 显示 `message`
> - 请求头带 `token: <登录返回的 token>`（无鉴权阶段可不校验）
> - 401 时前端会自动调 `POST /api/auth/refresh`（body: `{refresh_token}`，data 返回 `{token, refresh_token}`）重试一次

✅ = 前端已适配跑通　⬜ = 待后端开发

---

## 一、认证 / 用户

| 方法 | 路径 | 返回 (data) | 状态 |
|---|---|---|---|
| POST | /api/user/register | `{id, username}`（body: {username, password, nickname}） | ✅ |
| POST | /api/user/login | `{id, username, token}`（body: {username, password}，token 必须） | ✅ |
| GET | /api/users/:id | 用户对象 `{id, username, nickname, avatar, is_online}` | ⬜ |
| GET | /api/user/users?search=关键字 | 用户数组 `[{id, username, nickname, avatar}]`（搜索用户用） | ⬜ |
| PUT | /api/users/password | 任意（body: {old_password, new_password}） | ⬜ |
| PUT | /api/users/avatar | 任意（FormData） | ⬜ |
| POST | /api/users/delete | 任意（body: {password}） | ⬜ |
| POST | /api/users/block | 任意（body: {user_id}） | ⬜ |
| DELETE | /api/users/block/:id | 任意 | ⬜ |

## 二、好友

| 方法 | 路径 | 返回 (data) | 状态 |
|---|---|---|---|
| GET | /api/friend/friends | 数组 `[{id, userId, friendId, status, remark}]`（前端取 friendId 当好友 id） | ✅ |
| GET | /api/friends | 数组 `[{id, username, nickname, avatar, is_online, auto_delete}]`（前端 store 的 Friend 结构，多个页面在用） | ⬜ |
| GET | /api/friends/requests | 申请数组（前端原样 setRequests） | ⬜ |
| POST | /api/friends/request | `{already_friends?: boolean}`（body: {friend_id, message}） | ⬜ |
| POST | /api/friends/accept | 任意（body: {friend_id}） | ⬜ |
| POST | /api/friends/auto-delete | 任意（body: {friend_id, auto_delete}） | ⬜ |
| PUT | /api/friends/remark | 任意（body: {friend_id, remark}） | ⬜ |
| POST | /api/tags/:tagId/assign | 任意（body: {friend_ids}） | ⬜ |
| POST | /api/tags/:tagId/unassign | 任意 | ⬜ |
| DELETE | /api/tags/:id | 任意 | ⬜ |

## 三、消息（核心）

| 方法 | 路径 | 返回 (data) | 状态 |
|---|---|---|---|
| GET | /api/messages/private/:friendId?limit=50&offset=0 | **直接返回后端 Message 数组**（前端转换层自动映射，字段见下） | ⬜ |
| GET | /api/messages/group/:groupId?limit=50&offset=0 | 同上（群聊，暂未启用） | ⬜ |
| POST | /api/upload | `{url, key}`（FormData file 字段；url 用于消息里图片/文件显示） | ⬜ |

Message 结构（前端已兼容，原样返回即可）：

```json
{
  "msgId": "820001012345678901234",
  "senderId": 2,
  "receiverId": 1,
  "elements": [{ "type": 0, "content": "你好" }],
  "status": 0,
  "createdAt": "2026-08-20T21:40:00+08:00"
}
```

- msgId 必须唯一（前端用它去重）；elements[0].type：0文本/1图片/2视频/3文件
- 分页参数：limit + offset；排序 created_at DESC（前端自己按时间升序排好显示）

## 四、群组（页面在，后端未启用）

| 方法 | 路径 | 返回 (data) |
|---|---|---|
| GET | /api/groups | 数组 `[{id, name, avatar, owner_id, notice, auto_delete, muted, encrypted, members}]` |
| GET | /api/groups/:id | 群详情（同 Group 结构） |
| POST | /api/groups | `{id}`（body: {name, member_ids}） |
| PUT | /api/groups/:id | 任意 |
| PUT | /api/groups/:id/auto-delete | 任意（body: {auto_delete}） |
| POST | /api/groups/:id/members | 任意 |
| POST | /api/groups/:id/mute | 任意 |
| POST | /api/groups/:id/invite | 任意（返回邀请链接/ID） |
| POST | /api/groups/:id/leave | 任意 |
| DELETE | /api/groups/:id | 任意 |
| POST | /api/groups/join/:inviteId | `{group_id}` |

## 五、朋友圈 Moments

| 方法 | 路径 | 返回 (data) |
|---|---|---|
| GET | /api/moments | 数组（元素：`{id, text_content, images: [url], videos: [], created_at}`） |
| POST | /api/moments | 任意（body: {text_content, images}） |
| POST | /api/moments/:id/like | 任意 |
| DELETE | /api/moments/:id/like | 任意 |
| DELETE | /api/moments/:id | 任意 |
| POST | /api/moments/:id/comments | 任意（body: {content}） |
| GET | /api/moments/privacy/:targetId | `{hide_their, hide_mine}` |
| POST | /api/moments/privacy | 任意（body: {target_id, hide_their, hide_mine}） |
| GET | /api/moments/user/:userId?limit=3 | 同 /api/moments 结构 |

## 六、时间线 Timeline

| 方法 | 路径 | 返回 (data) |
|---|---|---|
| GET | /api/timeline | 数组 `[{id, text_content, is_anonymous, images, videos, created_at}]` |
| POST | /api/timeline | 任意（body: {text_content, is_anonymous, images}） |
| GET | /api/timeline/:postId | 单条详情 |
| DELETE | /api/timeline/:postId | 任意 |
| POST | /api/timeline/:postId/like | 任意 |
| DELETE | /api/timeline/:postId/like | 任意 |
| POST | /api/timeline/:postId/comments | 任意 |

## 七、其他

| 方法 | 路径 | 返回 (data) |
|---|---|---|
| POST | /api/report | 任意（body: {target_type, target_id, reason, detail}） |
| GET | /api/totp/status | `{enabled: boolean}` |
| POST | /api/totp/setup | `{secret, uri, recovery_codes: []}` |
| POST | /api/totp/enable | 任意（body: {code}） |
| POST | /api/totp/disable | 任意（body: {code}） |
| GET | /api/sessions | 数组（元素含 id） |
| DELETE | /api/sessions/:id | 任意 |
| POST | /api/sessions/others/revoke | 任意 |
| GET | /api/stickers/packs | `{packs: []}` |
| GET | /api/stickers/pack/:name | 数组 |

推送相关（/api/push/*）为原项目 PWA/App 推送，Web 端可暂不实现，前端已容错。

---

## 开发优先级建议

1. GET /api/messages/private/:friendId（历史消息，聊天核心）
2. GET /api/users/:id、GET /api/user/users（用户资料/搜索）
3. GET /api/friends（多个页面共用）
4. 好友申请/接受（/api/friends/request、accept、requests）
5. POST /api/upload（图片消息）
6. 其余按页面需要补
