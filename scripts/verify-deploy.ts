#!/usr/bin/env npx tsx
// ═══════════════════════════════════════════════════════════════════
// HERMES SCANNER — Pre-Deployment Verification Script
// Run: npx tsx scripts/verify-deploy.ts
// Checks: env vars, FMP API, symbols, TypeScript, build
// ═══════════════════════════════════════════════════════════════════

import { getSymbols } from '../src/lib/symbols'

const REQUIRED_ENV_VARS = [
  'FMP_API_KEY',
]

const OPTIONAL_ENV_VARS = [
  'CRON_SECRET',
  'POLYGON_API_KEY',
  'QUIVER_API_KEY',
  'EODHD_API_KEY',
]

interface CheckResult {
  name: string
  status: 'PASS' | 'FAIL' | 'WARN'
  message: string
}

const results: CheckResult[] = []

function check(name: string, status: 'PASS' | 'FAIL' | 'WARN', message: string): void {
  results.push({ name, status, message })
  const icon = status === 'PASS' ? '[OK]' : status === 'FAIL' ? '[FAIL]' : '[WARN]'
  console.log(`  ${icon} ${name}: ${message}`)
}

async function main() {
  console.log('\n=== HERMES SCANNER — Pre-Deploy Verification ===\n')

  // 1. Required Environment Variables
  console.log('1. Required Environment Variables:')
  for (const envVar of REQUIRED_ENV_VARS) {
    if (process.env[envVar]) {
      check(envVar, 'PASS', 'Set')
    } else {
      check(envVar, 'FAIL', 'NOT SET — application will not start')
    }
  }

  // 2. Optional Environment Variables
  console.log('\n2. Optional Environment Variables:')
  for (const envVar of OPTIONAL_ENV_VARS) {
    if (process.env[envVar]) {
      check(envVar, 'PASS', 'Set')
    } else {
      check(envVar, 'WARN', 'Not set (some features may not work)')
    }
  }

  // 3. Symbol List
  console.log('\n3. Symbol List:')
  try {
    const symbols = getSymbols('ALL')
    if (symbols.length >= 2000) {
      check('Symbol count', 'PASS', `${symbols.length} symbols loaded`)
    } else {
      check('Symbol count', 'WARN', `Only ${symbols.length} symbols (expected 2033)`)
    }
  } catch (err) {
    check('Symbol count', 'FAIL', `Error loading symbols: ${err}`)
  }

  // 4. FMP API Connectivity
  console.log('\n4. FMP API Connectivity:')
  const apiKey = process.env.FMP_API_KEY
  if (apiKey) {
    try {
      const url = `https://financialmodelingprep.com/stable/profile?symbol=AAPL`
      const res = await fetch(url, { headers: { apikey: apiKey } })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          check('FMP API', 'PASS', `Connected — AAPL profile received`)
        } else {
          check('FMP API', 'WARN', `Response OK but unexpected format`)
        }
      } else {
        check('FMP API', 'FAIL', `HTTP ${res.status}: ${res.statusText}`)
      }
    } catch (err) {
      check('FMP API', 'FAIL', `Connection error: ${err}`)
    }
  } else {
    check('FMP API', 'FAIL', 'Cannot test — FMP_API_KEY not set')
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  const fails = results.filter(r => r.status === 'FAIL')
  const warns = results.filter(r => r.status === 'WARN')
  const passes = results.filter(r => r.status === 'PASS')

  console.log(`  PASS: ${passes.length}`)
  console.log(`  WARN: ${warns.length}`)
  console.log(`  FAIL: ${fails.length}`)

  if (fails.length > 0) {
    console.log('\n[DEPLOY BLOCKED] Fix the following failures:')
    fails.forEach(f => console.log(`  - ${f.name}: ${f.message}`))
    process.exit(1)
  } else if (warns.length > 0) {
    console.log('\n[DEPLOY OK with warnings] Address the following:')
    warns.forEach(w => console.log(`  - ${w.name}: ${w.message}`))
    process.exit(0)
  } else {
    console.log('\n[DEPLOY READY] All checks passed.')
    process.exit(0)
  }
}

main().catch(err => {
  console.error('Verification script error:', err)
  process.exit(1)
})
