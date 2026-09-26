# 群模块前端契约（docs/群-api.md）

> 前端 im-go 已按此对接；后端 go-net 按此实现。
> 通用响应：`{code: 200, data, message}`，`code != 200` 为失败。

## 已有接口（后端已实现，前端适配中）

| 方法 | 路径 | body / 参数 | 返回 data |
|---|---|---|---|
| GET | /api/groups | - | `Group[]`（当前用户所在群，含 members） |
| GET | /api/groups/:id | - | `Group`（含 members） |
| PUT | /api/groups/:id | `Group` 部分字段（name/avatar/notice） | `Group` |
| POST | /api/groups/:id/members | `{memberIDs: number[]}` | `{code}` |
| PUT | /api/groups/:id/putMember | `{isMuted?, isNotifyDisabled?, status?, role?}` | `GroupMember` |

### Group 结构（后端返回，camelCase）

```json
{
  "id": 1,
  "ownerId": 2,
  "name": "群名",
  "avatar": "文件hash",
  "notice": "公告",
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": "2026-01-01T00:00:00Z",
  "encrypted": 0,
  "isMuted": 0,
  "members": [
    {
      "id": 10,
      "groupId": 1,
      "userId": 2,
      "role": 2,
      "joinedAt": "2026-01-01T00:00:00Z",
      "createdAt": "2026-01-01T00:00:00Z",
      "updatedAt": "2026-01-01T00:00:00Z",
      "isMuted": 0,
      "isNotifyDisabled": 0,
      "status": 0,
      "username": "whx",
      "nickname": "昵称",
      "avatar": "文件hash"
    }
  ]
}
```

- `members[].role`：0 成员 / 1 管理员 / 2 群主
- `members[].status`：0 正常 / 1 已退群（status=1 的记录不出现在列表/详情返回中）
- `avatar` 一律存文件 hash，前端显示时拼 `/api/file/preview/{hash}`

## 新增接口（后端待开发）

### POST /api/groups 创建群

```
POST /api/groups
token: <auth>
```

Body 请求参数：

```json
{
  "name": "我的群",
  "member_ids": [3, 5, 8]
}
```

| 名称 | 类型 | 必选 | 说明 |
|---|---|---|---|
| name | string | 是 | 群名称（1~64 字符） |
| member_ids | number[] | 否 | 初始成员用户 ID（从好友列表勾选） |

返回 data：

```json
{
  "id": 12
}
```

后端逻辑约定：
1. `ownerId` = 当前登录用户 ID（token 解析）
2. 建群后，群主 + 所有 member_ids 写入 `group_members`：
   - 群主：role=2
   - 其他成员：role=0
3. 群名空或超长 → 返回 code != 200 与 message

前端调用（Contacts.tsx 创建群弹窗）：
```ts
const res = await post<{ id: number }>('/api/groups', {
  name: '我的群',
  member_ids: [3, 5, 8],
})
```

## 本次不做（前后端都不做）

- 群聊消息（WS / messages）
- 邀请链接 / 二维码 / 加入群（POST :id/invite、POST /groups/join/:inviteId）
- 解散群（DELETE /api/groups/:id）
- 全员禁言（POST :id/mute）、自动清理（auto-delete）、加密开关
- 前端对应入口已隐藏/禁用
