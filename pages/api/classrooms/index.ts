import prisma from '../../../lib/prisma'
import { verifyToken } from '../../../lib/auth'
import { createClassroomSchema } from '../../../lib/validations'
import { generateClassroomId } from '../../../lib/utils'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Authorization: Bearer <token>
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    const payload: any = token ? verifyToken(token) : null
    if (!payload || !payload.userId) return res.status(401).json({ error: 'Unauthorized' })

    // Only teachers may create classrooms
    if (payload.role !== 'TEACHER') return res.status(403).json({ error: "Forbidden: teacher role required" })

    try {
      const parsed = createClassroomSchema.parse(req.body)
      const { name, subject, description } = parsed

      // Rate limit classroom creation per IP
      const ip = getIpKey(req)
      const allowed = checkRateLimit(`create-classroom:${ip}`, 10, 60_000)
      if (!allowed) return res.status(429).json({ error: 'Too many requests' })

      // Attempt to create a classroom with a collision-resistant ID and retry on unique constraint
      let attempts = 0
      const maxAttempts = 5
      while (attempts < maxAttempts) {
        attempts++
        const classroomId = generateClassroomId('LH', 6)
        try {
          const created = await prisma.classroom.create({
            data: { classroomId, name, subject, description, teacherId: payload.userId },
          })
          return res.status(201).json({ classroom: created })
        } catch (err) {
          // Prisma unique constraint code is P2002
          if (err && err.code === 'P2002') {
            // collision, retry
            if (attempts >= maxAttempts) {
              return res.status(500).json({ error: 'Could not generate unique classroom ID, try again' })
            }
            continue
          }
          console.error('Create classroom error', err)
          return res.status(500).json({ error: 'Internal server error' })
        }
      }

    } catch (err) {
      console.error('Create classroom error', err)
      if (err?.issues) return res.status(400).json({ error: 'Validation failed', details: err.issues })
      // handle unique constraint collision by returning a 409
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // GET: list classrooms for current teacher (if auth) or public listing
  if (req.method === 'GET') {
    try {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      const payload: any = token ? verifyToken(token) : null
      if (payload && payload.userId && payload.role === 'TEACHER') {
        const classrooms = await prisma.classroom.findMany({ where: { teacherId: payload.userId } })
        return res.status(200).json({ classrooms })
      }

      // Public: list active classrooms (limited)
      const classrooms = await prisma.classroom.findMany({ where: { status: 'ACTIVE' }, take: 20 })
      return res.status(200).json({ classrooms })
    } catch (err) {
      console.error('List classrooms error', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
