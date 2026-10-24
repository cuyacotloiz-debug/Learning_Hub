import prisma from '../../../../lib/prisma'
import { verifyAccessToken as verifyToken } from '../../../../lib/auth'
import { z } from 'zod'
import { withMetrics } from '../../../../lib/api'

const paramsSchema = z.object({ id: z.string().min(1) })

async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  const payload: any = token ? verifyToken(token) : null
  if (!payload || !payload.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  if (payload.role !== 'TEACHER') {
    return res.status(403).json({ error: 'Forbidden: teacher role required' })
  }

  try {
    const { id } = paramsSchema.parse(req.query || {})
    const classroom = await prisma.classroom.findUnique({ where: { classroomId: id } })
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })
    if (classroom.teacherId !== payload.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const enrollments = await prisma.enrollment.findMany({
      where: { classroomId: classroom.id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    })

    const students = enrollments.map((row) => ({
      ...row.student,
      joinedAt: row.joinedAt,
    }))
    return res.status(200).json({ students })
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Invalid params', details: err.issues })
    console.error('List classroom students error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withMetrics('classroom_students', handler)
