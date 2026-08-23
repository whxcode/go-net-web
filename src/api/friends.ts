import { get } from './http'
import type { Friend } from '../store'

/**
 * 后端好友记录 → 前端 Friend 结构
 * 后端字段：{id(记录id), userId, friendId, username, nickname, avatar(hash), isOnline, remark, status, ...}
 */
export function mapFriend(item: any): Friend {
  return {
    id: String(item.friendId ?? item.userId ?? ''),
    record_id: String(item.id ?? ''),
    username: String(item.username ?? item.friendId ?? ''),
    nickname: item.nickname || String(item.friendId ?? ''),
    avatar: item.avatar || '',
    is_online: !!item.isOnline,
    auto_delete: 0,
    remark: item.remark || '',
  }
}

/** 获取好友列表（GET /api/friends/friends，后端只返回 status=1 的记录） */
export async function fetchFriends(): Promise<Friend[]> {
  const data = await get<any[]>('/api/friends/friends')
  return (Array.isArray(data) ? data : []).map(mapFriend)
}
