import 'ts-node/register'
import { withMetrics } from '../lib/api'
import { incrementMetric, getMetrics, getPromMetrics } from '../lib/metrics'
import { checkRateLimit } from '../lib/rateLimit'

function makeReq(method = 'GET', headers = {}) {
  return { method, headers }
}

function makeRes() {
  return {
    statusCode: 200,
    _body: null as any,
    status(code: number) { this.statusCode = code; return this },
    json(obj: any) { this._body = obj; return this },
    send(obj: any) { this._body = obj; return this }
  }
}

async function run() {
  // Simple in-memory enrollment tracker to simulate unique constraint
  const enrollments = new Set<string>()

  const loginHandler = withMetrics('auth_login', async (req: any, res: any) => {
    res.status(200).json({ ok: true })
  })

  const createHandler = withMetrics('classroom_create', async (req: any, res: any) => {
    const ip = '1.2.3.4'
    const allowed = await checkRateLimit(`create-test:${ip}`, 1, 60_000)
    if (!allowed) return res.status(429).json({ error: 'Too many requests' })
    res.status(201).json({ created: true })
  })

  const joinHandler = withMetrics('classroom_join', async (req: any, res: any) => {
    const student = req.headers['x-student-id'] || 'student1'
    const classroom = req.headers['x-classroom-id'] || 'classA'
    const key = `${student}:${classroom}`
    if (enrollments.has(key)) return res.status(409).json({ error: 'Already enrolled' })
    enrollments.add(key)
    res.status(201).json({ enrolled: true })
  })

  const refreshSim = async () => {
    await incrementMetric('refresh_token_reuse', 1, { reason: 'simulated', env: process.env.NODE_ENV || 'development' })
    await incrementMetric('refresh_token_revoke_all', 1, { reason: 'simulated', env: process.env.NODE_ENV || 'development' })
  }

  // Execute sequence
  console.log('Calling login...')
  await loginHandler(makeReq('POST'), makeRes())

  console.log('Calling create (1) - should succeed')
  await createHandler(makeReq('POST'), makeRes())
  console.log('Calling create (2) - should 429')
  await createHandler(makeReq('POST'), makeRes())

  console.log('Calling join (1) - should succeed')
  await joinHandler(makeReq('POST', { 'x-student-id': 's1', 'x-classroom-id': 'c1' }), makeRes())
  console.log('Calling join (2) - should 409')
  await joinHandler(makeReq('POST', { 'x-student-id': 's1', 'x-classroom-id': 'c1' }), makeRes())

  console.log('Simulating refresh reuse and revoke-all')
  await refreshSim()

  console.log('In-memory metrics:')
  console.log(JSON.stringify(getMetrics(), null, 2))

  try {
    const prom = await getPromMetrics()
    if (prom) {
      console.log('\nPrometheus exposition:\n')
      console.log(prom)
    } else {
      console.log('\nPrometheus client not available or failed to init')
    }
  } catch (e) {
    console.error('Error getting prom metrics', e)
  }
}

run().catch((e) => { console.error('Harness failed', e); process.exit(1) })
