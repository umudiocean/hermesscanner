// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — Moralis Free API Client
// Free: 40,000 CU/day | EVM chains only (Ethereum, BSC, Polygon...)
// Provides: Token holders, smart money, DEX data
// Used for On-Chain scoring — replaces placeholder score=50
// ═══════════════════════════════════════════════════════════════════

import logger from '../logger'

const MORALIS_BASE = 'https://deep-index.moralis.io/api/v2.2'
const MORALIS_API_KEY = process.env.MORALIS_API_KEY || ''

// ─── CU Budget Tracking ────────────────────────────────────────────

let dailyCUSpent = 0
let cuResetTime = 0
const DAILY_CU_LIMIT = 38_000 // 40K limit with 2K safety margin
const CU_RESET_INTERVAL = 24 * 60 * 60 * 1000

function checkCUBudget(cost: number): boolean {
  const now = Date.now()
  if (now - cuResetTime > CU_RESET_INTERVAL) {
    dailyCUSpent = 0
    cuResetTime = now
  }
  if (dailyCUSpent + cost > DAILY_CU_LIMIT) {
    logger.warn(`Moralis CU budget exceeded: ${dailyCUSpent}/${DAILY_CU_LIMIT}`, { module: 'moralis' })
    return false
  }
  return true
}

function recordCU(cost: number): void {
  dailyCUSpent += cost
}

export function getMoralisCUUsage(): { spent: number; limit: number; remaining: number } {
  return { spent: dailyCUSpent, limit: DAILY_CU_LIMIT, remaining: DAILY_CU_LIMIT - dailyCUSpent }
}

// ─── Rate Limiter ──────────────────────────────────────────────────

let nextSlot = 0
const MIN_DELAY_MS = 150

async function waitForSlot(): Promise<void> {
  const now = Date.now()
  const target = Math.max(now, nextSlot + MIN_DELAY_MS)
  nextSlot = target
  const wait = target - now
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
}

// ─── Core fetch ────────────────────────────────────────────────────

async function moralisFetch<T>(
  endpoint: string,
  cuCost: number,
  params: Record<string, string> = {},
  retries = 1,
): Promise<T | null> {
  if (!MORALIS_API_KEY) {
    return null
  }
  if (!checkCUBudget(cuCost)) return null

  const url = new URL(`${MORALIS_BASE}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await waitForSlot()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      })
      clearTimeout(timeout)

      if (res.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, 3000))
        continue
      }
      if (!res.ok) {
        logger.warn(`Moralis ${endpoint} returned ${res.status}`, { module: 'moralis' })
        return null
      }

      recordCU(cuCost)
      return await res.json() as T
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000))
        continue
      }
      logger.error(`Moralis ${endpoint} failed`, {
        module: 'moralis',
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

export interface MoralisTokenHolder {
  owner_address: string
  percentage_relative_to_total_supply: number
  balance: string
  balance_formatted: string
  is_contract: boolean
  usd_value: number | null
  entity?: string | null
  entity_logo?: string | null
}

export interface MoralisTokenHolderStats {
  totalHolders: number
  holdersByAcquisition?: Record<string, number>
  holderCategories?: {
    whales: number
    sharks: number
    dolphins: number
    fish: number
  }
  top10Concentration: number
  top25Concentration: number
  top50Concentration: number
}

export interface MoralisHistoricalHolders {
  result: Array<{
    date: string
    totalHolders: number
    holderChange: number
    holderChangePercent: number
  }>
}

export interface MoralisTopProfitableWallet {
  address: string
  realized_profit_usd: number
  realized_profit_percentage: number
  count_of_trades: number
  avg_buy_price_usd: number
  avg_cost_of_quantity_acquired: number
}

export interface MoralisTokenStats {
  holders: number | null
  transfers: number | null
  transactions: number | null
}

export interface MoralisOnChainResult {
  holderConcentration: {
    top10Pct: number
    top25Pct: number
    totalHolders: number
  } | null
  holderGrowth: {
    change7d: number
    change30d: number
    trend: 'growing' | 'stable' | 'declining'
  } | null
  smartMoney: {
    topProfitableCount: number
    avgProfitPct: number
    netBuySignal: boolean
  } | null
  tokenStats: MoralisTokenStats | null
}

// ═══════════════════════════════════════════════════════════════════
// API ENDPOINTS (CU costs from Moralis docs)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get token holders list (50 CU)
 * Returns top holders sorted by balance
 */
export async function fetchTokenHolders(
  tokenAddress: string,
  chain: string = 'eth',
  limit = 20,
): Promise<MoralisTokenHolder[] | null> {
  const data = await moralisFetch<{ result: MoralisTokenHolder[] }>(
    `/erc20/${tokenAddress}/owners`,
    50,
    { chain, limit: String(limit), order: 'DESC' },
  )
  return data?.result ?? null
}

/**
 * Get historical token holder changes (50 CU)
 */
export async function fetchHistoricalHolders(
  tokenAddress: string,
  chain: string = 'eth',
): Promise<MoralisHistoricalHolders | null> {
  return moralisFetch<MoralisHistoricalHolders>(
    `/erc20/${tokenAddress}/holders/historical`,
    50,
    { chain },
  )
}

/**
 * Get top profitable wallets for a token (50 CU)
 */
export async function fetchTopProfitableWallets(
  tokenAddress: string,
  chain: string = 'eth',
): Promise<MoralisTopProfitableWallet[] | null> {
  const data = await moralisFetch<{ result: MoralisTopProfitableWallet[] }>(
    `/erc20/${tokenAddress}/top-gainers`,
    50,
    { chain },
  )
  return data?.result ?? null
}

/**
 * Get token statistics (50 CU)
 */
export async function fetchTokenStats(
  tokenAddress: string,
  chain: string = 'eth',
): Promise<MoralisTokenStats | null> {
  return moralisFetch<MoralisTokenStats>(
    `/erc20/${tokenAddress}/stats`,
    50,
    { chain },
  )
}

// ═══════════════════════════════════════════════════════════════════
// BATCH ON-CHAIN DATA FETCHER
// Gets holder concentration + smart money for multiple tokens
// Budget: ~150 CU per token (3 calls × 50 CU)
// Max ~250 tokens/day within 40K CU budget
// ═══════════════════════════════════════════════════════════════════

interface TokenAddress {
  geckoId: string
  address: string
  chain: string
}

/**
 * Fetch Moralis on-chain data for a batch of EVM tokens.
 * Returns Map<geckoId, MoralisOnChainResult>.
 * Prioritizes by market cap rank (higher rank = higher priority).
 */
export async function getMoralisOnChainBatch(
  tokens: TokenAddress[],
  maxTokens = 200,
): Promise<Map<string, MoralisOnChainResult>> {
  const result = new Map<string, MoralisOnChainResult>()
  if (!MORALIS_API_KEY || tokens.length === 0) return result

  const batch = tokens.slice(0, maxTokens)
  let processed = 0

  for (const token of batch) {
    if (!checkCUBudget(150)) {
      logger.warn(`Moralis batch stopped at ${processed}/${batch.length} — CU budget`, { module: 'moralis' })
      break
    }

    try {
      const [holders, historical, profitable] = await Promise.all([
        fetchTokenHolders(token.address, token.chain, 25),
        fetchHistoricalHolders(token.address, token.chain),
        fetchTopProfitableWallets(token.address, token.chain),
      ])

      const onchain: MoralisOnChainResult = {
        holderConcentration: null,
        holderGrowth: null,
        smartMoney: null,
        tokenStats: null,
      }

      // Holder concentration
      if (holders && holders.length > 0) {
        let top10 = 0, top25 = 0
        for (let i = 0; i < holders.length; i++) {
          const pct = holders[i].percentage_relative_to_total_supply ?? 0
          if (i < 10) top10 += pct
          if (i < 25) top25 += pct
        }
        onchain.holderConcentration = {
          top10Pct: Math.round(top10 * 100) / 100,
          top25Pct: Math.round(top25 * 100) / 100,
          totalHolders: holders.length,
        }
      }

      // Holder growth trend
      if (historical?.result && historical.result.length >= 2) {
        const recent = historical.result.slice(-7)
        const change7d = recent.length >= 2
          ? recent[recent.length - 1].totalHolders - recent[0].totalHolders
          : 0
        const all = historical.result
        const change30d = all.length >= 2
          ? all[all.length - 1].totalHolders - all[0].totalHolders
          : 0
        const pctChange = all[0].totalHolders > 0
          ? (change30d / all[0].totalHolders) * 100
          : 0

        let trend: 'growing' | 'stable' | 'declining' = 'stable'
        if (pctChange > 2) trend = 'growing'
        else if (pctChange < -2) trend = 'declining'

        onchain.holderGrowth = { change7d, change30d, trend }
      }

      // Smart money analysis
      if (profitable && profitable.length > 0) {
        const profitableTraders = profitable.filter(w => w.realized_profit_usd > 0)
        const avgProfit = profitableTraders.length > 0
          ? profitableTraders.reduce((s, w) => s + w.realized_profit_percentage, 0) / profitableTraders.length
          : 0
        onchain.smartMoney = {
          topProfitableCount: profitableTraders.length,
          avgProfitPct: Math.round(avgProfit * 100) / 100,
          netBuySignal: profitableTraders.length >= 5 && avgProfit > 10,
        }
      }

      result.set(token.geckoId, onchain)
      processed++
    } catch (err) {
      logger.warn(`Moralis ${token.geckoId} failed`, {
        module: 'moralis',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info(`Moralis batch: ${result.size}/${batch.length} tokens processed, CU spent: ${dailyCUSpent}`, { module: 'moralis' })
  return result
}

// ═══════════════════════════════════════════════════════════════════
// COIN→ADDRESS MAPPING
// Uses CoinGecko /coins/list with platforms to get EVM addresses
// ═══════════════════════════════════════════════════════════════════

export interface CoinPlatformInfo {
  geckoId: string
  address: string
  chain: string
}

const CHAIN_MAP: Record<string, string> = {
  ethereum: 'eth',
  'binance-smart-chain': 'bsc',
  'polygon-pos': 'polygon',
  'arbitrum-one': 'arbitrum',
  avalanche: 'avalanche',
  optimistic_ethereum: 'optimism',
  base: 'base',
}

/**
 * Extract EVM contract addresses from CoinGecko coins list.
 * Returns only tokens with valid EVM addresses.
 */
export function extractEVMAddresses(
  coinsList: Array<{ id: string; platforms?: Record<string, string> }>,
  targetIds: string[],
): CoinPlatformInfo[] {
  const targetSet = new Set(targetIds)
  const result: CoinPlatformInfo[] = []

  for (const coin of coinsList) {
    if (!targetSet.has(coin.id)) continue
    if (!coin.platforms) continue

    // Prefer Ethereum, then BSC, then others
    for (const preferredPlatform of ['ethereum', 'binance-smart-chain', 'polygon-pos', 'arbitrum-one', 'base']) {
      const addr = coin.platforms[preferredPlatform]
      if (addr && addr.length > 10) {
        const chain = CHAIN_MAP[preferredPlatform] || 'eth'
        result.push({ geckoId: coin.id, address: addr, chain })
        break
      }
    }
  }

  return result
}
