import { useEffect, useMemo, useState } from 'react'
import { api, clearSession, getStoredUser, setSession } from './api'
import './App.css'

const emptyAuth = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'STUDENT',
}

const emptyClassroom = {
  name: '',
  subject: '',
  description: '',
}

function App() {
  const [user, setUser] = useState(() => getStoredUser())
  const [mode, setMode] = useState('login')
  const [authForm, setAuthForm] = useState(emptyAuth)
  const [classroomForm, setClassroomForm] = useState(emptyClassroom)
  const [joinCode, setJoinCode] = useState('')
  const [classrooms, setClassrooms] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const greeting = useMemo(() => {
    if (!user) return ''
    return `${user.firstName} ${user.lastName}`
  }, [user])

  async function refreshClassrooms() {
    const data = await api.listClassrooms()
    setClassrooms(data.classrooms || [])
  }

  useEffect(() => {
    refreshClassrooms().catch(() => {})
  }, [user])

  function flash(kind, text) {
    setError(kind === 'error' ? text : '')
    setMessage(kind === 'ok' ? text : '')
  }

  async function handleAuth(event) {
    event.preventDefault()
    setBusy(true)
    flash('', '')
    try {
      const data =
        mode === 'login'
          ? await api.login({ email: authForm.email, password: authForm.password })
          : await api.register(authForm)
      setSession(data.user, data.accessToken)
      setUser(data.user)
      setAuthForm(emptyAuth)
      flash('ok', `Welcome back, ${data.user.firstName}.`)
    } catch (err) {
      flash('error', err.message || 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    try {
      await api.logout()
    } catch {
      // local session still needs to clear
    }
    clearSession()
    setUser(null)
    setMessage('')
    setError('')
  }

  async function handleCreate(event) {
    event.preventDefault()
    setBusy(true)
    flash('', '')
    try {
      const data = await api.createClassroom(classroomForm)
      setClassroomForm(emptyClassroom)
      await refreshClassrooms()
      flash('ok', `Classroom created: ${data.classroom.classroomId}`)
    } catch (err) {
      flash('error', err.message || 'Could not create classroom')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(event) {
    event.preventDefault()
    setBusy(true)
    flash('', '')
    try {
      await api.joinClassroom(joinCode.trim())
      setJoinCode('')
      await refreshClassrooms()
      flash('ok', 'You joined the classroom.')
    } catch (err) {
      flash('error', err.message || 'Could not join classroom')
    } finally {
      setBusy(false)
    }
  }

  function fillDemo(role) {
    setMode('login')
    setAuthForm({
      ...emptyAuth,
      email: role === 'TEACHER' ? 'teacher@example.com' : 'student@example.com',
      password: 'Password123!',
      role,
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            LH
          </span>
          <div>
            <strong>Learning HuB</strong>
            <p>Classrooms for teachers and students</p>
          </div>
        </div>
        {user ? (
          <div className="session">
            <span className="pill">{user.role.toLowerCase()}</span>
            <span>{greeting}</span>
            <button type="button" className="ghost" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        ) : (
          <p className="hint">Demo accounts ready to try</p>
        )}
      </header>

      {(error || message) && (
        <div className={`banner ${error ? 'error' : 'ok'}`} role="status">
          {error || message}
        </div>
      )}

      {!user ? (
        <main className="layout">
          <section className="hero-copy">
            <p className="eyebrow">Campus workspace</p>
            <h1>Run classes, share codes, and keep everyone in one place.</h1>
            <p>
              Teachers create classrooms with a join code. Students enroll and
              pick up from there. This UI talks to the Learning HuB API, and
              falls back to a local demo if the API is offline.
            </p>
            <ul className="bullets">
              <li>Create classrooms as a teacher</li>
              <li>Join with a classroom ID as a student</li>
              <li>Browse active rooms without an account</li>
            </ul>
          </section>

          <section className="panel">
            <div className="tabs">
              <button
                type="button"
                className={mode === 'login' ? 'active' : ''}
                onClick={() => setMode('login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'active' : ''}
                onClick={() => setMode('register')}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleAuth} className="form">
              {mode === 'register' && (
                <>
                  <label>
                    First name
                    <input
                      required
                      value={authForm.firstName}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, firstName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      required
                      value={authForm.lastName}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, lastName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Role
                    <select
                      value={authForm.role}
                      onChange={(e) =>
                        setAuthForm({ ...authForm, role: e.target.value })
                      }
                    >
                      <option value="STUDENT">Student</option>
                      <option value="TEACHER">Teacher</option>
                    </select>
                  </label>
                </>
              )}
              <label>
                Email
                <input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, password: e.target.value })
                  }
                />
              </label>
              <button type="submit" disabled={busy}>
                {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="demo-row">
              <button type="button" className="ghost" onClick={() => fillDemo('TEACHER')}>
                Use teacher demo
              </button>
              <button type="button" className="ghost" onClick={() => fillDemo('STUDENT')}>
                Use student demo
              </button>
            </div>
            <p className="fine">teacher@example.com / student@example.com · Password123!</p>
          </section>
        </main>
      ) : (
        <main className="dashboard">
          {user.role === 'TEACHER' ? (
            <section className="panel">
              <h2>Create a classroom</h2>
              <form onSubmit={handleCreate} className="form">
                <label>
                  Name
                  <input
                    required
                    value={classroomForm.name}
                    onChange={(e) =>
                      setClassroomForm({ ...classroomForm, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Subject
                  <input
                    required
                    value={classroomForm.subject}
                    onChange={(e) =>
                      setClassroomForm({ ...classroomForm, subject: e.target.value })
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    rows={3}
                    value={classroomForm.description}
                    onChange={(e) =>
                      setClassroomForm({
                        ...classroomForm,
                        description: e.target.value,
                      })
                    }
                  />
                </label>
                <button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Create classroom'}
                </button>
              </form>
            </section>
          ) : (
            <section className="panel">
              <h2>Join a classroom</h2>
              <form onSubmit={handleJoin} className="form">
                <label>
                  Classroom ID
                  <input
                    required
                    placeholder="LH-8K4P2X"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={busy}>
                  {busy ? 'Joining…' : 'Join classroom'}
                </button>
              </form>
            </section>
          )}

          <section className="rooms">
            <div className="rooms-head">
              <h2>{user.role === 'TEACHER' ? 'Your classrooms' : 'Classrooms'}</h2>
              <span>{classrooms.length} shown</span>
            </div>
            {classrooms.length === 0 ? (
              <p className="empty">No classrooms yet.</p>
            ) : (
              <ul className="cards">
                {classrooms.map((room) => (
                  <li key={room.id || room.classroomId} className="card">
                    <div className="card-top">
                      <span className="code">{room.classroomId}</span>
                      {room.enrolled && <span className="pill">enrolled</span>}
                    </div>
                    <h3>{room.name}</h3>
                    <p className="subject">{room.subject}</p>
                    {room.description && <p>{room.description}</p>}
                    {room.teacherName && (
                      <p className="fine">Taught by {room.teacherName}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      )}

      {!user && classrooms.length > 0 && (
        <section className="public-rooms">
          <h2>Active classrooms</h2>
          <ul className="cards">
            {classrooms.map((room) => (
              <li key={room.id || room.classroomId} className="card">
                <span className="code">{room.classroomId}</span>
                <h3>{room.name}</h3>
                <p className="subject">{room.subject}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export default App
