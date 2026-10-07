import prisma from '../../../lib/prisma'
import { hashPassword, signAccessToken, createRefreshToken } from '../../../lib/auth'
import { registerSchema } from '../../../lib/validations'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'
import { serializeCookie } from '../../../lib/cookies'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Rate limit registrations per IP
    const ip = getIpKey(req)
    const { registerIp, registerEmail } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
    const allowed = await checkRateLimit(`register:${ip}`, registerIp.limit, registerIp.windowMs) // 5 per hour
    if (!allowed) return res.status(429).json({ error: 'Too many registration attempts, try later' })

    const parsed = registerSchema.parse(req.body)

    const { firstName, lastName, email, password, role } = parsed

    // Per-email registration rate limit to limit abuse of account creation
    const emailAllowed = await checkRateLimit(`register:email:${email}`, registerEmail.limit, registerEmail.windowMs) // 5 per hour per email
    if (!emailAllowed) return res.status(429).json({ error: 'Too many registration attempts for this email, try later' })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Email already in use' })

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { firstName, lastName, email, passwordHash, role },
    })

    const accessToken = signAccessToken({ userId: user.id, role: user.role })
    // create refresh token and set cookie
    const { token: refreshToken, expiresAt } = await createRefreshToken(user.id)
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    const cookie = serializeCookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })
    res.setHeader('Set-Cookie', cookie)

    return res.status(201).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, accessToken })
  } catch (err) {
    console.error('Register error', err)
    if (err?.issues) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}
