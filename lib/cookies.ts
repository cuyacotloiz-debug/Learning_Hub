export function parseCookies(cookieHeader?: string | null) {
  const list: Record<string, string> = {}
  if (!cookieHeader) return list
  cookieHeader.split(';').forEach(function (cookie) {
    const parts = cookie.split('=')
    const key = parts.shift()?.trim()
    if (!key) return
    const val = parts.join('=').trim()
    list[key] = decodeURIComponent(val)
  })
  return list
}

export function serializeCookie(name: string, val: string, options: { maxAge?: number, path?: string, httpOnly?: boolean, secure?: boolean, sameSite?: 'lax'|'strict'|'none' } = {}) {
  const opt = options || {}
  let str = `${name}=${encodeURIComponent(val)}`
  if (opt.maxAge) str += `; Max-Age=${opt.maxAge}`
  str += `; Path=${opt.path || '/'} `
  if (opt.httpOnly) str += `; HttpOnly`
  if (opt.secure) str += `; Secure`
  if (opt.sameSite) str += `; SameSite=${opt.sameSite}`
  return str
}
