import { incrementMetric, getMetrics } from './lib/metrics.ts'

async function run() {
  // Simulate endpoint events
  await incrementMetric('auth_login_requests')
  await incrementMetric('auth_login_success')
  await incrementMetric('auth_login_status_200')
  await incrementMetric('auth_login_status_2xx')
  await incrementMetric('classroom_create_requests', 2)
  await incrementMetric('classroom_create_success')
  await incrementMetric('classroom_create_status_201')
  await incrementMetric('rate_limit_429')

  // Simulate refresh reuse and revoke-all events
  await incrementMetric('refresh_token_reuse')
  await incrementMetric('refresh_token_revoke_all')

  console.log('Metrics after simulation:')
  console.log(JSON.stringify(getMetrics(), null, 2))
}

run().catch(e => { console.error(e); process.exit(1) })
