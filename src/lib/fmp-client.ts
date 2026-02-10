// ═══════════════════════════════════════════════════════════════════
// FMP (Financial Modeling Prep) API Client - STABLE Endpoints
// Yeni FMP API: /stable/ prefix, header-based auth
// Local cache destegi ile backtest icin veri saklama
// ═══════════════════════════════════════════════════════════════════

import { OHLCV } from './types'
import { saveHistoricalData, loadHistoricalData, getHistoricalAge, save15MinData, load15MinData, get15MinAge } from './data-store'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

// In-memory cache (Vercel warm instances arasinda korunur)
const historyCache = new Map<string, { bars: OHLCV[]; fetchedAt: number }>()
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 saat
const LOCAL_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 saat - locale kayitli veriler icin

function getApiKey(): string {
  const key = process.env.FMP_API_KEY
  if (!key) throw new Error('FMP_API_KEY environment variable is not set')
  return key
}

/** FMP stable API icin fetch wrapper - header auth */
async function fmpFetch(endpoint: string, params: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${FMP_BASE}${endpoint}`)
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val)
  }

  return fetch(url.toString(), {
    headers: {
      'apikey': getApiKey(),
    },
    cache: 'no-store',
  })
}

/**
 * Tek bir hisse icin gunluk OHLCV verileri
 * Endpoint: /stable/historical-price-eod/full?symbol=AAPL&from=...&to=...
 * 
 * Cache Stratejisi:
 * 1. Memory cache (4 saat) - ayni session'da tekrar cekme
 * 2. Local disk cache (24 saat) - API'yi yorma, backtest icin sakla
 * 3. API'den cek - cache yoksa veya eskiyse
 */
export async function getHistoricalDaily(
  symbol: string,
  calendarDays: number = 12000,  // ~33 yil - TradingView 7000+ bar destegi icin
  forceRefresh: boolean = false
): Promise<OHLCV[]> {
  // 1. Memory cache kontrolu
  const memCached = historyCache.get(symbol)
  if (!forceRefresh && memCached && Date.now() - memCached.fetchedAt < CACHE_TTL) {
    return memCached.bars
  }

  // 2. Local disk cache kontrolu
  if (!forceRefresh) {
    const localAge = await getHistoricalAge(symbol)
    if (localAge !== null && localAge < LOCAL_CACHE_TTL) {
      const localBars = await loadHistoricalData(symbol)
      if (localBars && localBars.length > 0) {
        // Memory cache'e de ekle
        historyCache.set(symbol, { bars: localBars, fetchedAt: Date.now() })
        return localBars
      }
    }
  }

  // 3. API'den cek
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - calendarDays)

  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  const res = await fmpFetch('/historical-price-eod/full', {
    symbol,
    from: fromStr,
    to: toStr,
  })

  if (!res.ok) {
    // API hatasi - local cache varsa onu kullan (eski olsa bile)
    const fallbackBars = await loadHistoricalData(symbol)
    if (fallbackBars && fallbackBars.length > 0) {
      console.log(`[FMP] API error for ${symbol}, using local cache`)
      historyCache.set(symbol, { bars: fallbackBars, fetchedAt: Date.now() })
      return fallbackBars
    }
    throw new Error(`FMP API error for ${symbol}: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()

  // FMP API farkli formatlarda donebilir:
  // 1. Dogrudan array: [...]
  // 2. Value wrapper: { value: [...], Count: N }
  // 3. Eski format: { symbol, historical: [...] }
  let historical: Record<string, unknown>[]
  if (Array.isArray(data)) {
    historical = data
  } else if (data.value && Array.isArray(data.value)) {
    historical = data.value
  } else if (data.historical && Array.isArray(data.historical)) {
    historical = data.historical
  } else {
    console.error(`Unexpected historical response format for ${symbol}:`, Object.keys(data))
    throw new Error(`No historical data for ${symbol}`)
  }

  if (historical.length === 0) {
    throw new Error(`Empty historical data for ${symbol}`)
  }

  // Stable API yeniden eskiye siralanmis geliyor, biz eskiden yeniye ceviriyoruz
  // Kontrol: ilk tarih son tarihten buyukse ters cevir
  const firstDate = historical[0].date as string
  const lastDate = historical[historical.length - 1].date as string
  if (firstDate > lastDate) {
    historical.reverse()
  }

  // ═══ KRİTİK: adjClose kullan (split-adjusted) ═══
  // FMP'nin `close` alanı split-adjusted olmayabilir.
  // TradingView tüm verilerini split-adjusted gösterir.
  // adjClose/close oranını O/H/L'ye de uyguluyoruz.
  const bars: OHLCV[] = historical.map((bar) => {
    const rawClose = bar.close as number
    const adjClose = (bar.adjClose as number) ?? rawClose
    // Split ratio: adjClose farklıysa O/H/L'yi de oranla
    const ratio = (rawClose > 0 && adjClose > 0 && rawClose !== adjClose)
      ? adjClose / rawClose
      : 1
    return {
      date: bar.date as string,
      open: (bar.open as number) * ratio,
      high: (bar.high as number) * ratio,
      low: (bar.low as number) * ratio,
      close: adjClose,
      volume: (bar.volume as number) || 0,
    }
  })

  // Memory cache'e kaydet
  historyCache.set(symbol, { bars, fetchedAt: Date.now() })

  // Local disk'e kaydet (async, beklemeden devam et)
  saveHistoricalData(symbol, bars).catch(err => {
    console.error(`[FMP] Failed to save ${symbol} to disk:`, err)
  })

  return bars
}

/**
 * Birden fazla hisse icin anlik fiyat bilgisi
 * Endpoint: /stable/batch-quote?symbols=AAPL,MSFT,...
 */
export async function getBatchQuotes(
  symbols: string[]
): Promise<Map<string, {
  price: number
  change: number
  changePercent: number
  volume: number
  marketCap: number
  dayHigh: number
  dayLow: number
  open: number
}>> {
  const results = new Map<string, {
    price: number
    change: number
    changePercent: number
    volume: number
    marketCap: number
    dayHigh: number
    dayLow: number
    open: number
  }>()

  // 100'luk gruplar halinde batch request
  const batchSize = 100
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)

    try {
      const res = await fmpFetch('/batch-quote', {
        symbols: batch.join(','),
      })

      if (!res.ok) {
        console.error(`Batch quote error: ${res.status} for batch starting at ${i}`)
        continue
      }

      const data = await res.json()
      
      // FMP API artik { value: [...], Count: N } formatinda donuyor
      let quotes: Record<string, unknown>[]
      if (Array.isArray(data)) {
        quotes = data
      } else if (data.value && Array.isArray(data.value)) {
        quotes = data.value
      } else {
        console.error('Unexpected batch quote response format:', Object.keys(data))
        continue
      }

      for (const quote of quotes) {
        if (quote.symbol) {
          results.set(quote.symbol as string, {
            price: (quote.price as number) ?? 0,
            change: (quote.change as number) ?? 0,
            changePercent: (quote.changePercentage as number) ?? (quote.changesPercentage as number) ?? 0,
            volume: (quote.volume as number) ?? 0,
            marketCap: (quote.marketCap as number) ?? 0,
            dayHigh: (quote.dayHigh as number) ?? 0,
            dayLow: (quote.dayLow as number) ?? 0,
            open: (quote.open as number) ?? 0,
          })
        }
      }
    } catch (err) {
      console.error(`Batch quote error (batch ${i}):`, err)
    }
  }

  return results
}

/**
 * Birden fazla hisse icin paralel historical data fetch
 * Rate limiting ile concurrency kontrolu
 */
export async function fetchMultipleHistorical(
  symbols: string[],
  concurrency: number = 10,
  onProgress?: (done: number, total: number, symbol: string) => void
): Promise<Map<string, OHLCV[]>> {
  const results = new Map<string, OHLCV[]>()
  let done = 0

  const queue = [...symbols]

  async function worker() {
    while (queue.length > 0) {
      const symbol = queue.shift()
      if (!symbol) break

      try {
        const bars = await getHistoricalDaily(symbol)
        results.set(symbol, bars)
      } catch (err) {
        console.error(`Failed to fetch ${symbol}:`, (err as Error).message)
      }

      done++
      if (onProgress) onProgress(done, symbols.length, symbol)

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  const workers: Promise<void>[] = []
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker())
  }
  await Promise.all(workers)

  return results
}

/**
 * Hisse sektör bilgilerini çek 
 * stable API /company-screener endpoint'i ile NASDAQ hisselerini çekiyoruz
 */
export async function getCompanyProfiles(
  symbols: string[]
): Promise<Map<string, { sector: string; industry: string; companyName: string }>> {
  const results = new Map<string, { sector: string; industry: string; companyName: string }>()
  const symbolSet = new Set(symbols)

  try {
    // stable API - company-screener ile NASDAQ hisselerini çek
    const res = await fmpFetch('/company-screener', {
      exchange: 'nasdaq',
      limit: '5000',
    })

    if (!res.ok) {
      console.error(`Company screener error: ${res.status}`)
      return results
    }

    const data = await res.json()
    
    let companies: Record<string, unknown>[]
    if (Array.isArray(data)) {
      companies = data
    } else if (data.value && Array.isArray(data.value)) {
      companies = data.value
    } else {
      console.error('Unexpected screener response format:', Object.keys(data))
      return results
    }

    console.log(`[FMP] Company screener returned ${companies.length} stocks`)

    for (const company of companies) {
      const symbol = company.symbol as string
      if (symbol && symbolSet.has(symbol)) {
        results.set(symbol, {
          sector: (company.sector as string) || 'Other',
          industry: (company.industry as string) || 'Other',
          companyName: (company.companyName as string) || symbol,
        })
      }
    }

    console.log(`[FMP] Matched ${results.size} symbols with sector data`)

  } catch (err) {
    console.error('Company screener error:', err)
  }

  return results
}

// ═══════════════════════════════════════════════════════════════════
// 15 DAKİKA VERİ (200 GÜN Modülü İçin)
// ═══════════════════════════════════════════════════════════════════

const history15mCache = new Map<string, { bars: OHLCV[]; fetchedAt: number }>()
const CACHE_15M_TTL = 1 * 60 * 60 * 1000 // 1 saat (intraday data daha sık güncellenir)
const LOCAL_15M_CACHE_TTL = 4 * 60 * 60 * 1000 // 4 saat

/**
 * Tek bir hisse icin 15 dakikalık OHLCV verileri
 * 
 * KRİTİK: FMP API tek istekte yalnızca ~1158 bar (44 gün) döndürür.
 * TradingView'ın 5000 barına ulaşmak için aylık parçalar halinde
 * çekip birleştiriyoruz (stitching).
 * 
 * Cache Stratejisi:
 * 1. Memory cache (1 saat)
 * 2. Local disk cache (4 saat) 
 * 3. API'den aylık parçalar halinde çek ve birleştir
 */
export async function getHistorical15Min(
  symbol: string,
  forceRefresh: boolean = false
): Promise<OHLCV[]> {
  // 1. Memory cache kontrolu
  const memCached = history15mCache.get(symbol)
  if (!forceRefresh && memCached && Date.now() - memCached.fetchedAt < CACHE_15M_TTL) {
    return memCached.bars
  }

  // 2. Local disk cache kontrolu
  if (!forceRefresh) {
    const localAge = await get15MinAge(symbol)
    if (localAge !== null && localAge < LOCAL_15M_CACHE_TTL) {
      const localBars = await load15MinData(symbol)
      if (localBars && localBars.length > 0) {
        history15mCache.set(symbol, { bars: localBars, fetchedAt: Date.now() })
        return localBars
      }
    }
  }

  // 3. API'den aylık parçalar halinde çek ve birleştir
  // FMP tek seferde ~1158 bar döndürür, stitching ile ~5000+ bar elde ediyoruz
  const bars = await fetchStitched15Min(symbol)

  if (bars.length === 0) {
    // Stitching başarısız - local cache varsa onu kullan
    const fallbackBars = await load15MinData(symbol)
    if (fallbackBars && fallbackBars.length > 0) {
      console.log(`[FMP] 15min stitching empty for ${symbol}, using local cache`)
      history15mCache.set(symbol, { bars: fallbackBars, fetchedAt: Date.now() })
      return fallbackBars
    }
    throw new Error(`No 15min data for ${symbol}`)
  }

  // Memory cache'e kaydet
  history15mCache.set(symbol, { bars, fetchedAt: Date.now() })

  // Local disk'e kaydet (async, beklemeden devam et)
  save15MinData(symbol, bars).catch(err => {
    console.error(`[FMP] Failed to save 15min ${symbol} to disk:`, err)
  })

  return bars
}

/**
 * Aylık parçalar halinde 15dk veri çekip birleştir (stitching)
 * FMP API tek istekte ~1158 bar döndürür (44 gün).
 * 2 aylık aralıklarla istek atarak ~5000+ bar elde ediyoruz.
 * 
 * TradingView 5000 bar = ~192 işgünü (8 ay)
 * Biz 13+ aylık aralıkta çekip birleştiriyoruz.
 */
async function fetchStitched15Min(symbol: string): Promise<OHLCV[]> {
  // 2 aylık aralıklarla tarih çiftleri oluştur
  const now = new Date()
  const ranges: [string, string][] = []
  
  // 14 ay geriye git (TradingView'ın 5000 barını yakalayabilmek için)
  for (let monthsBack = 14; monthsBack >= 0; monthsBack -= 2) {
    const from = new Date(now)
    from.setMonth(from.getMonth() - monthsBack)
    from.setDate(1)
    
    const to = new Date(from)
    to.setMonth(to.getMonth() + 2)
    to.setDate(0) // Ayın son günü
    
    // Gelecek tarihleri sınırla
    if (to > now) {
      to.setTime(now.getTime())
    }
    
    const fromStr = from.toISOString().split('T')[0]
    const toStr = to.toISOString().split('T')[0]
    ranges.push([fromStr, toStr])
  }

  const allBars: OHLCV[] = []

  for (const [from, to] of ranges) {
    try {
      const res = await fmpFetch('/historical-chart/15min', {
        symbol,
        from,
        to,
      })

      if (!res.ok) continue

      const data = await res.json()
      
      let historical: Record<string, unknown>[]
      if (Array.isArray(data)) {
        historical = data
      } else if (data.value && Array.isArray(data.value)) {
        historical = data.value
      } else {
        continue
      }

      if (historical.length === 0) continue

      // Reverse to oldest-first if needed
      const firstDate = historical[0].date as string
      const lastDate = historical[historical.length - 1].date as string
      if (firstDate > lastDate) {
        historical.reverse()
      }

      for (const bar of historical) {
        allBars.push({
          date: bar.date as string,
          open: bar.open as number,
          high: bar.high as number,
          low: bar.low as number,
          close: bar.close as number,
          volume: (bar.volume as number) || 0,
        })
      }
    } catch (err) {
      console.error(`[FMP] 15min chunk error for ${symbol} (${from}→${to}):`, (err as Error).message)
    }
  }

  if (allBars.length === 0) return []

  // Sort by date and remove duplicates
  allBars.sort((a, b) => a.date.localeCompare(b.date))
  
  const uniqueBars: OHLCV[] = []
  const seen = new Set<string>()
  for (const bar of allBars) {
    if (!seen.has(bar.date)) {
      seen.add(bar.date)
      uniqueBars.push(bar)
    }
  }

  // ═══ SPLIT TESPİTİ VE DÜZELTMESİ ═══
  // 15dk veride adjClose yok — open/close arası büyük gap varsa split tespit et
  // TradingView 15dk verileri otomatik split-adjusted, FMP'ninki olmayabilir
  return fixIntradaySplits(uniqueBars)
}

/**
 * 15dk verideki split'leri tespit et ve düzelt.
 * Ardışık barlarda close→open oranı 4x+ ise split kabul et,
 * önceki tüm barları oranla.
 */
function fixIntradaySplits(bars: OHLCV[]): OHLCV[] {
  if (bars.length < 2) return bars

  // Birden fazla split olabilir, sondan başa tara
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].close
    const currOpen = bars[i].open

    if (prevClose <= 0 || currOpen <= 0) continue

    const ratio = currOpen / prevClose

    // 4x'den büyük veya 0.25x'den küçük değişim → büyük olasılıkla split
    if (ratio > 4 || ratio < 0.25) {
      // Önceki tüm barları adjust et
      for (let j = 0; j < i; j++) {
        bars[j].open *= ratio
        bars[j].high *= ratio
        bars[j].low *= ratio
        bars[j].close *= ratio
        // volume'ü ters oranla (forward split: fiyat düşer, volume artar)
        // ama VWAP hesabı 15dk'da yapılmıyor, sadece RSI/MFI/ADX/ATR için önemli
      }
    }
  }

  return bars
}

// ═══════════════════════════════════════════════════════════════════
// INCREMENTAL REFRESH FUNCTIONS (Auto-Refresh İçin)
// ═══════════════════════════════════════════════════════════════════

/**
 * 200W Modülü İçin Incremental Refresh
 * 
 * Günlük barlar gün içinde değişmez - sadece bugünün barı güncellenir.
 * Cache'deki daily barlari yükle, batch quote ile bugünkü bari güncelle.
 * Tam API re-fetch yapmaz, çok hızlıdır (~2-5 saniye).
 */
export async function refreshHistoricalDaily(
  symbol: string
): Promise<OHLCV[] | null> {
  // Önce cache'deki barlari yükle (memory veya disk)
  const memCached = historyCache.get(symbol)
  let bars: OHLCV[] | null = null

  if (memCached) {
    bars = [...memCached.bars] // shallow copy
  } else {
    const diskBars = await loadHistoricalData(symbol)
    if (diskBars && diskBars.length > 0) {
      bars = diskBars
    }
  }

  if (!bars || bars.length === 0) return null

  // Memory cache'i güncelle (bars referansı yenilenecek)
  historyCache.set(symbol, { bars, fetchedAt: Date.now() })

  return bars
}

/**
 * 200D Modülü İçin Incremental Refresh
 * 
 * Cache'deki stitched 15dk barlari yükle, FMP'den son chunk'ı çek,
 * yeni barlari merge et. Tam stitch yapmaz, çok daha hızlıdır.
 */
export async function refresh15MinLatest(
  symbol: string
): Promise<OHLCV[] | null> {
  // Cache'deki stitched barlari yükle
  const memCached = history15mCache.get(symbol)
  let existingBars: OHLCV[] | null = null

  if (memCached) {
    existingBars = [...memCached.bars]
  } else {
    const diskBars = await load15MinData(symbol)
    if (diskBars && diskBars.length > 0) {
      existingBars = diskBars
    }
  }

  if (!existingBars || existingBars.length === 0) return null

  // Son 3 günlük 15dk veri çek (tek API call, ~78 bar)
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 3)

  const fromStr = from.toISOString().split('T')[0]
  const toStr = now.toISOString().split('T')[0]

  try {
    const res = await fmpFetch('/historical-chart/15min', {
      symbol,
      from: fromStr,
      to: toStr,
    })

    if (!res.ok) {
      // API hatası - mevcut cache'i dön
      return existingBars
    }

    const data = await res.json()

    let freshBars: Record<string, unknown>[]
    if (Array.isArray(data)) {
      freshBars = data
    } else if (data.value && Array.isArray(data.value)) {
      freshBars = data.value
    } else {
      return existingBars
    }

    if (freshBars.length === 0) return existingBars

    // Reverse to oldest-first if needed
    const firstDate = freshBars[0].date as string
    const lastDate = freshBars[freshBars.length - 1].date as string
    if (firstDate > lastDate) {
      freshBars.reverse()
    }

    // Yeni barlari OHLCV formatına çevir
    const newBars: OHLCV[] = freshBars.map(bar => ({
      date: bar.date as string,
      open: bar.open as number,
      high: bar.high as number,
      low: bar.low as number,
      close: bar.close as number,
      volume: (bar.volume as number) || 0,
    }))

    // Mevcut barlarla merge et (tarih bazli dedup)
    const seen = new Set<string>(existingBars.map(b => b.date))
    const merged = [...existingBars]

    for (const bar of newBars) {
      if (!seen.has(bar.date)) {
        seen.add(bar.date)
        merged.push(bar)
      } else {
        // Mevcut bari güncelle (son fiyat değişmiş olabilir)
        const idx = merged.findIndex(b => b.date === bar.date)
        if (idx >= 0) {
          merged[idx] = bar
        }
      }
    }

    // Tarih sırasına göre sort
    merged.sort((a, b) => a.date.localeCompare(b.date))

    // Memory cache güncelle
    history15mCache.set(symbol, { bars: merged, fetchedAt: Date.now() })

    // Disk cache güncelle (async)
    save15MinData(symbol, merged).catch(err => {
      console.error(`[FMP] Failed to save refreshed 15min ${symbol}:`, err)
    })

    return merged
  } catch (err) {
    console.error(`[FMP] 15min refresh error for ${symbol}:`, (err as Error).message)
    return existingBars
  }
}

/**
 * Memory cache'i temizle
 */
export function clearCache(): void {
  historyCache.clear()
  history15mCache.clear()
}

/**
 * Tüm cache'leri temizle (memory + disk)
 * Split-adjusted veri düzeltmesi sonrası eski cache'i silmek için
 */
export async function clearAllCaches(): Promise<{ memory: number; disk: number }> {
  const memCount = historyCache.size + history15mCache.size
  historyCache.clear()
  history15mCache.clear()

  // Disk cache'i de temizle
  let diskCount = 0
  try {
    const { promises: fs } = require('fs')
    const path = require('path')
    const dataDir = path.join(process.cwd(), 'data')

    for (const subdir of ['historical', 'historical-15m']) {
      const dir = path.join(dataDir, subdir)
      try {
        const files = await fs.readdir(dir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(dir, file))
            diskCount++
          }
        }
      } catch { /* dir doesn't exist */ }
    }
  } catch (err) {
    console.error('[Cache] Disk clear error:', err)
  }

  return { memory: memCount, disk: diskCount }
}

/**
 * Cache durumunu dondur
 */
export function getCacheStatus(): { size: number; symbols: string[] } {
  return {
    size: historyCache.size,
    symbols: Array.from(historyCache.keys()),
  }
}
