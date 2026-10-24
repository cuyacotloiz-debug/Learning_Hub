import { withMetrics } from './lib/api.ts'
import { getMetrics } from './lib/metrics.ts'

function makeRes() {
  return { statusCode: 200 }
}

async function run() {
  const okHandler = withMetrics('smoke_ok', async (req: any, res: any) => {
    res.statusCode = 200
    return { ok: true }
  })

  const createdHandler = withMetrics('smoke_created', async (req: any, res: any) => {
    res.statusCode = 201
    return { created: true }
  })

  const errorHandler = withMetrics('smoke_error', async (req: any, res: any) => {
    res.statusCode = 500
    throw new Error('simulated')
  })

  // Call handlers
  await okHandler({ method: 'GET' }, makeRes())
  await createdHandler({ method: 'POST' }, makeRes())
  try {
    await errorHandler({ method: 'POST' }, makeRes())
  } catch (e) {
    // expected
  }

  // call created again to have some counts
  await createdHandler({ method: 'POST' }, makeRes())

  console.log('Metrics snapshot:')
  console.log(JSON.stringify(getMetrics(), null, 2))
}

run().catch((e) => { console.error('Smoke test failed', e); process.exit(1) })
