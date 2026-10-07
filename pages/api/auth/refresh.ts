import { parseCookies, serializeCookie } from '../../../lib/cookies'
import { verifyRefreshToken, rotateRefreshToken, signAccessToken } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const cookies = parseCookies(req.headers.cookie)
    const refreshToken = cookies['refreshToken']
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' })

    const verified = await verifyRefreshToken(refreshToken)
    if (!verified) return res.status(401).json({ error: 'Invalid or expired refresh token' })

    const { user } = verified
    // rotate refresh token
    const { token: newRefreshToken, expiresAt } = await rotateRefreshToken(refreshToken, user.id)
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
    const cookie = serializeCookie('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge })
    res.setHeader('Set-Cookie', cookie)

    const accessToken = signAccessToken({ userId: user.id, role: user.role })
    return res.status(200).json({ accessToken })
  } catch (err) {
    console.error('Refresh error', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
