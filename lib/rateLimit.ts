const store = new Map<string, number[]>()
let redisClient: any = null
let redisInitializing = false

export function getIpKey(req: any) {
  const forwarded = req.headers?.['x-forwarded-for']
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown'
  return ip
}

async function initRedisIfNeeded() {
  if (!process.env.REDIS_URL) return null
  if (redisClient) return redisClient
  if (redisInitializing) {
    // wait until initialized
    while (redisInitializing && !redisClient) {
      await new Promise((r) => setTimeout(r, 50))
    }
    return redisClient
  }
  redisInitializing = true
  try {
    const IORedis = (await import('ioredis')).default
    redisClient = new IORedis(process.env.REDIS_URL)
    // optional: handle errors gracefully
    redisClient.on('error', (e: any) => console.warn('Redis client error', e))
    return redisClient
  } catch (e) {
    console.warn('Failed to initialize Redis for rate limiting, falling back to in-memory', e)
    redisClient = null
    return null
  } finally {
    redisInitializing = false
  }
}

// Returns boolean allowed
export async function checkRateLimit(key: string, limit = 10, windowMs = 60_000) {
  const redis = await initRedisIfNeeded()
  if (redis) {
    try {
      const redisKey = `rl:${key}`
      const windowSec = Math.max(1, Math.ceil(windowMs / 1000))
      const count = await redis.incr(redisKey)
      if (count === 1) {
        await redis.expire(redisKey, windowSec)
      }
      const allowed = count <= limit
      if (!allowed) console.warn(`Rate limit exceeded (redis): ${key}`)
      return allowed
    } catch (e) {
      console.warn('Redis rate limit check failed, falling back to memory', e)
      // fall through to memory
    }
  }

  const now = Date.now()
  const arr = store.get(key) || []
  // remove timestamps outside the window
  const filtered = arr.filter((t) => now - t < windowMs)
  filtered.push(now)
  store.set(key, filtered)
  const allowed = filtered.length <= limit
  if (!allowed) console.warn(`Rate limit exceeded (memory): ${key}`)
  return allowed
}

export async function resetRateLimit(key: string) {
  const redis = await initRedisIfNeeded()
  if (redis) {
    try {
      await redis.del(`rl:${key}`)
    } catch (e) {
      console.warn('Failed to reset redis rate limit', e)
    }
  }
  store.delete(key)
}
