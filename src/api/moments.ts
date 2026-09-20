// 朋友圈接口适配层
// 后端结构：{id, ownerId, elements[{type,content,hash,url,...}], likeCount, visible, createdAt, nickname, avatar}
// 页面结构：{id, user_id, user{}, text_content, images[], videos[], created_at(ms), likes[], comments[]}
import { get, post, del } from './http'

/** 元素 URL：优先 url；否则用文件 hash 拼预览接口 */
const elementUrl = (el: any): string => el?.url || (el?.hash ? `/api/file/${el.hash}` : '')

/** 后端 elements[] → 页面用的文本/图片/视频 */
export function parseElements(elements: any[] | null | undefined) {
  const list = Array.isArray(elements) ? elements : []
  return {
    text: list.filter(e => e.type === 0).map(e => e.content || '').filter(Boolean).join('\n'),
    images: list.filter(e => e.type === 1).map(elementUrl).filter(Boolean),
    videos: list.filter(e => e.type === 2).map(e => ({ url: elementUrl(e), thumbnail: '', duration: 0 })),
  }
}

/** 页面的文本/图片/视频 → 后端 elements[] */
export function buildElements(input: { text?: string; images?: string[]; video?: { url?: string } | null }) {
  const elements: any[] = []
  if (input.text && input.text.trim()) elements.push({ type: 0, content: input.text.trim() })
  ;(input.images || []).filter(Boolean).forEach(url => elements.push({ type: 1, url }))
  if (input.video?.url) elements.push({ type: 2, url: input.video.url })
  return elements
}

/** 后端 visible 数字 ↔ 页面可见性字符串 */
const toVisibleLabel = (v: number) => ['public', 'friends', 'self', 'partial'][v] || 'public'
const toVisibleNumber = (label: string) =>
  ({ public: 0, whitelist: 3, blacklist: 1 } as Record<string, number>)[label] ?? 0

/** 后端 Moment → 页面结构 */
export function mapMoment(raw: any) {
  const { text, images, videos } = parseElements(raw?.elements)
  const ownerId = String(raw?.ownerId ?? '')
  return {
    id: String(raw?.id ?? ''),
    user_id: ownerId,
    user: { id: ownerId, nickname: raw?.nickname || '', avatar: raw?.avatar || '' },
    created_at: raw?.createdAt ? Date.parse(raw.createdAt) : Date.now(),
    text_content: text,
    images,
    videos,
    like_count: raw?.likeCount || 0,
    likes: [] as any[],
    comments: [] as any[],
    visibility: toVisibleLabel(raw?.visible ?? 0),
  }
}

/** 后端点赞记录 → 页面结构（页面按 like.id === user.id 判断是否本人已赞） */
export function mapLike(raw: any) {
  const uid = String(raw?.userId ?? '')
  return { id: uid, userId: uid, nickname: raw?.nickname || '', avatar: raw?.avatar || '' }
}

/** 后端评论 → 页面结构 */
export function mapComment(raw: any) {
  const { text } = parseElements(raw?.elements)
  return {
    id: String(raw?.id ?? ''),
    nickname: raw?.nickname || '',
    avatar: raw?.avatar || '',
    text_content: text,
    created_at: raw?.createdAt,
  }
}

/** 列表接口不返回点赞/评论，逐条补拉（保留页面的点赞头像墙与评论） */
async function attachInteractions(moment: any) {
  const [likes, comments] = await Promise.all([
    get<any[]>(`/api/moments/likes/${moment.id}`).catch(() => []),
    get<any[]>(`/api/moments/${moment.id}/comments`).catch(() => []),
  ])
  moment.likes = (likes || []).map(mapLike)
  moment.comments = (comments || []).map(mapComment)
  return moment
}

/** 朋友圈列表（自己 + 好友） */
export async function fetchMoments(): Promise<any[]> {
  const list = await get<any[]>('/api/moments/')
  const moments = (list || []).map(mapMoment)
  await Promise.all(moments.map(attachInteractions))
  return moments
}

/** 某个用户的朋友圈 */
export async function fetchUserMoments(userId: string | number, limit = 20): Promise<any[]> {
  const list = await get<any[]>(`/api/moments/user/${userId}?limit=${limit}`)
  return (list || []).map(mapMoment)
}

/** 发布朋友圈 */
export async function createMoment(input: {
  text?: string
  images?: string[]
  video?: { url?: string; thumbnail?: string; duration?: number } | null
  visibility?: string
}) {
  return post('/api/moments/', {
    elements: buildElements(input),
    visible: toVisibleNumber(input.visibility || 'public'),
  })
}

export const deleteMoment = (id: string | number) => del(`/api/moments/${id}`)

export const likeMoment = (id: string | number) => post(`/api/moments/likes/${id}`, {})
export const unlikeMoment = (id: string | number) => del(`/api/moments/likes/${id}`)

export const addMomentComment = (momentId: string | number, text: string) =>
  post(`/api/moments/${momentId}/comments`, { elements: [{ type: 0, content: text }] })

/** 屏蔽设置（后端无记录时 data 为 null） */
export async function fetchPrivacy(userId: string | number) {
  const data = await get<any>(`/api/moments/privacy/${userId}`).catch(() => null)
  return { hideTheir: !!data?.hideTheir, hideMine: !!data?.hideMine }
}

export const setPrivacy = (userId: string | number, p: { hideTheir: boolean; hideMine: boolean }) =>
  post(`/api/moments/privacy/${userId}`, {
    hideTheir: p.hideTheir ? 1 : 0,
    hideMine: p.hideMine ? 1 : 0,
  })
