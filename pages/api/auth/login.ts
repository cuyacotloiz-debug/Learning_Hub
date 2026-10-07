import prisma from '../../../lib/prisma'
import { verifyPassword, signAccessToken, createRefreshToken } from '../../../lib/auth'
import { loginSchema } from '../../../lib/validations'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'
import { serializeCookie } from '../../../lib/cookies'
import { withMetrics } from '../../../lib/api'

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Rate limit login attempts per IP
    const ip = getIpKey(req)
    const { loginIp, loginEmail } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
    const allowed = await checkRateLimit(`login:${ip}`, loginIp.limit, loginIp.windowMs)
    if (!allowed) return res.status(429).json({ error: 'Too many login attempts, try later' })

    const parsed = loginSchema.parse(req.body)
    const { email, password } = parsed

    // Per-email rate limit to reduce account-targeted brute force without exposing user IDs
    const emailAllowed = await checkRateLimit(`login:email:${email}`, loginEmail.limit, loginEmail.windowMs)
    if (!emailAllowed) return res.status(429).json({ error: 'Too many login attempts for this account, try later' })

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const accessToken = signAccessToken({ userId: user.id, role: user.role })

    // create refresh token and set cookie
    const { token: refreshToken, expiresAt } = await createRefreshToken(user.id)
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    const cookie = serializeCookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })

    // Create a CSRF token for double-submit cookie pattern and set it as a non-HttpOnly cookie
    try {
      const { createCsrfToken } = await import('../../../lib/csrf')
      const csrf = createCsrfToken()
      const csrfCookie = serializeCookie('csrfToken', csrf, { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })
      res.setHeader('Set-Cookie', [cookie, csrfCookie])
    } catch (e) {
      // fallback to setting only refresh cookie if csrf helper fails
      res.setHeader('Set-Cookie', cookie)
    }

    return res.status(200).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, accessToken })
  } catch (err) {
    console.error('Login error', err)
    if (err?.issues) return res.status(400).json({ error: 'Validation failed', details: err.issues })
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withMetrics('auth_login', handler)
