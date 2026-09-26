// 时间线接口适配层
// 后端结构：{id, owner_id, elements[], like_count, status, created_at, updated_at, nickname, avatar}
// 页面结构：{id, user_id, user{}, text_content, media[], created_at(ms), likes[], comments[]}
import { get, post, del } from './http'

/** 元素 URL：优先 url；否则用文件 hash 拼预览接口 */
const elementUrl = (el: any): string => el?.url || (el?.hash ? `/api/file/preview/${el.hash}` : '')

/** 后端 elements[] → 页面用的文本/媒体（type: 0文本 1图片 2视频 3文件） */
export function parseElements(elements: any[] | null | undefined) {
  const list = Array.isArray(elements) ? elements : []
  return {
    text: list.filter(e => e.type === 0).map(e => e.content || '').filter(Boolean).join('\n'),
    media: list
      .filter(e => e.type === 1 || e.type === 2)
      .map(e => ({
        url: elementUrl(e),
        media_type: e.type === 1 ? 'image' : 'video',
        thumbnail: '',
        duration: 0,
      }))
      .filter((m: any) => m.url),
  }
}

/** 页面的文本/媒体 → 后端 elements[] */
export function buildElements(input: { text?: string; media?: any[] }) {
  const elements: any[] = []
  if (input.text && input.text.trim()) elements.push({ type: 0, content: input.text.trim() })
  ;(input.media || []).forEach(m => {
    if (!m?.url) return
    elements.push({ type: m.media_type === 'video' ? 2 : 1, url: m.url })
  })
  return elements
}

/** 后端 TimeLine → 页面结构 */
export function mapTimeline(raw: any) {
  const { text, media } = parseElements(raw?.elements)
  const ownerId = String(raw?.owner_id ?? '')
  return {
    id: String(raw?.id ?? ''),
    user_id: ownerId,
    user: { id: ownerId, nickname: raw?.nickname || '', avatar: raw?.avatar || '' },
    created_at: raw?.created_at ? Date.parse(raw.created_at) : Date.now(),
    text_content: text,
    media,
    like_count: raw?.like_count || 0,
    likes: [] as any[],
    comments: [] as any[],
  }
}

/** 后端点赞记录 → 页面结构（页面按 like.id === user.id 判断是否本人已赞） */
export function mapLike(raw: any) {
  const uid = String(raw?.owner_id ?? '')
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
    created_at: raw?.created_at,
  }
}

/** 列表接口不返回点赞/评论，逐条补拉 */
async function attachInteractions(post: any) {
  const [likes, comments] = await Promise.all([
    get<any[]>(`/api/timeline/${post.id}/likes`).catch(() => []),
    get<any[]>(`/api/timeline/${post.id}/comments`).catch(() => []),
  ])
  post.likes = (likes || []).map(mapLike)
  post.comments = (comments || []).map(mapComment)
  return post
}

/** 时间线列表（所有可见的） */
export async function fetchTimelines(): Promise<any[]> {
  const list = await get<any[]>('/api/timeline/')
  const posts = (list || []).map(mapTimeline)
  await Promise.all(posts.map(attachInteractions))
  return posts
}

/** 发布 */
export async function createTimeline(input: { text?: string; media?: any[] }) {
  return post('/api/timeline/', { elements: buildElements(input) })
}

export const deleteTimeline = (id: string | number) => del(`/api/timeline/${id}`, { status: 1 })

export const likeTimeline = (id: string | number) => post(`/api/timeline/${id}/likes`, {})
export const unlikeTimeline = (id: string | number) => del(`/api/timeline/${id}/likes`)

export const addTimelineComment = (postId: string | number, text: string) =>
  post(`/api/timeline/${postId}/comments`, { elements: [{ type: 0, content: text }] })
