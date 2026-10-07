import pkg from '@prisma/client'
const { PrismaClient } = pkg
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const teacherEmail = 'teacher@example.com'
  const studentEmail = 'student@example.com'
  const password = 'Password123!'

  // Create teacher if not exists
  let teacher = await prisma.user.findUnique({ where: { email: teacherEmail } })
  if (!teacher) {
    const hashed = await bcrypt.hash(password, 10)
    teacher = await prisma.user.create({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        email: teacherEmail,
        passwordHash: hashed,
        role: 'TEACHER',
      },
    })
  }

  // Create or ensure two sample classrooms using upsert (run regardless of whether teacher existed)
  const classrooms = [
    {
      classroomId: 'LH-8K4P2X',
      name: 'Web Development Fundamentals',
      subject: 'Computer Science',
      description: 'Learn HTML, CSS, JavaScript and modern web development.',
    },
    {
      classroomId: 'WEB-2026-84KD',
      name: 'Digital Marketing 101',
      subject: 'Marketing',
      description: 'Intro to digital marketing strategies.',
    },
  ]

  for (const c of classrooms) {
    await prisma.classroom.upsert({
      where: { classroomId: c.classroomId },
      update: {},
      create: {
        classroomId: c.classroomId,
        name: c.name,
        subject: c.subject,
        description: c.description,
        teacherId: teacher.id,
      },
    })
  }

  // Create student if not exists
  let student = await prisma.user.findUnique({ where: { email: studentEmail } })
  if (!student) {
    const hashed = await bcrypt.hash(password, 10)
    student = await prisma.user.create({
      data: {
        firstName: 'Jane',
        lastName: 'Smith',
        email: studentEmail,
        passwordHash: hashed,
        role: 'STUDENT',
      },
    })
  }

  // Ensure the student is enrolled in the first classroom
  const classroom = await prisma.classroom.findUnique({ where: { classroomId: 'LH-8K4P2X' } })
  if (classroom && student) {
    try {
      await prisma.enrollment.create({
        data: {
          studentId: student.id,
          classroomId: classroom.id,
        },
      })
    } catch (err) {
      // Ignore unique constraint or other errors for idempotence
      console.warn('Enrollment creation skipped or failed (likely already exists):', err?.message ?? err)
    }
  }

  console.log('✅ Seed finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
