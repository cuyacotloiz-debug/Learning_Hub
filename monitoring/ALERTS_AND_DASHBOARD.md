Prometheus alert rules and Grafana dashboard guidance for Learning Hub

Prometheus rule examples (see prometheus-alerts.yml):
- HighRateLimit429: triggers when a single route sees >10 lh_rate_limit_429 hits in 5m.
- ExcessiveRefreshTokenReuse: triggers when more than 5 refresh reuse events occur in 5m.
- AnyRefreshTokenRevokeAll: critical alert when any global revoke-all event happens in 5m.
- RateLimitSpikeByEnv: environment-level spike detection.

Alertmanager routing suggestion:
- Route alerts with severity=critical to pager duty / on-call email with immediate escalation.
- Route severity=high to on-call but with longer dedup/notify intervals.
- Route severity=warning to a team Slack channel.

Grafana panels to include on a Learning Hub dashboard:
1) Rate Limit Overview
   - Type: Time series
   - Query: sum by (route) (rate(lh_rate_limit_429[5m]))
   - Visualization: stacked lines by route (pick top N routes)
   - Alert: HighRateLimit429 (as above)

2) Refresh Token Security
   - Type: Time series + single stat
   - Queries:
     - increase(lh_refresh_token_reuse[1m])
     - increase(lh_refresh_token_revoke_all[5m])
   - Show recent spikes and a single-stat count of revoke-all in last 24h.

3) HTTP Status Breakdown (for instrumented endpoints)
   - Type: table or bar chart
   - Query: sum by (job, route, status_code) (increase(lh_<endpoint>_status_2xx[5m]))
   - Note: withMetrics emits per-endpoint status counters (lh_<name>_status_<code>), convert these to a consistent label via Prometheus recording rules if needed.

4) Latency distribution (when histogram implemented)
   - Type: histogram or heatmap
   - Query: use Prometheus histogram metrics when withMetrics is converted to use prom-client Histograms for latency.

Operational notes:
- Avoid high-cardinality labels: do NOT attach user IDs, IP addresses, or long unique values as labels in Prometheus counters. Use coarse labels like "route" and "env".
- Retention & storage: keep high-resolution metrics for short-term (7-14 days) and downsample for longer retention.
- Alert tuning: adjust thresholds for your traffic profile; start with conservative thresholds and iterate.

How to deploy rules:
- If using Prometheus Operator (k8s), wrap prometheus-alerts.yml in a PrometheusRule CR and apply.
- For vanilla Prometheus, append the groups to your alerting rules file and reload Prometheus.

If you'd like, next steps I can take:
- Implement prom-client Histograms for latency in withMetrics and update instrumented endpoints to use them.
- Add a Grafana JSON dashboard (export) matching these panels.
- Wire an example Alertmanager config mapping severity labels to receivers.
