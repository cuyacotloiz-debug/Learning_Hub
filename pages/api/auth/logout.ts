import { parseCookies, serializeCookie } from '../../../lib/cookies'
import { revokeRefreshToken } from '../../../lib/auth'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Rate limit logout per IP
    const ip = getIpKey(req)
    const allowed = await checkRateLimit(`logout:${ip}`, 30, 60 * 60 * 1000) // 30 per hour
    if (!allowed) return res.status(429).json({ error: 'Too many requests' })

    const cookies = parseCookies(req.headers.cookie)
    const refreshToken = cookies['refreshToken']
    if (refreshToken) {
      // Try to verify to get user id for per-user rate limiting; if verification fails, proceed with IP-only check
      try {
        const verified = await verifyRefreshToken(refreshToken)
        if (verified?.user) {
          const userAllowed = await checkRateLimit(`logout:user:${verified.user.id}`, 30, 60 * 60 * 1000) // 30 per hour per user
          if (!userAllowed) return res.status(429).json({ error: 'Too many logout attempts for this account, try later' })
        }
      } catch (e) {
        // ignore verification errors and continue to revoke
      }

      await revokeRefreshToken(refreshToken)
    }
    // clear cookie
    const cookie = serializeCookie('refreshToken', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
    res.setHeader('Set-Cookie', cookie)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Logout error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
