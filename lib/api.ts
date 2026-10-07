import { ZodSchema } from 'zod'
import { verifyToken } from './auth'

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
