// ═══════════════════════════════════════════════════════════════════
// HERMES AI FUND — WIND-DOWN PROCESSOR
// Processes ALL pending operations for ALL users from the contract.
//
// RULES:
//   - Principal (USDT withdraw + HERMES unstake) -> FULL amount
//   - Rewards   (USDT claim   + HERMES claim)    -> 50% (YIELD_REDUCTION)
//   - If treasury lacks USDT for a USDT op -> SKIP that op, still do HERMES
//   - Checkpoint: re-runs skip already-completed ops
//   - Dry-run by default; pass --execute to send real transactions
//
// USAGE:
//   $env:TREASURY_PRIVATE_KEY="0x..."          # PowerShell
//   node scripts/fund-winddown.mjs             # DRY-RUN (no tx, safe)
//   node scripts/fund-winddown.mjs --execute   # REAL payouts
//   node scripts/fund-winddown.mjs --execute --only 0x5fd2...   # single user
//
// SECURITY: key is read from env only, never logged, never hardcoded.
// ═══════════════════════════════════════════════════════════════════

import { ethers } from 'ethers'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── Config ────────────────────────────────────────────────────────
const RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org'
const FUND = '0x52A878b8385d66FE6E37656042036E058FE9850A'
const USDT = '0x55d398326f99059fF775485246999027B3197955'
const HERMES = '0x9495aB3549338BF14aD2F86CbcF79C7b574bba37'
const YIELD_REDUCTION_NUM = 1n   // rewards: multiply by 1 then divide by 2 => 50%
const YIELD_REDUCTION_DEN = 2n

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHECKPOINT = path.join(__dirname, '.winddown-checkpoint.json')

// ─── CLI flags ─────────────────────────────────────────────────────
const args = process.argv.slice(2)
const EXECUTE = args.includes('--execute')
// --mark-only: clears pending flag via mark*Paid WITHOUT transferring tokens.
// Use ONLY to unlock locked buttons on wallets you control (no refund happens).
const MARK_ONLY = args.includes('--mark-only')
// --close: wind-down close mode. If treasury has the token -> transfer + mark.
// If not -> mark-only (complete as if paid). HERMES has funds so it transfers;
// USDT with no funds gets marked closed. One command finishes everything.
const CLOSE = args.includes('--close')
const ONLY = (() => {
  const i = args.indexOf('--only')
  return i >= 0 && args[i + 1] ? args[i + 1].toLowerCase() : null
})()

// ─── ABIs (minimal) ────────────────────────────────────────────────
const FUND_ABI = [
  'function getUserCount() view returns (uint256)',
  'function users(uint256) view returns (address)',
  'function owner() view returns (address)',
  'function pendingUsdtClaim(address) view returns (uint256)',
  'function pendingHermesClaim(address) view returns (uint256)',
  'function pendingUsdtWithdraw(address) view returns (bool)',
  'function pendingHermesUnstake(address) view returns (bool)',
  'function positions(address) view returns (uint8 planId,uint8 status,bool usdtPaid,bool hermesUnstaked,uint256 usdtPrincipal,uint256 hermesStaked,uint256 startTime,uint256 claimedUsdt,uint256 claimedHermes,uint256 lastClaimUsdt,uint256 lastClaimHermes)',
  'function markUsdtClaimPaid(address)',
  'function markHermesClaimPaid(address)',
  'function markUsdtWithdrawPaid(address)',
  'function markHermesUnstakePaid(address)',
]
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
]

// ─── Helpers ───────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
async function withRetry(fn, label, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try { return await fn() }
    catch (e) {
      const isRate = /rate limit|-32005|missing response|timeout|SERVER_ERROR/i.test(e.message || '')
      if (i === tries - 1 || !isRate) throw e
      const wait = 800 * (i + 1)
      log(`    [retry ${i + 1}/${tries}] ${label} after ${wait}ms (${(e.message || '').slice(0, 60)})`)
      await sleep(wait)
    }
  }
}
const f = (x) => Number(ethers.formatUnits(x, 18))
const fmt = (x) => f(x).toLocaleString('en-US', { maximumFractionDigits: 4 })
function log(msg) { process.stdout.write(msg + '\n') }
function loadCheckpoint() {
  try { return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')) } catch { return { done: {} } }
}
function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2))
}

// ─── Main ──────────────────────────────────────────────────────────
async function main() {
  log('===================================================================')
  log('  HERMES FUND WIND-DOWN  ' + (EXECUTE ? '[EXECUTE - REAL PAYOUTS]' : '[DRY-RUN - no transactions]'))
  log('===================================================================')

  const provider = new ethers.JsonRpcProvider(RPC)

  let wallet = null
  if (EXECUTE) {
    const key = process.env.TREASURY_PRIVATE_KEY
    if (!key) { log('[FATAL] TREASURY_PRIVATE_KEY env not set. Aborting.'); process.exit(1) }
    wallet = new ethers.Wallet(key, provider)
    log('[INFO] Signer: ' + wallet.address)
  }

  const fundRead = new ethers.Contract(FUND, FUND_ABI, provider)
  const owner = await fundRead.owner()
  log('[INFO] Contract owner: ' + owner)
  if (EXECUTE && wallet.address.toLowerCase() !== owner.toLowerCase()) {
    log('[WARN] Signer is NOT the contract owner. markPaid calls may revert.')
  }

  // signer-bound contracts (only used in execute)
  const fund = EXECUTE ? new ethers.Contract(FUND, FUND_ABI, wallet) : null
  const usdtRead = new ethers.Contract(USDT, ERC20_ABI, provider)
  const hermesRead = new ethers.Contract(HERMES, ERC20_ABI, provider)
  const usdt = EXECUTE ? new ethers.Contract(USDT, ERC20_ABI, wallet) : null
  const hermes = EXECUTE ? new ethers.Contract(HERMES, ERC20_ABI, wallet) : null

  // Treasury balances (= owner wallet that pays)
  const payer = owner
  let treUsdt = await usdtRead.balanceOf(payer)
  let treHermes = await hermesRead.balanceOf(payer)
  log('[INFO] Treasury USDT:   ' + fmt(treUsdt))
  log('[INFO] Treasury HERMES: ' + fmt(treHermes))

  // Build user list
  const count = Number(await fundRead.getUserCount())
  let userList = []
  for (let i = 0; i < count; i++) userList.push((await fundRead.users(i)).toLowerCase())
  userList = [...new Set(userList)]
  if (ONLY) userList = userList.filter(u => u === ONLY)
  log('[INFO] Users to scan: ' + userList.length + (ONLY ? ' (filtered --only ' + ONLY + ')' : ' of ' + count))
  log('-------------------------------------------------------------------')

  const cp = loadCheckpoint()
  const startTs = Date.now()
  const totals = { usdtPrincipal: 0n, hermesPrincipal: 0n, usdtReward: 0n, hermesReward: 0n }
  const skipped = []
  let processedOps = 0

  for (let idx = 0; idx < userList.length; idx++) {
    const u = userList[idx]
    const elapsed = (Date.now() - startTs) / 1000
    const rate = idx > 0 ? (idx / elapsed).toFixed(2) : '0.00'
    const eta = idx > 0 ? Math.round((userList.length - idx) / (idx / elapsed)) : 0
    log(`[${idx + 1}/${userList.length}] ${u}  (rate ${rate}/s, eta ${eta}s)`)

    // Sequential reads with retry — avoids public RPC batch rate-limit
    const pUW = await withRetry(() => fundRead.pendingUsdtWithdraw(u), 'pendingUsdtWithdraw')
    const pHU = await withRetry(() => fundRead.pendingHermesUnstake(u), 'pendingHermesUnstake')
    const pUC = await withRetry(() => fundRead.pendingUsdtClaim(u), 'pendingUsdtClaim')
    const pHC = await withRetry(() => fundRead.pendingHermesClaim(u), 'pendingHermesClaim')
    const pos = await withRetry(() => fundRead.positions(u), 'positions')
    await sleep(120)  // gentle throttle between users

    const ops = []
    // Principal — FULL (USDT + HERMES)
    if (pUW && pos.usdtPrincipal > 0n) ops.push({ key: 'usdt_withdraw', token: 'USDT', amount: pos.usdtPrincipal, mark: 'markUsdtWithdrawPaid' })
    if (pHU && pos.hermesStaked > 0n) ops.push({ key: 'hermes_unstake', token: 'HERMES', amount: pos.hermesStaked, mark: 'markHermesUnstakePaid' })
    // Rewards — ONLY USDT claim is reduced 50%. HERMES claim is FULL.
    if (pUC > 0n) ops.push({ key: 'usdt_claim', token: 'USDT', amount: (pUC * YIELD_REDUCTION_NUM) / YIELD_REDUCTION_DEN, mark: 'markUsdtClaimPaid' })
    if (pHC > 0n) ops.push({ key: 'hermes_claim', token: 'HERMES', amount: pHC, mark: 'markHermesClaimPaid' })

    if (ops.length === 0) { log('    no pending ops'); continue }

    for (const op of ops) {
      const ckey = u + ':' + op.key
      if (cp.done[ckey]) { log(`    [skip-done] ${op.key} ${fmt(op.amount)} ${op.token}`); continue }

      const isUsdt = op.token === 'USDT'
      const bal = isUsdt ? treUsdt : treHermes

      // MARK-ONLY: clear the pending flag without transferring tokens
      if (MARK_ONLY) {
        if (!EXECUTE) { log(`    [dry-mark] would ${op.mark} (NO transfer) for ${op.key}`); processedOps++; continue }
        try {
          log(`    [mark-only] ${op.mark} (NO transfer) ...`)
          const tx = await fund[op.mark](u)
          await tx.wait()
          cp.done[ckey] = { markOnly: tx.hash, ts: Date.now() }
          saveCheckpoint(cp)
          processedOps++
          log(`    [OK] mark=${tx.hash}`)
        } catch (e) {
          log(`    [ERROR] ${op.key}: ${e.message}`)
          skipped.push({ user: u, op: op.key, token: op.token, error: e.message })
        }
        continue
      }

      // Insufficient balance:
      //  - CLOSE mode -> mark-only (complete as if paid, no transfer)
      //  - otherwise  -> skip and keep going
      if (bal < op.amount) {
        if (CLOSE) {
          if (!EXECUTE) { log(`    [dry-close] would ${op.mark} (NO funds, mark closed) for ${op.key}`); processedOps++; continue }
          try {
            log(`    [close-mark] ${op.mark} (no ${op.token}, mark closed) ...`)
            const tx = await fund[op.mark](u)
            await tx.wait()
            cp.done[ckey] = { closeMark: tx.hash, ts: Date.now() }
            saveCheckpoint(cp)
            processedOps++
            log(`    [OK] mark=${tx.hash}`)
          } catch (e) {
            log(`    [ERROR] ${op.key}: ${e.message}`)
            skipped.push({ user: u, op: op.key, token: op.token, error: e.message })
          }
          continue
        }
        log(`    [SKIP-NOFUNDS] ${op.key}: need ${fmt(op.amount)} ${op.token}, have ${fmt(bal)}`)
        skipped.push({ user: u, op: op.key, token: op.token, need: f(op.amount), have: f(bal) })
        continue
      }

      // tally
      if (op.key === 'usdt_withdraw') totals.usdtPrincipal += op.amount
      else if (op.key === 'hermes_unstake') totals.hermesPrincipal += op.amount
      else if (op.key === 'usdt_claim') totals.usdtReward += op.amount
      else if (op.key === 'hermes_claim') totals.hermesReward += op.amount

      if (!EXECUTE) {
        log(`    [dry] would send ${fmt(op.amount)} ${op.token} -> ${op.mark}`)
        if (isUsdt) treUsdt -= op.amount; else treHermes -= op.amount
        processedOps++
        continue
      }

      // EXECUTE
      try {
        log(`    [send] ${fmt(op.amount)} ${op.token} ...`)
        const tokenC = isUsdt ? usdt : hermes
        const tx1 = await tokenC.transfer(u, op.amount)
        await tx1.wait()
        const tx2 = await fund[op.mark](u)
        await tx2.wait()
        if (isUsdt) treUsdt -= op.amount; else treHermes -= op.amount
        cp.done[ckey] = { transfer: tx1.hash, mark: tx2.hash, ts: Date.now() }
        saveCheckpoint(cp)
        processedOps++
        log(`    [OK] transfer=${tx1.hash} mark=${tx2.hash}`)
      } catch (e) {
        log(`    [ERROR] ${op.key}: ${e.message}`)
        skipped.push({ user: u, op: op.key, token: op.token, error: e.message })
      }
    }
  }

  log('===================================================================')
  log('  SUMMARY')
  log('-------------------------------------------------------------------')
  log('  Processed ops:        ' + processedOps)
  log('  USDT principal paid:  ' + fmt(totals.usdtPrincipal))
  log('  HERMES principal paid:' + fmt(totals.hermesPrincipal))
  log('  USDT reward (50%):    ' + fmt(totals.usdtReward))
  log('  HERMES reward (50%):  ' + fmt(totals.hermesReward))
  log('  TOTAL USDT needed:    ' + fmt(totals.usdtPrincipal + totals.usdtReward))
  log('  TOTAL HERMES needed:  ' + fmt(totals.hermesPrincipal + totals.hermesReward))
  log('  Skipped (no funds/err): ' + skipped.length)
  if (skipped.length > 0) {
    log('-------------------------------------------------------------------')
    for (const s of skipped) {
      if (s.error) log(`    ! ${s.user} ${s.op}: ${s.error}`)
      else log(`    ! ${s.user} ${s.op}: need ${s.need} ${s.token}, have ${s.have}`)
    }
  }
  log('===================================================================')
  if (!EXECUTE) log('  DRY-RUN complete. Re-run with --execute to send real payouts.')
  else log('  EXECUTE complete. Checkpoint: ' + CHECKPOINT)
}

main().catch((e) => { log('[FATAL] ' + e.message); process.exit(1) })
