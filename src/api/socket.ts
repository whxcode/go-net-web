import { useStore } from '../store'

type MessageHandler = (data: any) => void | Promise<void>

let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let ready = false
let lastPongAt = 0
let reconnectAttempt = 0
const handlers = new Map<string, Set<MessageHandler>>()

function outboxKey() { return `pp_outbox:${useStore.getState().user?.id || 'unknown'}` }
function readOutbox(): any[] {
  try { return JSON.parse(localStorage.getItem(outboxKey()) || '[]') } catch { return [] }
}
function writeOutbox(items: any[]) { localStorage.setItem(outboxKey(), JSON.stringify(items.slice(-500))) }
function queueOutbound(data: any) {
  const items = readOutbox()
  if (!items.some(item => item.client_msg_id === data.client_msg_id)) {
    items.push(data); writeOutbox(items)
  }
}
function acknowledgeOutbound(clientMsgId?: string) {
  if (clientMsgId) writeOutbox(readOutbox().filter(item => item.client_msg_id !== clientMsgId))
}
function flushOutbox(socket: WebSocket) {
  for (const item of readOutbox()) socket.send(JSON.stringify(item))
}

/**
 * Sequential async event queue.
 *
 * Critical WS events (sender_key_distribution, message) share a single queue
 * so that a sender_key_distribution handler ALWAYS completes before any
 * subsequent message handler runs. Without this, the async
 * receiveSenderKey() inside the distribution handler yields at `await`,
 * and the message handler fires before the key is stored → 🔒.
 */
const SEQUENCED_TYPES = new Set(['sender_key_distribution', 'sender_key_invalidated', 'message'])
let _eventQueue: Promise<void> = Promise.resolve()

function enqueueSequenced(fn: () => Promise<void>) {
  _eventQueue = _eventQueue.then(fn, fn) // always chain, even on error
  return _eventQueue
}

// ── 后端明文协议 (Go) ──────────────────────────────────────────
// 服务端消息: {type:0, id, msgId, senderId, receiverId, elements:[{type:0|1|2|3, content, url, name, size, ...}], status, createdAt}
// 客户端心跳: {type:1} / 服务端心跳回复: {type:2}
const ELEMENT_TYPE_TO_MSG_TYPE: Record<number, string> = { 0: 'text', 1: 'image', 2: 'video', 3: 'file' }

export function convertServerMessage(m: any) {
  const el = Array.isArray(m.elements) ? m.elements[0] : null
  const elType = typeof el?.type === 'number' ? el.type : 0
  const msgType = ELEMENT_TYPE_TO_MSG_TYPE[elType] || 'text'
  const rawId = String(m.msgId || m.id || '')
  const ts = m.createdAt ? Date.parse(m.createdAt) || Date.now() : Date.now()
  return {
    // 后端推送若未携带 msgId/createdAt：用 发送者-接收者-时间 兜底，保证有 id 可去重
    id: rawId || `${m.senderId}-${m.receiverId}-${ts}`,
    from: String(m.senderId ?? ''),
    to: String(m.receiverId ?? ''),
    msg_type: msgType,
    // 明文内容：文本走 content，媒体走 url（图片/文件后续支持时用）
    decrypted: elType === 0 ? (el.content ?? '') : (el?.url ?? ''),
    url: el?.url ?? '',
    name: el?.name ?? '',
    size: el?.size ?? 0,
    width: el?.width ?? 0,
    height: el?.height ?? 0,
    hash: el?.hash ?? '',
    ts,
    delivery_status: 'sent',
  }
}

function getWsUrl(): string {
  const custom = import.meta.env.VITE_WS_URL
  if (custom) return custom

  const userId = useStore.getState().user?.id
  // 后端明文协议：/api/ws/im?userID=<id>，无鉴权
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/api/ws/im?userID=${encodeURIComponent(userId || '')}`
}

export function connectWs() {
  const token = useStore.getState().token
  if (!token || ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return

  const socket = new WebSocket(getWsUrl())
  ws = socket

  socket.onopen = () => {
    // 后端无鉴权，连接即就绪
    ready = true
    lastPongAt = Date.now()
    reconnectAttempt = 0
    useStore.getState().setWsConnected(true)
    flushOutbox(socket)
    heartbeatTimer = setInterval(() => {
      if (socket.readyState !== WebSocket.OPEN) return
      if (Date.now() - lastPongAt > 70000) {
        socket.close(4000, 'heartbeat timeout')
        return
      }
      // 心跳 type:1
      socket.send(JSON.stringify({ type: 1 }))
    }, 25000)
  }

  socket.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      const type = data?.type

      // 心跳回复 type:2
      if (type === 2) {
        lastPongAt = Date.now()
        return
      }

      // 普通消息 type:0 → 转成前端 ChatMessage 结构派发
      if (type === 0) {
        dispatchIncoming({ type: 'message', ...convertServerMessage(data) })
        return
      }

      // 其他未知类型忽略
    } catch { /* ignore parse errors */ }
  }

  socket.onclose = () => {
    if (ws !== socket) return
    ws = null
    ready = false
    useStore.getState().setWsConnected(false)
    cleanup()
    scheduleReconnect()
  }

  socket.onerror = () => {
    socket.close()
  }
}

export function dispatchIncoming(data: any): Promise<void> {
  const type = data?.type as string
  const dispatch = async () => {
    for (const h of handlers.get(type) || []) {
      try { await h(data) } catch (err) { console.error(`[WS] handler error for "${type}":`, err) }
    }
    for (const h of handlers.get('*') || []) {
      try { await h(data) } catch (err) { console.error('[WS] handler error for "*":', err) }
    }
  }
  if (SEQUENCED_TYPES.has(type)) return enqueueSequenced(dispatch)
  return dispatch()
}

export function disconnectWs() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  cleanup()
  ws?.close()
  ws = null
}

function cleanup() {
  if (heartbeatTimer) clearInterval(heartbeatTimer)
  heartbeatTimer = null
  ready = false
  useStore.getState().setWsConnected(false)
}

function scheduleReconnect() {
  if (reconnectTimer) return
  const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt++, 5))
  const jitter = Math.floor(Math.random() * 500)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectWs()
  }, delay + jitter)
}

export function forceReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = null
  reconnectAttempt = 0
  const old = ws
  ws = null
  cleanup()
  old?.close(4001, 'network changed')
  connectWs()
}

export function sendWs(data: any): boolean {
  // 后端 type 是 uint：字符串 type 会导致服务端 JSON 解析失败断开连接，直接丢弃
  if (data && typeof data.type === 'string') {
    console.warn('[WS] dropped non-numeric type message:', data.type)
    return false
  }
  if (data?.type === 'message') {
    data.client_msg_id ||= crypto.randomUUID()
    queueOutbound(data)
    if (!ready || ws?.readyState !== WebSocket.OPEN) return !!useStore.getState().token
  }
  if (ready && ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data))
    return true
  }
  return false
}

export function onWs(type: string, handler: MessageHandler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type)!.add(handler)
  return () => { handlers.get(type)?.delete(handler) }
}
