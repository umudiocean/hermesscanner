// ═══════════════════════════════════════════════════════════════════
// HERMES AI CRYPTO TERMINAL — DefiLlama Free API Client
// Free endpoints: TVL, Protocol Revenue/Fees, DEX Volume, Stablecoins
// No API key required — public endpoints at api.llama.fi
// ═══════════════════════════════════════════════════════════════════

import logger from '../logger'

const DEFILLAMA_BASE = 'https://api.llama.fi'

// ─── Rate Limiter ──────────────────────────────────────────────────

let nextSlot = 0
const MIN_DELAY_MS = 200

async function waitForSlot(): Promise<void> {
  const now = Date.now()
  const target = Math.max(now, nextSlot + MIN_DELAY_MS)
  nextSlot = target
  const wait = target - now
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
}

// ─── Fetch with retry ──────────────────────────────────────────────

async function llamaFetch<T>(endpoint: string, retries = 2): Promise<T | null> {
  const url = `${DEFILLAMA_BASE}${endpoint}`
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await waitForSlot()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      })
      clearTimeout(timeout)
      if (!res.ok) {
        if (res.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)))
          continue
        }
        logger.warn(`DefiLlama ${endpoint} returned ${res.status}`, { module: 'defillama' })
        return null
      }
      return await res.json() as T
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      logger.error(`DefiLlama ${endpoint} failed`, {
        module: 'defillama',
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

export interface DefiLlamaProtocol {
  id: string
  name: string
  symbol: string
  slug: string
  category: string
  chains: string[]
  tvl: number
  change_1h: number | null
  change_1d: number | null
  change_7d: number | null
  mcap: number | null
  gecko_id: string | null
}

export interface DefiLlamaProtocolFees {
  name: string
  slug: string
  total24h: number | null
  total7d: number | null
  total30d: number | null
  totalAllTime: number | null
  revenue24h: number | null
  revenue7d: number | null
  revenue30d: number | null
}

export interface DefiLlamaFeesOverview {
  totalFees24h: number
  totalRevenue24h: number
  protocols: Array<{
    name: string
    slug?: string
    total24h?: number
    total7d?: number
    total30d?: number
    revenue24h?: number
    revenue7d?: number
    revenue30d?: number
    chains?: string[]
    category?: string
    defillamaId?: string
    module?: string
    displayName?: string
  }>
}

export interface DefiLlamaChainTVL {
  gecko_id: string | null
  tvl: number
  tokenSymbol: string
  name: string
  chainId: number | null
}

export interface DefiLlamaCoinData {
  tvl: number | null
  tvlChange1d: number | null
  tvlChange7d: number | null
  revenue24h: number | null
  revenue7d: number | null
  revenue30d: number | null
  fees24h: number | null
  fees7d: number | null
  category: string | null
  chains: string[]
  protocolName: string | null
}

// ═══════════════════════════════════════════════════════════════════
// API ENDPOINTS (Free — no key required)
// ═══════════════════════════════════════════════════════════════════

export async function fetchAllProtocols(): Promise<DefiLlamaProtocol[]> {
  const data = await llamaFetch<DefiLlamaProtocol[]>('/protocols')
  return data ?? []
}

export async function fetchProtocolDetail(slug: string): Promise<Record<string, unknown> | null> {
  return llamaFetch<Record<string, unknown>>(`/protocol/${slug}`)
}

export async function fetchProtocolTVL(slug: string): Promise<number | null> {
  const data = await llamaFetch<number>(`/tvl/${slug}`)
  return typeof data === 'number' ? data : null
}

export async function fetchFeesOverview(): Promise<DefiLlamaFeesOverview | null> {
  const data = await llamaFetch<Record<string, unknown>>('/overview/fees')
  if (!data) return null

  const protocols: DefiLlamaFeesOverview['protocols'] = []
  const rawProtocols = data.protocols as Array<Record<string, unknown>> | undefined
  if (Array.isArray(rawProtocols)) {
    for (const p of rawProtocols) {
      protocols.push({
        name: String(p.name ?? ''),
        slug: p.slug as string | undefined,
        total24h: typeof p.total24h === 'number' ? p.total24h : undefined,
        total7d: typeof p.total7d === 'number' ? p.total7d : undefined,
        total30d: typeof p.total30d === 'number' ? p.total30d : undefined,
        revenue24h: typeof p.revenue24h === 'number' ? p.revenue24h : undefined,
        revenue7d: typeof p.revenue7d === 'number' ? p.revenue7d : undefined,
        revenue30d: typeof p.revenue30d === 'number' ? p.revenue30d : undefined,
        chains: Array.isArray(p.chains) ? p.chains as string[] : undefined,
        category: typeof p.category === 'string' ? p.category : undefined,
        defillamaId: typeof p.defillamaId === 'string' ? p.defillamaId : undefined,
        module: typeof p.module === 'string' ? p.module : undefined,
        displayName: typeof p.displayName === 'string' ? p.displayName : undefined,
      })
    }
  }

  return {
    totalFees24h: typeof data.totalFees24h === 'number' ? data.totalFees24h : 0,
    totalRevenue24h: typeof data.totalRevenue24h === 'number' ? data.totalRevenue24h : 0,
    protocols,
  }
}

export async function fetchProtocolFees(slug: string): Promise<DefiLlamaProtocolFees | null> {
  const data = await llamaFetch<Record<string, unknown>>(`/summary/fees/${slug}`)
  if (!data) return null
  return {
    name: String(data.name ?? slug),
    slug,
    total24h: typeof data.total24h === 'number' ? data.total24h : null,
    total7d: typeof data.total7d === 'number' ? data.total7d : null,
    total30d: typeof data.total30d === 'number' ? data.total30d : null,
    totalAllTime: typeof data.totalAllTime === 'number' ? data.totalAllTime : null,
    revenue24h: typeof data.revenue24h === 'number' ? data.revenue24h : null,
    revenue7d: typeof data.revenue7d === 'number' ? data.revenue7d : null,
    revenue30d: typeof data.revenue30d === 'number' ? data.revenue30d : null,
  }
}

export async function fetchChainsTVL(): Promise<DefiLlamaChainTVL[]> {
  const data = await llamaFetch<DefiLlamaChainTVL[]>('/v2/chains')
  return data ?? []
}

// ═══════════════════════════════════════════════════════════════════
// COIN→PROTOCOL MAPPING
// Maps CoinGecko coin IDs to DefiLlama protocol data using gecko_id
// ═══════════════════════════════════════════════════════════════════

let protocolCache: DefiLlamaProtocol[] | null = null
let protocolCacheTime = 0
const PROTOCOL_CACHE_TTL = 60 * 60 * 1000 // 1 hour

let feesCache: Map<string, DefiLlamaFeesOverview['protocols'][0]> | null = null
let feesCacheTime = 0
const FEES_CACHE_TTL = 60 * 60 * 1000

async function getProtocols(): Promise<DefiLlamaProtocol[]> {
  if (protocolCache && Date.now() - protocolCacheTime < PROTOCOL_CACHE_TTL) {
    return protocolCache
  }
  protocolCache = await fetchAllProtocols()
  protocolCacheTime = Date.now()
  logger.info(`DefiLlama protocols loaded: ${protocolCache.length}`, { module: 'defillama' })
  return protocolCache
}

async function getFeesMap(): Promise<Map<string, DefiLlamaFeesOverview['protocols'][0]>> {
  if (feesCache && Date.now() - feesCacheTime < FEES_CACHE_TTL) {
    return feesCache
  }
  const overview = await fetchFeesOverview()
  feesCache = new Map()
  if (overview?.protocols) {
    for (const p of overview.protocols) {
      const key = (p.name || '').toLowerCase().replace(/\s+/g, '-')
      feesCache.set(key, p)
      if (p.displayName) {
        feesCache.set(p.displayName.toLowerCase().replace(/\s+/g, '-'), p)
      }
    }
  }
  feesCacheTime = Date.now()
  logger.info(`DefiLlama fees loaded: ${feesCache.size} protocols`, { module: 'defillama' })
  return feesCache
}

/**
 * Get DefiLlama data for a batch of CoinGecko coin IDs.
 * Returns a Map<geckoId, DefiLlamaCoinData>.
 * Uses gecko_id field from DefiLlama protocols to match.
 */
export async function getDefiLlamaDataBatch(
  geckoIds: string[],
): Promise<Map<string, DefiLlamaCoinData>> {
  const result = new Map<string, DefiLlamaCoinData>()
  if (geckoIds.length === 0) return result

  const [protocols, feesMap] = await Promise.all([getProtocols(), getFeesMap()])

  // Build gecko_id → protocol lookup
  const geckoToProtocol = new Map<string, DefiLlamaProtocol>()
  for (const p of protocols) {
    if (p.gecko_id) {
      geckoToProtocol.set(p.gecko_id, p)
    }
  }

  for (const gid of geckoIds) {
    const protocol = geckoToProtocol.get(gid)
    if (!protocol) continue

    const slug = protocol.slug || protocol.name.toLowerCase().replace(/\s+/g, '-')
    const fees = feesMap.get(slug)

    result.set(gid, {
      tvl: protocol.tvl > 0 ? protocol.tvl : null,
      tvlChange1d: protocol.change_1d,
      tvlChange7d: protocol.change_7d,
      revenue24h: fees?.revenue24h ?? null,
      revenue7d: fees?.revenue7d ?? null,
      revenue30d: fees?.revenue30d ?? null,
      fees24h: fees?.total24h ?? null,
      fees7d: fees?.total7d ?? null,
      category: protocol.category ?? null,
      chains: protocol.chains ?? [],
      protocolName: protocol.name,
    })
  }

  logger.info(`DefiLlama batch: ${result.size}/${geckoIds.length} matched`, { module: 'defillama' })
  return result
}
