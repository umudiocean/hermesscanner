# HERMES Operations Runbook

This runbook defines production alert codes and first response actions for Vercel + Redis runtime.

## Priority levels

- `P0` - critical outage or misleading data risk
- `P1` - degraded but serving
- `P2` - advisory / trend watch

## Alert codes

### Cron and self-heal

- `CRON_HEALTH_CHECK_FAILED` (`P0`)
  - Meaning: watchdog could not fetch health endpoint
  - Action:
    - check `/api/system/health`
    - check Vercel function failures/timeouts
    - verify `CRON_SECRET`

- `CRON_STOCKS_REFRESH_FAILED` (`P0`)
  - Meaning: scheduled stock refresh failed
  - Action:
    - run `/api/cron/refresh/stocks?force=1`
    - inspect `/api/cron` response mode and errors
    - verify Redis availability if `REQUIRE_REDIS=true`

- `CRON_SELF_HEAL_TRIGGERED` (`P1`)
  - Meaning: watchdog detected stale scan/quotes and started repair
  - Action:
    - monitor next 1-2 watchdog cycles

- `CRON_SELF_HEAL_OK` (`P2`)
  - Meaning: self-heal attempt succeeded
  - Action:
    - no immediate action; keep trend watch

- `CRON_SELF_HEAL_FAILED` (`P0`)
  - Meaning: self-heal attempt failed
  - Action:
    - trigger manual `force=1` refresh
    - inspect Redis + provider connectivity
    - check rate-limit pressure

### SLA and freshness

- `SLA_BREACH` (`P1` -> `P0` if persistent > 3 checks)
  - Meaning: one or more freshness thresholds breached
  - Action:
    - validate `scanAgeMin` and `stocksQuoteAgeMin` on `/api/system/health`
    - check cron schedule and run status
    - confirm provider latency and Redis health

- `SYSTEM_DEGRADED` (`P1`)
  - Meaning: health status moved away from `OK`
  - Action:
    - inspect health payload (`providers`, `sla`, `watchdog`, `sloTrend1h`)

- `PROVIDER_ERROR` (`P1`)
  - Meaning: upstream provider call failing/rate-limited
  - Action:
    - inspect provider `errorRate1h` and `http429Rate1h`
    - reduce refresh pressure if needed

## Toggle policy

- `REQUIRE_REDIS=true`
  - production recommended
  - fail-closed when Redis unavailable

- `REQUIRE_REDIS=false`
  - emergency fallback only
  - use temporarily during incident mitigation

## Ops threshold tuning

- `OPS_CACHE_ORIGIN_WARN_PCT` (default `25`)
  - alert state switches to `WARN` when origin ratio reaches this value
- `OPS_CACHE_ORIGIN_CRITICAL_PCT` (default `40`)
  - alert state switches to `CRITICAL` when origin ratio reaches this value

Recommended:
- start with `25/40`
- if origin ratio stays high under normal load, tune gradually (e.g. `30/45`)
- keep thresholds visible in Admin `Overview` and `System` cards

## Health checks to monitor

- `/api/system/health`
  - `status`
  - `sla.scanBreached`
  - `sla.stocksQuoteBreached`
  - `watchdog.lastRunAt`
  - `watchdog.lastSelfHealAt`
  - `sloTrend1h.totalChecks1h`
  - `sloTrend1h.breachCounts1h.scan`
  - `sloTrend1h.breachCounts1h.stocksQuote`

## Incident close checklist

- health status back to `OK`
- no active `scanBreached` / `stocksQuoteBreached`
- self-heal failure count stable
- user-facing freshness badges return to `FRESHNESS OK`

## Security key rotation

- Follow `SECURITY_KEY_ROTATION_CHECKLIST.md`
- Rotate `CRON_SECRET` and Redis token with higher frequency
