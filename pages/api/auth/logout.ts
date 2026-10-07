import { parseCookies, serializeCookie } from '../../../lib/cookies'
import { revokeRefreshToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const cookies = parseCookies(req.headers.cookie)
    const refreshToken = cookies['refreshToken']
    if (refreshToken) {
      await revokeRefreshToken(refreshToken)
    }
    // clear cookie
    const cookie = serializeCookie('refreshToken', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
    res.setHeader('Set-Cookie', cookie)
    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('Logout error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
