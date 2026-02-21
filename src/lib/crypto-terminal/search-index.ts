// ═══════════════════════════════════════════════════════════════════
// Precomputed crypto coin search index
// Builds a prefix map on first load (cold start), then serves O(1) lookups.
// Replaces linear scan of 18K+ coins with instant prefix matching.
// ═══════════════════════════════════════════════════════════════════

interface CoinEntry {
  id: string
  symbol: string
  name: string
  platforms?: Record<string, string>
}

interface IndexedCoin extends CoinEntry {
  isTopCoin: boolean
  symbolLower: string
  nameLower: string
  idLower: string
}

// Well-known top coins for priority sorting
const TOP_COIN_IDS = new Set([
  'bitcoin', 'ethereum', 'tether', 'ripple', 'binancecoin', 'solana', 'usd-coin',
  'dogecoin', 'cardano', 'staked-ether', 'tron', 'avalanche-2', 'chainlink',
  'shiba-inu', 'wrapped-bitcoin', 'polkadot', 'bitcoin-cash', 'dai', 'uniswap',
  'litecoin', 'leo-token', 'near', 'stellar', 'aptos', 'internet-computer',
  'ethereum-classic', 'monero', 'pepe', 'mantra', 'aave', 'hedera-hashgraph',
  'render-token', 'cosmos', 'filecoin', 'arbitrum', 'polygon-ecosystem-token',
  'fetch-ai', 'kaspa', 'okb', 'vechain', 'optimism', 'injective-protocol',
  'the-graph', 'fantom', 'theta-token', 'celestia', 'immutable-x', 'sei-network',
  'bonk', 'floki', 'maker', 'beam-2', 'algorand', 'ondo-finance',
  'sui', 'jupiter-exchange-solana', 'worldcoin-wld', 'pyth-network',
  'starknet', 'bittensor', 'pendle', 'thorchain', 'flow',
])

type PrefixMap = Map<string, IndexedCoin[]>

export class CoinSearchIndex {
  private symbolExact = new Map<string, IndexedCoin[]>()
  private idExact = new Map<string, IndexedCoin>()
  private nameExact = new Map<string, IndexedCoin[]>()
  private symbolPrefix: PrefixMap = new Map()
  private namePrefix: PrefixMap = new Map()
  private idPrefix: PrefixMap = new Map()
  private allCoins: IndexedCoin[] = []
  private contractIndex = new Map<string, { coin: IndexedCoin; chain: string; address: string }>()
  private builtAt = 0

  get coinCount(): number {
    return this.allCoins.length
  }

  get age(): number {
    return this.builtAt ? Date.now() - this.builtAt : Infinity
  }

  build(rawCoins: CoinEntry[]): void {
    const t0 = Date.now()

    this.symbolExact.clear()
    this.idExact.clear()
    this.nameExact.clear()
    this.symbolPrefix.clear()
    this.namePrefix.clear()
    this.idPrefix.clear()
    this.contractIndex.clear()

    this.allCoins = rawCoins.map((c) => ({
      ...c,
      isTopCoin: TOP_COIN_IDS.has(c.id),
      symbolLower: c.symbol.toLowerCase(),
      nameLower: c.name.toLowerCase(),
      idLower: c.id.toLowerCase(),
    }))

    for (const coin of this.allCoins) {
      // Exact maps
      this.addToListMap(this.symbolExact, coin.symbolLower, coin)
      this.idExact.set(coin.idLower, coin)
      this.addToListMap(this.nameExact, coin.nameLower, coin)

      // Prefix maps (1-4 char prefixes for fast lookup)
      this.addPrefixes(this.symbolPrefix, coin.symbolLower, coin)
      this.addPrefixes(this.namePrefix, coin.nameLower, coin)
      this.addPrefixes(this.idPrefix, coin.idLower, coin)

      // Contract index
      if (coin.platforms) {
        for (const [chain, address] of Object.entries(coin.platforms)) {
          if (!address) continue
          const addrLower = address.toLowerCase()
          this.contractIndex.set(addrLower, { coin, chain, address })
          // Also index first 10-char prefix for partial match
          if (addrLower.length >= 10) {
            const partial = addrLower.slice(0, 10)
            if (!this.contractIndex.has(partial)) {
              this.contractIndex.set(partial, { coin, chain, address })
            }
          }
        }
      }
    }

    this.builtAt = Date.now()
    console.log(`[SEARCH-INDEX] Built in ${Date.now() - t0}ms — ${this.allCoins.length} coins, ${this.contractIndex.size} contracts`)
  }

  search(query: string, limit: number): SearchResult[] {
    const q = query.toLowerCase().trim()
    if (!q) return []

    // Contract address search
    const isContractSearch = /^0x[a-f0-9]{10,}$/i.test(q) || /^[a-z0-9]{32,}$/i.test(q)
    if (isContractSearch) {
      return this.searchContracts(q, limit)
    }

    // Collect results in priority order
    const seen = new Set<string>()
    const results: SearchResult[] = []

    const addCoin = (coin: IndexedCoin) => {
      if (seen.has(coin.id) || results.length >= limit) return
      seen.add(coin.id)
      results.push({ id: coin.id, symbol: coin.symbol, name: coin.name })
    }

    const addSorted = (coins: IndexedCoin[] | undefined) => {
      if (!coins) return
      const sorted = [...coins].sort((a, b) => (a.isTopCoin ? 0 : 1) - (b.isTopCoin ? 0 : 1))
      for (const c of sorted) addCoin(c)
    }

    // 1. Exact ID match
    const exactId = this.idExact.get(q)
    if (exactId) addCoin(exactId)

    // 2. Exact name match
    addSorted(this.nameExact.get(q))

    // 3. Exact symbol match
    addSorted(this.symbolExact.get(q))

    // 4. Symbol prefix match
    addSorted(this.symbolPrefix.get(q.slice(0, Math.min(q.length, 4))))

    // 5. Name prefix match
    addSorted(this.namePrefix.get(q.slice(0, Math.min(q.length, 4))))

    // 6. ID prefix match
    addSorted(this.idPrefix.get(q.slice(0, Math.min(q.length, 4))))

    // 7. If still under limit, do substring scan on remaining coins
    if (results.length < limit) {
      const remaining = this.allCoins.filter(
        (c) =>
          !seen.has(c.id) &&
          (c.symbolLower.includes(q) || c.nameLower.includes(q) || c.idLower.includes(q))
      )
      remaining.sort((a, b) => (a.isTopCoin ? 0 : 1) - (b.isTopCoin ? 0 : 1))
      for (const c of remaining) {
        addCoin(c)
        if (results.length >= limit) break
      }
    }

    return results
  }

  private searchContracts(q: string, limit: number): SearchResult[] {
    const results: SearchResult[] = []
    const seen = new Set<string>()

    // Exact match first
    const exact = this.contractIndex.get(q)
    if (exact && !seen.has(exact.coin.id)) {
      seen.add(exact.coin.id)
      results.push({
        id: exact.coin.id,
        symbol: exact.coin.symbol,
        name: exact.coin.name,
        matchedContract: { chain: exact.chain, address: exact.address },
      })
    }

    // Prefix/partial matches
    if (results.length < limit) {
      for (const [addr, entry] of this.contractIndex.entries()) {
        if (seen.has(entry.coin.id)) continue
        if (addr.startsWith(q) || (q.length >= 10 && addr.includes(q))) {
          seen.add(entry.coin.id)
          results.push({
            id: entry.coin.id,
            symbol: entry.coin.symbol,
            name: entry.coin.name,
            matchedContract: { chain: entry.chain, address: entry.address },
          })
          if (results.length >= limit) break
        }
      }
    }

    return results
  }

  private addToListMap(map: Map<string, IndexedCoin[]>, key: string, coin: IndexedCoin) {
    const list = map.get(key)
    if (list) list.push(coin)
    else map.set(key, [coin])
  }

  private addPrefixes(map: PrefixMap, text: string, coin: IndexedCoin) {
    const maxLen = Math.min(text.length, 4)
    for (let i = 1; i <= maxLen; i++) {
      const prefix = text.slice(0, i)
      this.addToListMap(map, prefix, coin)
    }
  }
}

export interface SearchResult {
  id: string
  symbol: string
  name: string
  matchedContract?: { chain: string; address: string }
}

// Singleton index (survives serverless warm instances)
let globalIndex: CoinSearchIndex | null = null

export function getSearchIndex(): CoinSearchIndex {
  if (!globalIndex) {
    globalIndex = new CoinSearchIndex()
  }
  return globalIndex
}
