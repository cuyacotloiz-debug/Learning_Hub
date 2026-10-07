import { z } from 'zod'

export const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['TEACHER', 'STUDENT']),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createClassroomSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().optional(),
})

export const joinClassroomSchema = z.object({
  // expects body may be empty; we rely on path param for classroomId
  // but allow future options (e.g., joinCode)
  // keep minimal for now
})
