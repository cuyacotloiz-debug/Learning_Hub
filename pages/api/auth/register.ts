import prisma from '../../../lib/prisma'
import { hashPassword, signToken } from '../../../lib/auth'
import { registerSchema } from '../../../lib/validations'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Rate limit registrations per IP
    const ip = getIpKey(req)
    const allowed = checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000) // 5 per hour
    if (!allowed) return res.status(429).json({ error: 'Too many registration attempts, try later' })

    const parsed = registerSchema.parse(req.body)

    const { firstName, lastName, email, password, role } = parsed

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(409).json({ error: 'Email already in use' })

    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: { firstName, lastName, email, passwordHash, role },
    })

    const token = signToken({ userId: user.id, role: user.role })
    // Return basic user info and token
    return res.status(201).json({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, token })
  } catch (err) {
    console.error('Register error', err)
    if (err?.issues) {
      return res.status(400).json({ error: 'Validation failed', details: err.issues })
    }
    return res.status(500).json({ error: 'Internal server error' })
  }
}
