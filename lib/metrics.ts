const counters = new Map<string, number>()
let prom: any = null
let promInitialized = false
const promCounters: Map<string, any> = new Map()

async function initPromClient() {
  if (promInitialized) return prom
  promInitialized = true
  try {
    prom = (await import('prom-client')).default
    return prom
  } catch (e) {
    prom = null
    return null
  }
}

export async function incrementMetric(key: string, by = 1) {
  const cur = counters.get(key) || 0
  counters.set(key, cur + by)

  const p = await initPromClient()
  if (p) {
    try {
      let c = promCounters.get(key)
      if (!c) {
        c = new p.Counter({ name: `lh_${key}`, help: key })
        promCounters.set(key, c)
      }
      c.inc(by)
    } catch (e) {
      // ignore prom errors
    }
  }
}

export function getMetrics() {
  const obj: Record<string, number> = {}
  for (const [k, v] of counters.entries()) obj[k] = v
  return obj
}

export async function getPromMetrics() {
  const p = await initPromClient()
  if (!p) return null
  try {
    return await p.register.metrics()
  } catch (e) {
    return null
  }
}
