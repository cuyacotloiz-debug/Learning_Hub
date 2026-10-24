import prisma from '../../../../lib/prisma'
import { verifyAccessToken as verifyToken } from '../../../../lib/auth'
import { z } from 'zod'
import { getIpKey, checkRateLimit } from '../../../../lib/rateLimit'
import { withMetrics } from '../../../../lib/api'

const paramsSchema = z.object({ id: z.string().min(1) })

async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })


  // Auth (student)
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const payload: any = token ? verifyToken(token) : null
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (payload.role !== 'STUDENT') {
    return res.status(403).json({ error: 'Only students may join classrooms' })
  }

  // Rate limit joins per IP
  const ip = getIpKey(req)
  const { joinClassroomIp } = await import('../../../../lib/rateConfig').then(m => m.RATE_CONFIG)
  const allowed = await checkRateLimit(`join-classroom:${ip}`, joinClassroomIp.limit, joinClassroomIp.windowMs)
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // Validate path param
  try {
    const parsedParams = paramsSchema.parse(req.query || {})
    const classroomIdParam = parsedParams.id

    // Find classroom by human-readable classroomId
    const classroom = await prisma.classroom.findUnique({ where: { classroomId: classroomIdParam } })
    if (!classroom) {
      return res.status(404).json({ error: 'Classroom not found' })
    }

    // Prevent joining twice by relying on DB unique constraint + graceful handling
    try {
      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: payload.userId,
          classroomId: classroom.id,
        },
      })
      return res.status(201).json({ enrollment })
    } catch (err: any) {
      // Prisma unique constraint code is P2002
      const message = (err && err.code === 'P2002') ? 'Already enrolled' : 'Could not join classroom'
      const status = (err && err.code === 'P2002') ? 409 : 500
      return res.status(status).json({ error: message })
    }
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid params', details: err.issues })
    console.error('Join classroom error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withMetrics('classroom_join', handler)

