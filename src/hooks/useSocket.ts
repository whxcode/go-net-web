import { useEffect } from 'react'
import { useStore } from '../store'
import { connectWs, disconnectWs, forceReconnect, onWs } from '../api/socket'
import { endSession } from '../utils/session'
import { useNotificationStore } from '../store/notificationStore'
import { playMessageSound, showBrowserNotification, getMessagePreview } from '../utils/notification'
import { decodeMessagePayload } from '../utils/messagePayload'

export function useSocket() {
  const token = useStore(s => s.token)

  useEffect(() => {
    if (!token) return

    connectWs()

    const recover = () => forceReconnect()
    const onVisible = () => { if (document.visibilityState === 'visible') recover() }
    window.addEventListener('online', recover)
    window.addEventListener('pageshow', recover)
    window.addEventListener('paperphone:network-changed', recover)
    document.addEventListener('visibilitychange', onVisible)
    let removeNativeListener: (() => void) | undefined
    import('@capacitor/app').then(({ App }) => App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) recover()
    })).then(handle => { removeNativeListener = () => void handle.remove() }).catch(() => {})

    // 明文协议：服务端消息已经由 socket.ts 转换层转成前端 ChatMessage 结构
    const unsubMsg = onWs('message', async (data) => {
      const myId = useStore.getState().user?.id
      const chatId = data.group_id || (data.from === myId ? data.to : data.from)
      if (!chatId) return

      // ── 明文回显合并：后端无 ack，发送者会收到自己消息的回显。
      // 将本地 queued 乐观消息替换为服务端正式消息（id 换成 msgId），避免重复显示
      if (!data.client_msg_id && data.from === myId && data.id && data.to) {
        const cached = useStore.getState().messages[chatId] || []
        const pending = cached.find(m => m.from === myId && m.delivery_status === 'queued')
        if (pending) {
          useStore.getState().updateMessage(chatId, pending.id, {
            id: data.id,
            ts: data.ts || pending.ts,
            delivery_status: 'sent',
          })
          return
        }
      }

      // 明文消息：直接入库（内容在 decrypted 字段）
      const isNewMessage = useStore.getState().addMessage(chatId, data)

      // 不在聊天页且非本人消息 → 未读 + 通知
      const isFromMe = data.from === myId
      const isOnChat = window.location.pathname.includes(chatId)

      if (isNewMessage && !isFromMe && !isOnChat) {
        useStore.getState().incrementUnread(chatId)

        // 离线补推消息不弹通知
        if (data.offline) return

        // 发送者信息
        const friends = useStore.getState().friends
        const friend = friends.find(f => f.id === data.from)
        const senderName = data.from_nickname || friend?.nickname || friend?.username || data.from || '?'
        const avatar = friend?.avatar

        // 消息预览
        let preview: string
        if (data.msg_type && data.msg_type !== 'text') {
          preview = getMessagePreview(data.msg_type, getI18nT())
        } else {
          const text = decodeMessagePayload(data.decrypted || data.ciphertext || '').body
          preview = text.length > 50 ? text.substring(0, 50) + '...' : text
        }

        // 应用内 toast
        useNotificationStore.getState().showToast({
          type: 'message',
          title: senderName,
          body: preview,
          avatar,
          chatId,
          isGroup: false,
        })

        // 提示音 + 浏览器通知（标签页隐藏时）
        playMessageSound()
        showBrowserNotification(
          senderName,
          preview,
          () => { window.location.href = `/chat/${chatId}` }
        )
      }
    })

    // 在线状态（后端若推送则更新，无则忽略）
    const unsubOnline = onWs('online', (data) => {
      if (data.user_id) useStore.getState().updateFriendOnline(data.user_id, true)
    })

    const unsubOffline = onWs('offline', (data) => {
      if (data.user_id) useStore.getState().updateFriendOnline(data.user_id, false)
    })

    return () => {
      unsubMsg()
      unsubOnline()
      unsubOffline()
      window.removeEventListener('online', recover)
      window.removeEventListener('pageshow', recover)
      window.removeEventListener('paperphone:network-changed', recover)
      document.removeEventListener('visibilitychange', onVisible)
      removeNativeListener?.()
      disconnectWs()
    }
  }, [token])
}

/**
 * Helper to get the i18n translation function outside of React components.
 * Falls back to English defaults.
 */
function getI18nT(): (key: string) => string {
  try {
    const lang = useStore.getState().lang || 'en'
    const fallbacks: Record<string, string> = {
      'notification.image': lang === 'zh' ? '[图片]' : '[Image]',
      'notification.voice': lang === 'zh' ? '[语音]' : '[Voice]',
      'notification.file': lang === 'zh' ? '[文件]' : '[File]',
      'notification.video': lang === 'zh' ? '[视频]' : '[Video]',
      'notification.sticker': lang === 'zh' ? '[表情]' : '[Sticker]',
    }
    return (key: string) => fallbacks[key] || key
  } catch {
    return (key: string) => key
  }
}
