import prisma from '../../../../lib/prisma'
import { verifyAccessToken as verifyToken } from '../../../../lib/auth'
import { classroomMessageSchema } from '../../../../lib/validations'
import { getIpKey, checkRateLimit } from '../../../../lib/rateLimit'
import { z } from 'zod'
import { withMetrics } from '../../../../lib/api'

const paramsSchema = z.object({ id: z.string().min(1) })

async function handler(req: any, res: any) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const payload: any = token ? verifyToken(token) : null
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { id } = paramsSchema.parse(req.query || {})
    const classroom = await prisma.classroom.findUnique({ where: { classroomId: id } })
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })

    const isTeacher = payload.role === 'TEACHER' && classroom.teacherId === payload.userId
    let isEnrolled = false
    if (payload.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { studentId_classroomId: { studentId: payload.userId, classroomId: classroom.id } },
      })
      isEnrolled = Boolean(enrollment)
    }
    if (!isTeacher && !isEnrolled) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.method === 'GET') {
      const messages = await prisma.classroomMessage.findMany({
        where: { classroomId: classroom.id },
        orderBy: { createdAt: 'desc' },
      })
      return res.status(200).json({ messages })
    }

    if (req.method === 'POST') {
      if (!isTeacher) return res.status(403).json({ error: 'Forbidden: teacher role required' })
      const ip = getIpKey(req)
      const { classroomMessageIp } = await import('../../../../lib/rateConfig').then((m) => m.RATE_CONFIG)
      const allowed = await checkRateLimit(`classroom-message:${ip}`, classroomMessageIp.limit, classroomMessageIp.windowMs)
      if (!allowed) return res.status(429).json({ error: 'Too many requests' })

      const parsed = classroomMessageSchema.parse(req.body || {})
      const meetingUrl = parsed.meetingUrl ? parsed.meetingUrl : null
      const message = await prisma.classroomMessage.create({
        data: { classroomId: classroom.id, body: parsed.body, meetingUrl },
      })
      return res.status(201).json({ message })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Validation failed', details: err.issues })
    console.error('Classroom messages error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withMetrics('classroom_messages', handler)
