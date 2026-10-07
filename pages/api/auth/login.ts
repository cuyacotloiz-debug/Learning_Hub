import prisma from '../../../lib/prisma'
import { verifyPassword, signToken } from '../../../lib/auth'
import { loginSchema } from '../../../lib/validations'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Rate limit login attempts per IP
    const ip = getIpKey(req)
    const allowed = checkRateLimit(`login:${ip}`, 20, 60 * 60 * 1000) // 20 per hour
    if (!allowed) return res.status(429).json({ error: 'Too many login attempts, try later' })

    const parsed = loginSchema.parse(req.body)
    const { email, password } = parsed

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const ok = await verifyPassword(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken({ userId: user.id, role: user.role })
    return res.status(200).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, token })
  } catch (err) {
    console.error('Login error', err)
    if (err?.issues) return res.status(400).json({ error: 'Validation failed', details: err.issues })
    return res.status(500).json({ error: 'Internal server error' })
  }
}
