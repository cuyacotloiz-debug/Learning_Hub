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
    users: [teacher, student],
    classrooms,
    enrollments: [{ studentId: student.id, classroomId: classrooms[0].id }],
  }
}

function loadStore() {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore corrupt storage
  }
  const seeded = seedStore()
  saveStore(seeded)
  return seeded
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

function demoHandle(method, path, body) {
  const store = loadStore()
  const user = currentUser()

  if (method === 'POST' && path === '/api/auth/register') {
    const { firstName, lastName, email, password, role } = body || {}
    if (!firstName || !lastName || !email || !password || password.length < 8) {
      throw new Error('Validation failed')
    }
    if (store.users.some((u) => u.email === email)) {
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
      (u) => u.email === body?.email && u.password === body?.password,
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
      const classrooms = store.classrooms.filter((c) => c.teacherId === user.id)
      return { classrooms }
    }
    if (user?.role === 'STUDENT') {
      const enrolledIds = new Set(
        store.enrollments.filter((e) => e.studentId === user.id).map((e) => e.classroomId),
      )
      const classrooms = store.classrooms
        .filter((c) => enrolledIds.has(c.id) || c.status === 'ACTIVE')
        .map((c) => ({ ...c, enrolled: enrolledIds.has(c.id) }))
      return { classrooms }
    }
    return { classrooms: store.classrooms.filter((c) => c.status === 'ACTIVE').slice(0, 20) }
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
    return { classroom }
  }

  const joinMatch = path.match(/^\/api\/classrooms\/([^/]+)\/join$/)
  if (method === 'POST' && joinMatch) {
    if (!user) throw new Error('Unauthorized')
    if (user.role !== 'STUDENT') throw new Error('Only students may join classrooms')
    const code = decodeURIComponent(joinMatch[1])
    const classroom = store.classrooms.find((c) => c.classroomId === code)
    if (!classroom) throw new Error('Classroom not found')
    const already = store.enrollments.some(
      (e) => e.studentId === user.id && e.classroomId === classroom.id,
    )
    if (already) throw new Error('Already enrolled')
    store.enrollments.push({ studentId: user.id, classroomId: classroom.id })
    saveStore(store)
    return { enrollment: { classroomId: classroom.id } }
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
}
