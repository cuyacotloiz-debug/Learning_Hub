import type { ZodSchema } from 'zod'
import { verifyAccessToken as verifyToken } from './auth.ts'
import { incrementMetric, observeHistogram } from './metrics.ts'

export function withValidation(schema: ZodSchema, handler: (req: any, res: any, parsed: any) => Promise<any>) {
  return async function (req: any, res: any) {
    try {
      const parsed = schema.parse(req.body || {})
      return handler(req, res, parsed)
    } catch (err: any) {
      if (err?.issues) {
        return res.status(400).json({ error: 'Validation failed', details: err.issues })
      }
      console.error('Validation wrapper error', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export function withAuth(handler: (req: any, res: any, payload: any) => Promise<any>, options?: { roles?: string[] }) {
  return async function (req: any, res: any) {
    try {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
      const payload: any = token ? verifyToken(token) : null
      if (!payload || !payload.userId) return res.status(401).json({ error: 'Unauthorized' })
      if (options?.roles && !options.roles.includes(payload.role)) return res.status(403).json({ error: 'Forbidden' })
      return handler(req, res, payload)
    } catch (err) {
      console.error('Auth wrapper error', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

// Centralized instrumentation wrapper. Use to wrap handlers for automatic metrics collection.
export function withMetrics(name: string, handler: (req: any, res: any, ...args: any[]) => Promise<any>) {
  return async function (req: any, res: any, ...args: any[]) {
    const start = Date.now()
    try { incrementMetric(`${name}_requests`).catch?.(() => {}) } catch {}
    try {
      const result = await handler(req, res, ...args)
      try { incrementMetric(`${name}_success`).catch?.(() => {}) } catch {}
      // record status codes if available
      try {
        const status = res.statusCode || 200
        try { incrementMetric(`${name}_status_${status}`).catch?.(() => {}) } catch {}
        const cls = Math.floor(status / 100)
        try { incrementMetric(`${name}_status_${cls}xx`).catch?.(() => {}) } catch {}
      } catch (e) {
        // ignore
      }
      return result
    } catch (err) {
      try { incrementMetric(`${name}_error`).catch?.(() => {}) } catch {}
      try {
        const status = res.statusCode || 500
        try { incrementMetric(`${name}_status_${status}`).catch?.(() => {}) } catch {}
        const cls = Math.floor(status / 100)
        try { incrementMetric(`${name}_status_${cls}xx`).catch?.(() => {}) } catch {}
      } catch (e) {}
      throw err
    } finally {
      const durationMs = Date.now() - start
      try { incrementMetric(`${name}_latency_ms`, durationMs).catch?.(() => {}) } catch {}
      // observe a shared handler latency histogram with route label for per-endpoint percentiles
      try { observeHistogram('handler_latency_seconds', durationMs, { route: name, env: process.env.NODE_ENV || 'development' }).catch?.(() => {}) } catch {}
    }
  }
}
