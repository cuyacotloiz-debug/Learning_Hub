import crypto from 'crypto'
import { parseCookies } from './cookies'

export function createCsrfToken() {
  return crypto.randomBytes(24).toString('hex')
}

// Double-submit verification: expects a non-httpOnly cookie named 'csrfToken' and header 'x-csrf-token' with the same value
export function verifyDoubleSubmit(req: any) {
  const header = (req.headers && (req.headers['x-csrf-token'] || req.headers['X-CSRF-Token'])) || ''
  const cookies = parseCookies(req.headers?.cookie)
  const cookieVal = cookies['csrfToken'] || ''
  return Boolean(header && cookieVal && header === cookieVal)
}
