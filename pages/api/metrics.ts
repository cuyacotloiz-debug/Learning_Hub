import { getMetrics } from '../../lib/metrics'

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const metrics = getMetrics()
  return res.status(200).json({ metrics })
}
