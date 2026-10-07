import { parseCookies, serializeCookie } from '../../../lib/cookies'
import { revokeRefreshToken, verifyRefreshToken } from '../../../lib/auth'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'
import { incrementMetric } from '../../../lib/metrics'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const start = Date.now()
  try { (incrementMetric as any)('auth_logout_requests').catch?.(() => {}) } catch {}

  try {
    // Rate limit logout per IP
    const ip = getIpKey(req)
    const { logoutIp, logoutUser } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
    const allowed = await checkRateLimit(`logout:${ip}`, logoutIp.limit, logoutIp.windowMs) // 30 per hour
    if (!allowed) {
      try { (incrementMetric as any)('auth_logout_429').catch?.(() => {}) } catch {}
      return res.status(429).json({ error: 'Too many requests' })
    }

    const cookies = parseCookies(req.headers.cookie)
    const refreshToken = cookies['refreshToken']
    if (refreshToken) {
      // Try to verify to get user id for per-user rate limiting; if verification fails, proceed with IP-only check
      try {
        const verified = await verifyRefreshToken(refreshToken)
        if (verified?.user) {
          const userAllowed = await checkRateLimit(`logout:user:${verified.user.id}`, logoutUser.limit, logoutUser.windowMs) // 30 per hour per user
          if (!userAllowed) {
            try { (incrementMetric as any)('auth_logout_429').catch?.(() => {}) } catch {}
            return res.status(429).json({ error: 'Too many logout attempts for this account, try later' })
          }
        }
      } catch (e) {
        // ignore verification errors and continue to revoke
      }

      await revokeRefreshToken(refreshToken)
    }
    // clear cookie
    const cookie = serializeCookie('refreshToken', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
    res.setHeader('Set-Cookie', cookie)
    try { (incrementMetric as any)('auth_logout_success').catch?.(() => {}) } catch {}
    try { (incrementMetric as any)('auth_logout_latency_ms', Date.now() - start).catch?.(() => {}) } catch {}
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Logout error', err)
    try { (incrementMetric as any)('auth_logout_error').catch?.(() => {}) } catch {}
    try { (incrementMetric as any)('auth_logout_latency_ms', Date.now() - start).catch?.(() => {}) } catch {}
    return res.status(500).json({ error: 'Internal server error' })
  }
}
