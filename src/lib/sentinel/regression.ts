// HERMES_FIX: REGRESSION_HARNESS_v1 — Automated regression gate
// Blocks deploy if any critical behavior regresses.
// No mocks — uses fixtures for determinism, live endpoints for schema.

import { runSqueezeGuard, type SqueezeGuardInput } from '@/lib/crypto-terminal/squeeze-guard'
import fs from 'fs'
import path from 'path'

// ── Types ──

interface TestResult {
  name: string
  passed: boolean
  error?: string
  durationMs: number
}

type TestFn = () => Promise<void>

interface RegressionTest {
  name: string
  test: TestFn
}

// ── Fixture loader ──

function loadFixture<T>(filename: string): T {
  const fixturePath = path.join(process.cwd(), 'fixtures', 'sentinel', filename)
  const raw = fs.readFileSync(fixturePath, 'utf-8')
  return JSON.parse(raw) as T
}

// ── Signal matching (mirrors ModuleCryptoSignals logic) ──

type BestSignalType =
  | 'confluence_buy' | 'alpha_long' | 'hermes_long'
  | 'hermes_short' | 'alpha_short' | 'confluence_sell'

function matchSignal(
  teknikSignalType: string,
  fundamentalScore: number,
  riskLevel: string,
  overvalLevel?: string,
  chiLevel?: string,
): BestSignalType | null {
  if (teknikSignalType === 'strong_long' || teknikSignalType === 'long') {
    const aiLevel = fundamentalScore >= 80 ? 'STRONG' : fundamentalScore >= 60 ? 'GOOD' : fundamentalScore >= 40 ? 'NEUTRAL' : 'WEAK'
    const isHealthy = chiLevel === 'HEALTHY'
    const isNotOvervalued = overvalLevel === 'FAIR' || overvalLevel === 'UNDERVALUED'
    if ((aiLevel === 'STRONG' || aiLevel === 'GOOD') && riskLevel === 'LOW' && (isHealthy || isNotOvervalued)) return 'confluence_buy'
    if (aiLevel === 'STRONG' || (aiLevel === 'GOOD' && isHealthy)) return 'alpha_long'
    if (aiLevel === 'GOOD' || aiLevel === 'NEUTRAL') return 'hermes_long'
  }
  if (teknikSignalType === 'strong_short' || teknikSignalType === 'short') {
    const aiLevel = fundamentalScore >= 40 ? 'NEUTRAL' : fundamentalScore >= 20 ? 'WEAK' : 'BAD'
    const isOvervalued = overvalLevel === 'EXTREME' || overvalLevel === 'HIGH'
    const isUnhealthy = chiLevel === 'RISKY' || chiLevel === 'CRITICAL'
    if ((aiLevel === 'BAD' || aiLevel === 'WEAK') && riskLevel === 'HIGH' && (isOvervalued || isUnhealthy)) return 'confluence_sell'
    if (aiLevel === 'BAD' || (aiLevel === 'WEAK' && isOvervalued)) return 'alpha_short'
    if (aiLevel === 'WEAK' || aiLevel === 'NEUTRAL') return 'hermes_short'
  }
  return null
}

// ── Test definitions ──

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

function buildEndpointSchemaTests(): RegressionTest[] {
  const endpoints: Array<{ name: string; path: string; requiredFields: string[] }> = [
    {
      name: 'health_endpoint_schema',
      path: '/api/system/health',
      requiredFields: ['status', 'timestamp', 'providers', 'cache', 'dataFreshness', 'guards', 'sla'],
    },
  ]

  return endpoints.map(ep => ({
    name: ep.name,
    test: async () => {
      const res = await fetch(`${BASE_URL}${ep.path}`, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`${ep.path} returned ${res.status}`)
      const data = await res.json()
      for (const field of ep.requiredFields) {
        if (!(field in data)) {
          throw new Error(`Schema: missing field "${field}" in ${ep.path}`)
        }
      }
    },
  }))
}

function buildIPProtectionTests(): RegressionTest[] {
  const FORBIDDEN_IN_HEALTH = ['weight', 'formula', 'zscore', 'vwap', 'sigmoid', 'tanh']

  return [
    {
      name: 'no_formula_params_in_health',
      test: async () => {
        const res = await fetch(`${BASE_URL}/api/system/health`, { signal: AbortSignal.timeout(10000) })
        const text = await res.text()
        const lower = text.toLowerCase()
        for (const term of FORBIDDEN_IN_HEALTH) {
          if (lower.includes(term)) {
            throw new Error(`IP LEAK: "${term}" found in health response`)
          }
        }
      },
    },
  ]
}

function buildDeterminismTests(): RegressionTest[] {
  return [
    {
      name: 'squeeze_guard_determinism',
      test: async () => {
        const fixture = loadFixture<{ cases: Array<{ desc: string; inputs: Record<string, unknown>; expectedBlocked: boolean; expectedReason?: string | null }> }>('squeeze-guard-cases.json')
        for (const testCase of fixture.cases) {
          const result = runSqueezeGuard(testCase.inputs as unknown as SqueezeGuardInput)
          if (result.blocked !== testCase.expectedBlocked) {
            throw new Error(
              `SQUEEZE GUARD REGRESSION: "${testCase.desc}"\n` +
              `Expected blocked=${testCase.expectedBlocked}, got ${result.blocked}\n` +
              `Reason: ${result.reason}`,
            )
          }
          if (testCase.expectedReason !== undefined && result.reason !== testCase.expectedReason) {
            throw new Error(
              `SQUEEZE GUARD REASON MISMATCH: "${testCase.desc}"\n` +
              `Expected reason="${testCase.expectedReason}", got "${result.reason}"`,
            )
          }
        }
      },
    },
    {
      name: 'signal_matrix_coverage',
      test: async () => {
        const fixture = loadFixture<{ cases: Array<{ desc: string; inputs: { teknikSignalType: string; fundamentalScore: number; riskLevel: string; overvalLevel?: string; chiLevel?: string }; expected: string | null }> }>('signal-matrix-cases.json')
        for (const testCase of fixture.cases) {
          const { teknikSignalType, fundamentalScore, riskLevel, overvalLevel, chiLevel } = testCase.inputs
          const result = matchSignal(teknikSignalType, fundamentalScore, riskLevel, overvalLevel, chiLevel)
          if (result !== testCase.expected) {
            throw new Error(
              `SIGNAL REGRESSION: "${testCase.desc}"\n` +
              `Expected: ${testCase.expected}, Got: ${result}`,
            )
          }
        }
      },
    },
    {
      name: 'squeeze_guard_fail_closed_on_empty_input',
      test: async () => {
        const emptyInput: SqueezeGuardInput = {
          fundingRate: undefined,
          fundingZScore: undefined,
          openInterestChange24hPct: undefined,
          openInterestChange7dPct: undefined,
          priceChange1hPct: undefined,
          priceChange4hPct: undefined,
          priceChange24hPct: undefined,
          dexLiquidityUSD: undefined,
          volume24h: undefined,
          spreadPct: undefined,
          realizedVolatilityZ: undefined,
          marketCapRank: undefined,
          dataFreshnessMinutes: undefined,
        }
        const result = runSqueezeGuard(emptyInput)
        if (!result.blocked) {
          throw new Error('FAIL-CLOSED VIOLATION: Empty input should block short')
        }
        if (result.reason !== 'DATA_INCOMPLETE') {
          throw new Error(`Expected reason DATA_INCOMPLETE, got ${result.reason}`)
        }
      },
    },
  ]
}

// ── Exported suite ──

export function getRegressionSuite(): RegressionTest[] {
  return [
    ...buildEndpointSchemaTests(),
    ...buildIPProtectionTests(),
    ...buildDeterminismTests(),
  ]
}

export async function runRegressionSuite(): Promise<{ results: TestResult[]; passed: number; failed: number }> {
  const suite = getRegressionSuite()
  const results: TestResult[] = []

  for (const test of suite) {
    const start = Date.now()
    try {
      await test.test()
      results.push({ name: test.name, passed: true, durationMs: Date.now() - start })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ name: test.name, passed: false, error: message, durationMs: Date.now() - start })
    }
  }

  return {
    results,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
  }
}
