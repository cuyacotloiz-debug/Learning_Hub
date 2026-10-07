import { getPromMetrics, getMetrics } from '../../../lib/metrics'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const prom = await getPromMetrics()
  if (prom) {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4')
    return res.status(200).send(prom)
  }
  // fallback to JSON if prom-client not available
  const metrics = getMetrics()
  return res.status(200).json({ metrics })
}
