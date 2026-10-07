import { parseCookies, serializeCookie } from '../../../lib/cookies'
import { verifyRefreshToken, rotateRefreshToken, signAccessToken } from '../../../lib/auth'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'
import { withMetrics } from '../../../lib/api'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Rate limit refresh per IP
    const ip = getIpKey(req)
    const { refreshIp, refreshUser } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
    const allowed = await checkRateLimit(`refresh:${ip}`, refreshIp.limit, refreshIp.windowMs) // 60 per hour
    if (!allowed) return res.status(429).json({ error: 'Too many requests' })

    const cookies = parseCookies(req.headers.cookie)
    const refreshToken = cookies['refreshToken']
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' })

    const verified = await verifyRefreshToken(refreshToken)
    if (!verified) return res.status(401).json({ error: 'Invalid or expired refresh token' })

    const { user } = verified

    // Per-user refresh rate limit to limit token-exchange flooding
    const { refreshUser: cfgRefreshUser } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
    const userAllowed = await checkRateLimit(`refresh:user:${user.id}`, cfgRefreshUser.limit, cfgRefreshUser.windowMs) // 100 per hour per user
    if (!userAllowed) return res.status(429).json({ error: 'Too many token refreshes for this account, try later' })

    // rotate refresh token
    const { token: newRefreshToken, expiresAt } = await rotateRefreshToken(refreshToken, user.id)
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    const cookie = serializeCookie('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })
    res.setHeader('Set-Cookie', cookie)

    const accessToken = signAccessToken({ userId: user.id, role: user.role })
    return res.status(200).json({ accessToken })
  } catch (err) {
    console.error('Refresh error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withMetrics('auth_refresh', handler)
