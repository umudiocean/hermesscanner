// ═══════════════════════════════════════════════════════════════════
// HERMES AI NASDAQ TERMINAL — /api/nasdaq-terminal/search
// Hisse sembolu ve sirket ismi ile arama (amazon -> AMZN)
// ═══════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { getSymbols } from '@/lib/symbols'
import { promises as fs } from 'fs'
import path from 'path'

const SECTORS_FILE = path.join(process.cwd(), 'data', 'sectors.json')

let sectorsMap: Map<string, string> = new Map()
let stocksCache: { symbol: string; companyName: string; companyNameDisplay: string; sector: string }[] = []
let stocksCacheTime = 0
const STOCKS_CACHE_TTL = 10 * 60 * 1000 // 10 dk

async function loadSectors(): Promise<Map<string, string>> {
  if (sectorsMap.size > 0) return sectorsMap
  try {
    const content = await fs.readFile(SECTORS_FILE, 'utf-8')
    const data = JSON.parse(content)
    if (data.sectors) {
      sectorsMap = new Map(Object.entries(data.sectors) as [string, string][])
    }
  } catch { /* ignore */ }
  return sectorsMap
}

async function getStocksWithNames(): Promise<{ symbol: string; companyName: string; companyNameDisplay: string; sector: string }[]> {
  if (stocksCache.length > 0 && Date.now() - stocksCacheTime < STOCKS_CACHE_TTL) {
    return stocksCache
  }
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${process.env.PORT || 3000}`
    const res = await fetch(`${base}/api/fmp-terminal/stocks`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    const sectors = await loadSectors()
    const raw = data.stocks || []
    stocksCache = raw.map((s: { symbol: string; companyName?: string }) => {
      const name = s.companyName || ''
      return {
        symbol: s.symbol,
        companyName: name.toLowerCase(),
        companyNameDisplay: name,
        sector: sectors.get(s.symbol) || '',
      }
    })
    stocksCacheTime = Date.now()
    return stocksCache
  } catch { return stocksCache }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const qRaw = (searchParams.get('q') || '').trim()
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    if (!qRaw) {
      return NextResponse.json({ results: [], query: '', total: 0 })
    }

    const q = qRaw.toUpperCase()
    const qLower = qRaw.toLowerCase()
    const stocks = await getStocksWithNames()
    const sectors = await loadSectors()

    const exactSymbol: { symbol: string; sector: string; companyName?: string }[] = []
    const startsWithSymbol: { symbol: string; sector: string; companyName?: string }[] = []
    const exactCompanyName: { symbol: string; sector: string; companyName?: string }[] = []
    const startsWithCompanyName: { symbol: string; sector: string; companyName?: string }[] = []
    const includesCompanyName: { symbol: string; sector: string; companyName?: string }[] = []
    const includesSymbol: { symbol: string; sector: string; companyName?: string }[] = []

    const seen = new Set<string>()

    for (const s of stocks) {
      if (seen.has(s.symbol)) continue
      const sector = s.sector || sectors.get(s.symbol) || ''
      const add = (arr: { symbol: string; sector: string; companyName?: string }[]) => {
        if (!seen.has(s.symbol)) {
          seen.add(s.symbol)
          arr.push({ symbol: s.symbol, sector })
        }
      }

      if (s.symbol === q) add(exactSymbol)
      else if (s.symbol.startsWith(q)) add(startsWithSymbol)
      else if (s.symbol.includes(q)) add(includesSymbol)
      else if (s.companyName) {
        if (s.companyName === qLower) add(exactCompanyName)
        else if (s.companyName.startsWith(qLower)) add(startsWithCompanyName)
        else if (s.companyName.includes(qLower)) add(includesCompanyName)
      }
    }

    if (stocks.length === 0) {
      for (const sym of getSymbols('ALL')) {
        if (seen.has(sym)) continue
        const sector = sectors.get(sym) || ''
        const add = (arr: { symbol: string; sector: string }[]) => {
          if (!seen.has(sym)) { seen.add(sym); arr.push({ symbol: sym, sector }) }
        }
        if (sym === q) add(exactSymbol)
        else if (sym.startsWith(q)) add(startsWithSymbol)
        else if (sym.includes(q)) add(includesSymbol)
      }
    }

    const results = [
      ...exactSymbol,
      ...startsWithSymbol,
      ...exactCompanyName,
      ...startsWithCompanyName,
      ...includesCompanyName,
      ...includesSymbol,
    ].slice(0, limit)

    const stocksMap = new Map(stocks.map(s => [s.symbol, s]))
    return NextResponse.json({
      results: results.map(r => ({
        symbol: r.symbol,
        sector: r.sector,
        companyName: stocksMap.get(r.symbol)?.companyNameDisplay,
      })),
      query: qRaw,
      total: results.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Search failed', message, results: [], timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
