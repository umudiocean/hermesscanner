# HERMES Vercel Production Handoff - 2026-02-24

## Scope
- Repo: `d:/C/VWAPVERS2/hermes-scanner`
- Baseline commit reviewed: `69dc41b`
- Phase target: final production handoff packaging + deploy checklist execution prep

## Evidence Collected

### 1) Commit and memory alignment
- `.hermes-memory.json` reviewed.
- `next_priority` before this run matched Phase Next handoff target.
- Commit `69dc41b` diff reviewed, including:
  - `OPERATIONS_RUNBOOK.md`
  - `SECURITY_KEY_ROTATION_CHECKLIST.md`
  - `vercel.json`
  - resilience and observability hardening files

### 2) Local preflight
- Command: `npm run verify`
- Result: PASS
  - `type-check` PASS
  - `next build` PASS

### 3) Local smoke checks (`localhost:3000`)
- `POST /api/quotes/live` with browser UA and `{"symbols":["AAPL","MSFT"]}` -> `200`, `count=2`
- `GET /api/scan/latest` with browser UA -> `200`
- `GET /api/admin/stats` without auth -> `401` (expected)
- `GET /api/system/health` with browser UA -> `500`
  - Error signature captured from response payload:
  - `Cannot find module './1331.js'` under `.next/server/...`
  - Interpretation: local dev runtime artifact issue (stale/missing Next chunk), not compile failure

### 4) Local cleanup and smoke re-run (completed)
- Action: stop process on `3000` + remove `.next` + restart `npm run dev`
- Re-run smoke results:
  - `GET /api/system/health` -> `200`, `status=DEGRADED`
  - `POST /api/quotes/live` -> `200`, `count=2`
  - `GET /api/scan/latest` -> `200`
  - `GET /api/admin/stats` without auth -> `401` (expected)

## Deploy Readiness Assessment

- Code/build readiness: `READY`
- Runtime smoke readiness: `READY` (after clean local restart)
- Production deploy decision: ready for Vercel dashboard execution

## Required Pre-Deploy Action (Local)
Completed in this handoff run.

## Vercel Dashboard Execution Checklist

1. Confirm Production branch points to commit `69dc41b`.
2. Verify required env vars in Vercel Project Settings:
   - `FMP_API_KEY`, `CRON_SECRET`
   - Redis envs if `REQUIRE_REDIS=true`
   - Ops thresholds: `OPS_CACHE_ORIGIN_WARN_PCT`, `OPS_CACHE_ORIGIN_CRITICAL_PCT`
3. Trigger production deploy.
4. After deploy, run production smoke:
   - `/api/system/health` -> `status=OK|DEGRADED` (not DOWN/500)
   - `/api/scan/latest` -> `200`
   - `/api/quotes/live` (POST) -> `200`
5. Monitor first 15 minutes:
   - no `CRON_HEALTH_CHECK_FAILED`
   - no sustained `SLA_BREACH`
   - no repeated `PROVIDER_ERROR` spikes

## Post-Deploy Handoff Note
- If health endpoint still errors in production, rollback to previous stable deployment and inspect artifact/runtime mismatch.
- Key rotation process remains governed by `SECURITY_KEY_ROTATION_CHECKLIST.md`.
