const store = new Map<string, number[]>()

export function getIpKey(req: any) {
  const forwarded = req.headers?.['x-forwarded-for']
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown'
  return ip
}

export function checkRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now()
  const arr = store.get(key) || []
  // remove timestamps outside the window
  const filtered = arr.filter((t) => now - t < windowMs)
  filtered.push(now)
  store.set(key, filtered)
  return filtered.length <= limit
}

export function resetRateLimit(key: string) {
  store.delete(key)
}
