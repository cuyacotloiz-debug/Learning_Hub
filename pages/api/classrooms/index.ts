import prisma from '../../../lib/prisma'
import { verifyAccessToken as verifyToken } from '../../../lib/auth'
import { createClassroomSchema } from '../../../lib/validations'
import { generateClassroomId } from '../../../lib/utils'
import { getIpKey, checkRateLimit } from '../../../lib/rateLimit'
import { withMetrics } from '../../../lib/api'

async function handler(req: any, res: any) {
  if (req.method === 'POST') {
    // Authorization: Bearer <token>
    const auth = req.headers.authorization || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    const payload: any = token ? verifyToken(token) : null
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Only teachers may create classrooms
    if (payload.role !== 'TEACHER') {
      return res.status(403).json({ error: "Forbidden: teacher role required" })
    }

    try {
      const parsed = createClassroomSchema.parse(req.body)
      const { name, subject, description } = parsed

      // Rate limit classroom creation per IP
      const ip = getIpKey(req)
      const { createClassroomIp } = await import('../../../lib/rateConfig').then(m => m.RATE_CONFIG)
      const allowed = await checkRateLimit(`create-classroom:${ip}`, createClassroomIp.limit, createClassroomIp.windowMs)
      if (!allowed) {
        return res.status(429).json({ error: 'Too many requests' })
      }

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
        } catch (err: any) {
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

    } catch (err: any) {
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
        const classrooms = await prisma.classroom.findMany({
          where: { teacherId: payload.userId },
          include: {
            enrollments: {
              include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
            },
            messages: { orderBy: { createdAt: 'desc' } },
          },
        })
        return res.status(200).json({
          classrooms: classrooms.map((room) => ({
            ...room,
            students: room.enrollments.map((row) => ({ ...row.student, joinedAt: row.joinedAt })),
            enrollmentCount: room.enrollments.length,
          })),
        })
      }

      if (payload && payload.userId && payload.role === 'STUDENT') {
        const enrollments = await prisma.enrollment.findMany({
          where: { studentId: payload.userId },
          include: {
            classroom: { include: { messages: { orderBy: { createdAt: 'desc' } } } },
          },
        })
        const publicRooms = await prisma.classroom.findMany({ where: { status: 'ACTIVE' }, take: 20 })
        const byId = new Map(publicRooms.map((room) => [room.id, { ...room, enrolled: false, messages: [] }]))
        for (const row of enrollments) {
          byId.set(row.classroom.id, { ...row.classroom, enrolled: true })
        }
        return res.status(200).json({ classrooms: [...byId.values()] })
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

export default withMetrics('classroom_create', handler)
