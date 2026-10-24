import 'ts-node/register'
import http from 'http'
import url from 'url'
import { withMetrics } from '../lib/api.ts'
import { getMetrics, getPromMetrics, incrementMetric } from '../lib/metrics.ts'
import { checkRateLimit } from '../lib/rateLimit.ts'

function makeReqObj(req: http.IncomingMessage) {
  return { method: req.method || 'GET', headers: req.headers }
}
function makeResObj(res: http.ServerResponse) {
  return {
    status(code: number) { res.statusCode = code; return this },
    json(obj: any) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)); return this },
    send(text: any) { res.end(String(text)); return this }
  }
}

const loginHandler = withMetrics('auth_login', async (req: any, res: any) => {
  // simulate auth success
  res.status(200).json({ ok: true })
})

const createHandler = withMetrics('classroom_create', async (req: any, res: any) => {
  const ip = '1.2.3.4'
  const allowed = await checkRateLimit(`create-test:${ip}`, 1, 60_000)
  if (!allowed) return res.status(429).json({ error: 'Too many requests' })
  res.status(201).json({ created: true })
})

const joinHandler = withMetrics('classroom_join', async (req: any, res: any) => {
  // simulate join
  res.status(201).json({ enrolled: true })
})

const refreshHandler = withMetrics('auth_refresh', async (req: any, res: any) => {
  // simulate reuse detection path
  await incrementMetric('refresh_token_reuse', 1, { reason: 'simulated_http', env: process.env.NODE_ENV || 'development' })
  res.status(200).json({ refreshed: true })
})

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url || '', true)
  const path = parsed.pathname || '/'
  const reqObj = makeReqObj(req)
  const resObj = makeResObj(res)

  try {
    if (path === '/login') return await loginHandler(reqObj, resObj)
    if (path === '/create') return await createHandler(reqObj, resObj)
    if (path === '/join') return await joinHandler(reqObj, resObj)
    if (path === '/simulate-refresh') return await refreshHandler(reqObj, resObj)
    if (path === '/metrics') {
      const prom = await getPromMetrics()
      if (prom) {
        res.setHeader('Content-Type', 'text/plain; version=0.0.4')
        res.end(prom)
      } else {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ metrics: getMetrics() }))
      }
      return
    }

    // default
    res.statusCode = 404
    res.end('Not found')
  } catch (e) {
    console.error('Server handler error', e)
    res.statusCode = 500
    res.end('Internal error')
  }
})

const PORT = process.env.OBS_HARNESS_PORT ? Number(process.env.OBS_HARNESS_PORT) : 9700
server.listen(PORT, () => console.log(`Observability server listening on http://localhost:${PORT}`))

// export for tests
export default server
