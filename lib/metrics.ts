const counters = new Map<string, number>()
let prom: any = null
let promInitialized = false
const promCounters: Map<string, any> = new Map()
const promHistograms: Map<string, any> = new Map()

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

// incrementMetric now accepts optional labels for Prometheus counters.
// Usage: incrementMetric('rate_limit_429', 1, { route: '/api/login' })
export async function incrementMetric(key: string, by = 1, labels?: Record<string, string>) {
  const cur = counters.get(key) || 0
  counters.set(key, cur + by)

  const p = await initPromClient()
  if (p) {
    try {
      let c = promCounters.get(key)
      if (!c) {
        const labelNames = labels ? Object.keys(labels) : []
        c = new p.Counter({ name: `lh_${key}`, help: key, labelNames })
        promCounters.set(key, c)
      }
      if (labels && Object.keys(labels).length > 0) {
        c.inc(labels, by)
      } else {
        c.inc(by)
      }
    } catch (e) {
      // ignore prom errors
    }
  }
}

// Observe a latency histogram (value provided in ms). The histogram is created with
// sensible buckets (seconds) and observed with value converted to seconds.
export async function observeHistogram(key: string, valueMs: number, labels?: Record<string, string>) {
  const p = await initPromClient()
  if (!p) return
  try {
    let h = promHistograms.get(key)
    if (!h) {
      // typical latency buckets in seconds
      const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
      const labelNames = labels ? Object.keys(labels) : []
      h = new p.Histogram({ name: `lh_${key}`, help: key, buckets, labelNames })
      promHistograms.set(key, h)
    }
    const valueSec = Math.max(0, valueMs) / 1000
    if (labels && Object.keys(labels).length > 0) {
      h.observe(labels, valueSec)
    } else {
      h.observe(valueSec)
    }
  } catch (e) {
    // ignore prom errors
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
