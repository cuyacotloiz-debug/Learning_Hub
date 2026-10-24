const TOKEN_KEY = 'lh_access_token'
const USER_KEY = 'lh_user'
const DEMO_KEY = 'lh_demo_store'

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function classroomCode() {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `LH-${token}`
}

function seedStore() {
  const teacher = {
    id: 'user_teacher',
    firstName: 'John',
    lastName: 'Doe',
    email: 'teacher@example.com',
    password: 'Password123!',
    role: 'TEACHER',
  }
  const student = {
    id: 'user_student',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'student@example.com',
    password: 'Password123!',
    role: 'STUDENT',
  }
  const extraStudents = [
    {
      id: 'user_alex',
      firstName: 'Alex',
      lastName: 'Rivera',
      email: 'alex@example.com',
      password: 'Password123!',
      role: 'STUDENT',
    },
    {
      id: 'user_sam',
      firstName: 'Sam',
      lastName: 'Chen',
      email: 'sam@example.com',
      password: 'Password123!',
      role: 'STUDENT',
    },
  ]
  const classrooms = [
    {
      id: 'cls_web',
      classroomId: 'LH-8K4P2X',
      name: 'Web Development Fundamentals',
      subject: 'Computer Science',
      description: 'Learn HTML, CSS, JavaScript and modern web development.',
      status: 'ACTIVE',
      teacherId: teacher.id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
    },
    {
      id: 'cls_mkt',
      classroomId: 'WEB-2026-84KD',
      name: 'Digital Marketing 101',
      subject: 'Marketing',
      description: 'Intro to digital marketing strategies.',
      status: 'ACTIVE',
      teacherId: teacher.id,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
    },
  ]
  return {
    users: [teacher, student, ...extraStudents],
    classrooms,
    enrollments: [
      { studentId: student.id, classroomId: classrooms[0].id },
      { studentId: extraStudents[0].id, classroomId: classrooms[0].id },
      { studentId: extraStudents[1].id, classroomId: classrooms[0].id },
      { studentId: extraStudents[0].id, classroomId: classrooms[1].id },
    ],
    messages: [
      {
        id: 'msg_web_1',
        classroomId: classrooms[0].id,
        body: 'Live session Friday at 3pm. Join with the link below.',
        meetingUrl: 'https://meet.google.com/demo-web-dev',
        createdAt: new Date().toISOString(),
      },
    ],
  }
}

function decorateClassroom(classroom, store, user) {
  const enrollments = store.enrollments.filter((row) => row.classroomId === classroom.id)
  const students = enrollments
    .map((row) => store.users.find((item) => item.id === row.studentId))
    .filter(Boolean)
    .map((item) => publicUser(item))
  const messages = (store.messages || [])
    .filter((row) => row.classroomId === classroom.id)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const enrolled = Boolean(user && enrollments.some((row) => row.studentId === user.id))
  const canReadMessages =
    enrolled || Boolean(user && user.role === 'TEACHER' && classroom.teacherId === user.id)
  return {
    ...classroom,
    students: canReadMessages ? students : [],
    messages: canReadMessages ? messages : [],
    enrollmentCount: students.length,
    enrolled,
  }
}

function loadStore() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) {
      const store = JSON.parse(raw)
      return migrateStore(store)
    }
  } catch {
    // ignore corrupt storage
  }
  const seeded = seedStore()
  saveStore(seeded)
  return seeded
}

function migrateStore(store) {
  const seeded = seedStore()
  store.users = store.users || []
  store.classrooms = store.classrooms || []
  store.enrollments = store.enrollments || []
  store.messages = store.messages || []
  for (const user of seeded.users) {
    if (!store.users.some((item) => item.email === user.email || item.id === user.id)) {
      store.users.push(user)
    }
  }
  for (const enrollment of seeded.enrollments) {
    const exists = store.enrollments.some(
      (row) => row.studentId === enrollment.studentId && row.classroomId === enrollment.classroomId,
    )
    if (!exists) store.enrollments.push(enrollment)
  }
  if (store.messages.length === 0 && seeded.messages.length) {
    store.messages.push(...seeded.messages)
  }
  saveStore(store)
  return store
}

function saveStore(store) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(store))
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setSession(user, accessToken) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken)
}

export function clearSession() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
}

function currentUser() {
  return getStoredUser()
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  }
}

function findClassroom(store, code) {
  return store.classrooms.find((item) => item.classroomId === code || item.id === code)
}

function demoHandle(method, path, body) {
  const store = loadStore()
  const user = currentUser()

  if (method === 'POST' && path === '/api/auth/register') {
    const { firstName, lastName, email, password, role } = body || {}
    if (!firstName || !lastName || !email || !password || password.length < 8) {
      throw new Error('Validation failed')
    }
    if (store.users.some((item) => item.email === email)) {
      throw new Error('Email already in use')
    }
    const created = { id: uid('user'), firstName, lastName, email, password, role }
    store.users.push(created)
    saveStore(store)
    const sessionUser = publicUser(created)
    setSession(sessionUser, uid('tok'))
    return { user: sessionUser, accessToken: uid('tok') }
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const found = store.users.find(
      (item) => item.email === body?.email && item.password === body?.password,
    )
    if (!found) throw new Error('Invalid credentials')
    const sessionUser = publicUser(found)
    setSession(sessionUser, uid('tok'))
    return { user: sessionUser, accessToken: uid('tok') }
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    clearSession()
    return { ok: true }
  }

  if (method === 'GET' && path === '/api/classrooms') {
    if (user?.role === 'TEACHER') {
      const classrooms = store.classrooms
        .filter((item) => item.teacherId === user.id)
        .map((item) => decorateClassroom(item, store, user))
      return { classrooms }
    }
    if (user?.role === 'STUDENT') {
      const classrooms = store.classrooms
        .filter((item) => item.status === 'ACTIVE')
        .map((item) => decorateClassroom(item, store, user))
      return { classrooms }
    }
    return {
      classrooms: store.classrooms
        .filter((item) => item.status === 'ACTIVE')
        .slice(0, 20)
        .map((item) => ({ ...item })),
    }
  }

  if (method === 'POST' && path === '/api/classrooms') {
    if (!user) throw new Error('Unauthorized')
    if (user.role !== 'TEACHER') throw new Error('Forbidden: teacher role required')
    const { name, subject, description } = body || {}
    if (!name || !subject) throw new Error('Validation failed')
    const classroom = {
      id: uid('cls'),
      classroomId: classroomCode(),
      name,
      subject,
      description: description || '',
      status: 'ACTIVE',
      teacherId: user.id,
      teacherName: `${user.firstName} ${user.lastName}`,
    }
    store.classrooms.unshift(classroom)
    saveStore(store)
    return { classroom: decorateClassroom(classroom, store, user) }
  }

  const joinMatch = path.match(/^\/api\/classrooms\/([^/]+)\/join$/)
  if (method === 'POST' && joinMatch) {
    if (!user) throw new Error('Unauthorized')
    if (user.role !== 'STUDENT') throw new Error('Only students may join classrooms')
    const code = decodeURIComponent(joinMatch[1])
    const classroom = findClassroom(store, code)
    if (!classroom) throw new Error('Classroom not found')
    const already = store.enrollments.some(
      (row) => row.studentId === user.id && row.classroomId === classroom.id,
    )
    if (already) throw new Error('Already enrolled')
    store.enrollments.push({ studentId: user.id, classroomId: classroom.id })
    saveStore(store)
    return { enrollment: { classroomId: classroom.id } }
  }

  const studentsMatch = path.match(/^\/api\/classrooms\/([^/]+)\/students$/)
  if (method === 'GET' && studentsMatch) {
    if (!user) throw new Error('Unauthorized')
    if (user.role !== 'TEACHER') throw new Error('Forbidden: teacher role required')
    const classroom = findClassroom(store, decodeURIComponent(studentsMatch[1]))
    if (!classroom) throw new Error('Classroom not found')
    if (classroom.teacherId !== user.id) throw new Error('Forbidden')
    return { students: decorateClassroom(classroom, store, user).students }
  }

  const messagesMatch = path.match(/^\/api\/classrooms\/([^/]+)\/messages$/)
  if (messagesMatch) {
    if (!user) throw new Error('Unauthorized')
    const classroom = findClassroom(store, decodeURIComponent(messagesMatch[1]))
    if (!classroom) throw new Error('Classroom not found')
    const isTeacher = user.role === 'TEACHER' && classroom.teacherId === user.id
    const isEnrolled = store.enrollments.some(
      (row) => row.studentId === user.id && row.classroomId === classroom.id,
    )
    if (!isTeacher && !isEnrolled) throw new Error('Forbidden')

    if (method === 'GET') {
      return { messages: decorateClassroom(classroom, store, user).messages }
    }
    if (method === 'POST') {
      if (!isTeacher) throw new Error('Forbidden: teacher role required')
      const text = String(body?.body || '').trim()
      if (!text) throw new Error('Validation failed')
      const message = {
        id: uid('msg'),
        classroomId: classroom.id,
        body: text,
        meetingUrl: body?.meetingUrl || '',
        createdAt: new Date().toISOString(),
      }
      store.messages.unshift(message)
      saveStore(store)
      return { message }
    }
  }

  throw new Error('Not found')
}

async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY)
  try {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      throw new Error('api unavailable')
    }
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Request failed')
    }
    return data
  } catch {
    return demoHandle(method, path, body)
  }
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  listClassrooms: () => request('/api/classrooms'),
  createClassroom: (body) => request('/api/classrooms', { method: 'POST', body }),
  joinClassroom: (classroomId) =>
    request(`/api/classrooms/${encodeURIComponent(classroomId)}/join`, { method: 'POST' }),
  listStudents: (classroomId) =>
    request(`/api/classrooms/${encodeURIComponent(classroomId)}/students`),
  listMessages: (classroomId) =>
    request(`/api/classrooms/${encodeURIComponent(classroomId)}/messages`),
  postMessage: (classroomId, body) =>
    request(`/api/classrooms/${encodeURIComponent(classroomId)}/messages`, { method: 'POST', body }),
}
