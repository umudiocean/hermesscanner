// HERMES SENTINEL — Regression Gate Script
// Usage: npm run sentinel:regression
// Exit code 1 = regression detected → deploy blocked

import { runRegressionSuite } from '../lib/sentinel/regression'

async function main() {
  console.log('HERMES SENTINEL -- Regression Suite Starting...\n')

  const { results, passed, failed } = await runRegressionSuite()

  for (const r of results) {
    if (r.passed) {
      console.log(`  [OK] ${r.name} (${r.durationMs}ms)`)
    } else {
      console.error(`  [FAIL] ${r.name} (${r.durationMs}ms)`)
      console.error(`         ${r.error}\n`)
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`REGRESSION RESULTS: ${passed}/${results.length} passed`)

  if (failed > 0) {
    console.error(`\n${failed} REGRESSION(S) DETECTED -- DEPLOY BLOCKED\n`)
    const failures = results.filter(r => !r.passed)
    for (const f of failures) {
      console.error(`  FAIL: ${f.name}`)
      console.error(`        ${f.error}\n`)
    }
    process.exit(1)
  }

  console.log('\nAll regressions passed -- Deploy approved\n')
  process.exit(0)
}

main().catch(err => {
  console.error('Sentinel runner crashed:', err)
  process.exit(1)
})
