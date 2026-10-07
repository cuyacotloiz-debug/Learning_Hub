import prisma from '../../../lib/prisma'
import { verifyPassword, signAccessToken, createRefreshToken } from '../../../lib/auth'
import { loginSchema } from '../../../lib/validations'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'
import { serializeCookie } from '../../../lib/cookies'
import { incrementMetric } from '../../../lib/metrics'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const start = Date.now()
  try { (incrementMetric as any)('auth_login_requests').catch?.(() => {}) } catch {}

  try {
    // Rate limit login attempts per IP
    const ip = getIpKey(req)
    const { loginIp, loginEmail } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
    const allowed = await checkRateLimit(`login:${ip}`, loginIp.limit, loginIp.windowMs)
    if (!allowed) {
      try { (incrementMetric as any)('auth_login_429').catch?.(() => {}) } catch {}
      return res.status(429).json({ error: 'Too many login attempts, try later' })
    }

    const parsed = loginSchema.parse(req.body)
    const { email, password } = parsed

    // Per-email rate limit to reduce account-targeted brute force without exposing user IDs
    const emailAllowed = await checkRateLimit(`login:email:${email}`, loginEmail.limit, loginEmail.windowMs)
    if (!emailAllowed) {
      try { (incrementMetric as any)('auth_login_429').catch?.(() => {}) } catch {}
      return res.status(429).json({ error: 'Too many login attempts for this account, try later' })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      try { (incrementMetric as any)('auth_login_failure').catch?.(() => {}) } catch {}
      try { (incrementMetric as any)('auth_login_latency_ms', Date.now() - start).catch?.(() => {}) } catch {}
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) {
      try { (incrementMetric as any)('auth_login_failure').catch?.(() => {}) } catch {}
      try { (incrementMetric as any)('auth_login_latency_ms', Date.now() - start).catch?.(() => {}) } catch {}
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const accessToken = signAccessToken({ userId: user.id, role: user.role })

    // create refresh token and set cookie
    const { token: refreshToken, expiresAt } = await createRefreshToken(user.id)
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    const cookie = serializeCookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })
    res.setHeader('Set-Cookie', cookie)

    try { (incrementMetric as any)('auth_login_success').catch?.(() => {}) } catch {}
    try { (incrementMetric as any)('auth_login_latency_ms', Date.now() - start).catch?.(() => {}) } catch {}
    return res.status(200).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, accessToken })
  } catch (err) {
    console.error('Login error', err)
    try { (incrementMetric as any)('auth_login_error').catch?.(() => {}) } catch {}
    try { (incrementMetric as any)('auth_login_latency_ms', Date.now() - start).catch?.(() => {}) } catch {}
    if (err?.issues) return res.status(400).json({ error: 'Validation failed', details: err.issues })
    return res.status(500).json({ error: 'Internal server error' })
  }
}
