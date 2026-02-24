# HERMES API Key Rotation Checklist

This checklist is for production key rotation on Vercel without downtime.

## Scope

- `FMP_API_KEY`
- `POLYGON_API_KEY`
- `QUIVER_API_KEY`
- `EODHD_API_KEY`
- `CRON_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Rotation policy

- Critical keys (`CRON_SECRET`, Redis token): rotate every 30 days
- Market data keys: rotate every 60-90 days
- Emergency rotation: immediate after leak suspicion

## Pre-rotation

1. Create new key/token in provider dashboard.
2. Validate quota/plan for new key.
3. Confirm no hardcoded key in repo:
   - `rg "API_KEY|SECRET|TOKEN" src scripts`
4. Confirm staging can use new key.

## Vercel rollout steps

1. Add new keys to Vercel Project -> Environment Variables.
2. Keep old keys active during transition window.
3. Redeploy production.
4. Run smoke checks:
   - `/api/system/health` -> `status=OK|DEGRADED` (not DOWN)
   - `/api/scan/latest` returns data
   - `/api/quotes/live` returns quotes
5. Observe logs for 10-15 minutes:
   - no `AUTH` failures
   - no spike in `PROVIDER_ERROR`
6. Disable/revoke old keys.

## Post-rotation verification

- `CRON_HEALTH_CHECK` logs healthy
- no `CRON_STOCKS_REFRESH_FAILED`
- no sustained `SLA_BREACH`
- user-facing freshness badge mostly `FRESHNESS OK`

## Incident fallback

If new key fails:

1. Restore previous key in Vercel env.
2. Redeploy.
3. Confirm health endpoints recover.
4. Open provider support ticket if needed.

## Audit record template

Use this template after each rotation:

```text
Date:
Environment: production/preview
Keys rotated:
Operator:
Validation result:
Rollback needed: yes/no
Notes:
```
