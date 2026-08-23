// 头像/图片 URL 统一转换：后端 avatar 字段存的是文件 hash，
// 显示时必须拼文件预览接口 GET /api/file/{hash}
export function avatarUrl(src?: string | null): string {
  if (!src) return ''
  // 完整 URL（http/https/data:）或已经是相对路径（/ 开头）→ 原样
  if (/^(https?:|data:|\/)/.test(src)) return src
  // 纯 hash → 拼预览接口
  return `/api/file/${src}`
}
