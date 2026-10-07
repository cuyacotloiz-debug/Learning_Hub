import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from './prisma'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'
const ACCESS_TOKEN_EXPIRES_IN = '15m'
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_EXPIRES_DAYS || 30)

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signAccessToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN })
}

export function verifyAccessToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (err) {
    return null
  }
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createRefreshToken(userId: string) {
  const token = crypto.randomBytes(48).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000)
  await prisma.refreshToken.create({ data: { tokenHash, userId, expiresAt } })
  return { token, expiresAt }
}

export async function rotateRefreshToken(oldToken: string, userId: string) {
  const oldHash = hashToken(oldToken)
  // revoke old and create new
  await prisma.refreshToken.updateMany({ where: { tokenHash: oldHash, userId }, data: { revoked: true } })
  return createRefreshToken(userId)
}

export async function verifyRefreshToken(token: string) {
  const tokenHash = hashToken(token)
  const record = await prisma.refreshToken.findUnique({ where: { tokenHash } })
  if (!record) return null
  if (record.revoked) return null
  if (record.expiresAt < new Date()) return null
  const user = await prisma.user.findUnique({ where: { id: record.userId } })
  return { user, record }
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token)
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revoked: true } })
}

export async function getUserFromToken(token?: string) {
  if (!token) return null
  const data: any = verifyAccessToken(token)
  if (!data?.userId) return null
  const user = await prisma.user.findUnique({ where: { id: data.userId } })
  return user
}
