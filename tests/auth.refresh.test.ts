import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma and metrics
vi.mock('../lib/prisma.ts', () => {
  return {
    default: {
      refreshToken: {
        create: vi.fn(),
        updateMany: vi.fn(),
        findUnique: vi.fn()
      },
      user: {
        findUnique: vi.fn()
      }
    }
  }
})

vi.mock('../lib/metrics.ts', () => ({
  incrementMetric: vi.fn(() => Promise.resolve()),
}))

import prisma from '../lib/prisma.ts'
import { incrementMetric } from '../lib/metrics.ts'
import {
  createRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken
} from '../lib/auth.ts'

describe('refresh token rotation & reuse detection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.REFRESH_REUSE_REVOKE_ALL = 'true'
  })

  it('createRefreshToken returns token and persists hashed token', async () => {
    // Arrange: mock create to resolve
    ;(prisma.refreshToken.create as any).mockResolvedValue({ id: 'rt1' })

    // Act
    const res = await createRefreshToken('user-123')

    // Assert
    expect(res).toHaveProperty('token')
    expect(res).toHaveProperty('expiresAt')
    expect(prisma.refreshToken.create).toHaveBeenCalled()
    const call = (prisma.refreshToken.create as any).mock.calls[0][0]
    expect(call.data.userId).toBe('user-123')
    expect(call.data.tokenHash).toBeDefined()
  })

  it('verifyRefreshToken returns null for missing record', async () => {
    (prisma.refreshToken.findUnique as any).mockResolvedValue(null)
    const res = await verifyRefreshToken('nonexistent')
    expect(res).toBeNull()
  })

  it('verifyRefreshToken revokes all and emits metrics on revoked token (reuse detection)', async () => {
    const fakeRecord = { revoked: true, userId: 'u1', expiresAt: new Date(Date.now() + 10000) }
    ;(prisma.refreshToken.findUnique as any).mockResolvedValue(fakeRecord)
    ;(prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 1 })

    const res = await verifyRefreshToken('some-token')
    expect(res).toBeNull()
    expect(incrementMetric).toHaveBeenCalled()
    // ensure revoke-all metric called with correct key
    const calledWithRevokeAll = (incrementMetric as any).mock.calls.some((c: any[]) => c[0] === 'refresh_token_revoke_all')
    expect(calledWithRevokeAll).toBe(true)
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled()
  })

  it('revokeRefreshToken marks token revoked', async () => {
    ;(prisma.refreshToken.updateMany as any).mockResolvedValue({ count: 1 })
    await revokeRefreshToken('token-to-revoke')
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled()
  })
})
