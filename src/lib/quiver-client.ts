// ═══════════════════════════════════════════════════════════════════
// QUIVER QUANTITATIVE API CLIENT
// Congressional trades, insider sentiment, hedge fund activity
// ═══════════════════════════════════════════════════════════════════

const QUIVER_API_KEY = process.env.QUIVER_API_KEY || ''
const QUIVER_BASE = 'https://api.quiverquant.com/beta'

interface QuiverCongressionalTrade {
  ReportDate: string
  TransactionDate: string
  Ticker: string
  Representative: string
  Transaction: 'Purchase' | 'Sale'
  Range: string
  House: string
}

interface QuiverInsiderSentiment {
  Date: string
  Ticker: string
  Insider: string
  Title: string
  Transaction: string
  Shares: number
  Value: number
}

interface QuiverHedgeFund {
  Date: string
  Ticker: string
  Fund: string
  Shares: number
  Value: number
  PercentOfPortfolio: number
}

export interface WallStreetPulseData {
  congressional: {
    recentTrades: number
    netBuysSells: number // positive = more buys
    lastTradeDate: string | null
  }
  insiderSentiment: {
    recentTrades: number
    netValue: number
    bullishRatio: number // 0-1
  }
  hedgeFunds: {
    holders: number
    totalValue: number
    recentActivity: 'BUYING' | 'SELLING' | 'NEUTRAL'
  }
}

async function quiverFetch<T>(endpoint: string): Promise<T | null> {
  if (!QUIVER_API_KEY) {
    console.warn('[Quiver] API key not configured')
    return null
  }

  try {
    const url = `${QUIVER_BASE}${endpoint}`
    const headers = {
      'Authorization': `Bearer ${QUIVER_API_KEY}`,
      'accept': 'application/json',
    }

    const res = await fetch(url, { 
      headers,
      next: { revalidate: 3600 }, // 1 hour cache
    })

    if (!res.ok) {
      console.error(`[Quiver] ${endpoint} failed: ${res.status}`)
      return null
    }

    return await res.json()
  } catch (error) {
    console.error(`[Quiver] ${endpoint} error:`, error)
    return null
  }
}

export async function fetchWallStreetPulse(symbol: string): Promise<WallStreetPulseData | null> {
  try {
    // Fetch all data in parallel
    const [congressData, insiderData, hedgeFundData] = await Promise.all([
      quiverFetch<QuiverCongressionalTrade[]>(`/historical/congresstrading/${symbol}`),
      quiverFetch<QuiverInsiderSentiment[]>(`/historical/insider/${symbol}`),
      quiverFetch<QuiverHedgeFund[]>(`/historical/hedgefund/${symbol}`),
    ])

    // Process Congressional trades (last 90 days)
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    
    const recentCongress = (congressData || []).filter(t => {
      const tradeDate = new Date(t.TransactionDate)
      return tradeDate >= ninetyDaysAgo
    })

    const congressBuys = recentCongress.filter(t => t.Transaction === 'Purchase').length
    const congressSells = recentCongress.filter(t => t.Transaction === 'Sale').length

    // Process Insider sentiment (last 90 days)
    const recentInsider = (insiderData || []).filter(t => {
      const tradeDate = new Date(t.Date)
      return tradeDate >= ninetyDaysAgo
    })

    const insiderBuyValue = recentInsider
      .filter(t => t.Transaction.toLowerCase().includes('buy') || t.Transaction.toLowerCase().includes('purchase'))
      .reduce((sum, t) => sum + (t.Value || 0), 0)
    
    const insiderSellValue = recentInsider
      .filter(t => t.Transaction.toLowerCase().includes('sale') || t.Transaction.toLowerCase().includes('sell'))
      .reduce((sum, t) => sum + Math.abs(t.Value || 0), 0)

    const totalInsiderValue = insiderBuyValue + insiderSellValue
    const bullishRatio = totalInsiderValue > 0 ? insiderBuyValue / totalInsiderValue : 0.5

    // Process Hedge Fund activity (last 2 quarters)
    const recentHF = (hedgeFundData || []).slice(0, 20) // Last 20 entries
    const totalHolders = new Set(recentHF.map(h => h.Fund)).size
    const totalValue = recentHF.reduce((sum, h) => sum + (h.Value || 0), 0)

    // Detect recent activity (compare last 10 vs previous 10)
    const latest10 = recentHF.slice(0, 10).reduce((sum, h) => sum + (h.Shares || 0), 0)
    const previous10 = recentHF.slice(10, 20).reduce((sum, h) => sum + (h.Shares || 0), 0)
    
    let hfActivity: 'BUYING' | 'SELLING' | 'NEUTRAL' = 'NEUTRAL'
    if (latest10 > previous10 * 1.1) hfActivity = 'BUYING'
    else if (latest10 < previous10 * 0.9) hfActivity = 'SELLING'

    // Get last trade date
    const allDates = [
      ...(congressData || []).map(t => t.TransactionDate),
      ...(insiderData || []).map(t => t.Date),
    ].sort().reverse()
    const lastTradeDate = allDates.length > 0 ? allDates[0] : null

    return {
      congressional: {
        recentTrades: recentCongress.length,
        netBuysSells: congressBuys - congressSells,
        lastTradeDate,
      },
      insiderSentiment: {
        recentTrades: recentInsider.length,
        netValue: insiderBuyValue - insiderSellValue,
        bullishRatio,
      },
      hedgeFunds: {
        holders: totalHolders,
        totalValue,
        recentActivity: hfActivity,
      },
    }
  } catch (error) {
    console.error('[WallStreetPulse] Error:', error)
    return null
  }
}
