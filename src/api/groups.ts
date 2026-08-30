// src/api/groups.ts
// 后端群接口（camelCase）→ 前端 Group 结构
// 后端 Group: {id, ownerId, name, avatar(hash), notice, encrypted(0/1), isMuted(0/1), members:[...]}
// 后端 GroupMember: {id, groupId, userId, role(0/1/2), isMuted, isNotifyDisabled, status, username, nickname, avatar(hash)}
import { get } from './http'
import { useStore } from '../store'
import type { Group, GroupMember } from '../store'

function mapMember(item: any): GroupMember {
  return {
    id: String(item.userId ?? item.id ?? ''),
    username: item.username || '',
    nickname: item.nickname || '',
    avatar: item.avatar || '',
    role: Number(item.role ?? 0),
    muted: !!item.isMuted,
    status: Number(item.status ?? 0),
  }
}

/** 后端群记录 → 前端 Group 结构（muted = 当前用户在该群的免打扰状态） */
export function mapGroup(item: any, myUserId?: string): Group {
  const members: GroupMember[] = (Array.isArray(item.members) ? item.members : []).map(mapMember)
  const me = members.find((m) => m.id === String(myUserId ?? ''))
  return {
    id: String(item.id ?? ''),
    name: item.name || '',
    avatar: item.avatar || '',
    owner_id: String(item.ownerId ?? ''),
    notice: item.notice || '',
    muted: !!me?.muted,
    encrypted: !!item.encrypted,
    auto_delete: 0,
    members,
  }
}

/** 群列表 GET /api/groups */
export async function fetchGroups(): Promise<Group[]> {
  const data = await get<any[]>('/api/groups')
  const myId = useStore.getState().user?.id
  return (Array.isArray(data) ? data : []).map((g) => mapGroup(g, myId))
}

/** 群详情 GET /api/groups/:id */
export async function fetchGroup(id: string): Promise<Group | null> {
  const g = await get<any>(`/api/groups/${id}`)
  if (!g || typeof g !== 'object') return null
  return mapGroup(g, useStore.getState().user?.id)
}
