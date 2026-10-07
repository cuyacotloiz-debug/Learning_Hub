const counters = new Map<string, number>()

export function incrementMetric(key: string, by = 1) {
  const cur = counters.get(key) || 0
  counters.set(key, cur + by)
}

export function getMetrics() {
  const obj: Record<string, number> = {}
  for (const [k, v] of counters.entries()) obj[k] = v
  return obj
}
