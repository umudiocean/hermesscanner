// ═══════════════════════════════════════════════════════════════════
// HERMES Scanner - Local Data Store
// Historical verileri locale kaydet, backtest icin sakla
// ═══════════════════════════════════════════════════════════════════

import { promises as fs } from 'fs'
import path from 'path'
import { OHLCV, ScanResult } from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const HISTORICAL_DIR = path.join(DATA_DIR, 'historical')
const HISTORICAL_15M_DIR = path.join(DATA_DIR, 'historical-15m')
const SCANS_DIR = path.join(DATA_DIR, 'scans')
const SCANS_200D_DIR = path.join(DATA_DIR, 'scans-200d')

/** Dizinlerin var oldugundan emin ol */
async function ensureDirs(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(HISTORICAL_DIR, { recursive: true })
  await fs.mkdir(HISTORICAL_15M_DIR, { recursive: true })
  await fs.mkdir(SCANS_DIR, { recursive: true })
  await fs.mkdir(SCANS_200D_DIR, { recursive: true })
}

/** Tek bir hissenin historical verisini kaydet */
export async function saveHistoricalData(symbol: string, bars: OHLCV[]): Promise<void> {
  await ensureDirs()
  const filePath = path.join(HISTORICAL_DIR, `${symbol}.json`)
  await fs.writeFile(filePath, JSON.stringify({
    symbol,
    lastUpdated: new Date().toISOString(),
    barCount: bars.length,
    dateRange: {
      from: bars[0]?.date || null,
      to: bars[bars.length - 1]?.date || null,
    },
    bars,
  }, null, 2))
}

/** Tek bir hissenin historical verisini oku */
export async function loadHistoricalData(symbol: string): Promise<OHLCV[] | null> {
  try {
    const filePath = path.join(HISTORICAL_DIR, `${symbol}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    return data.bars || null
  } catch {
    return null
  }
}

/** Historical verinin ne kadar eski oldugunu kontrol et */
export async function getHistoricalAge(symbol: string): Promise<number | null> {
  try {
    const filePath = path.join(HISTORICAL_DIR, `${symbol}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    if (data.lastUpdated) {
      return Date.now() - new Date(data.lastUpdated).getTime()
    }
    return null
  } catch {
    return null
  }
}

/** Birden fazla hissenin historical verisini toplu kaydet */
export async function saveMultipleHistorical(dataMap: Map<string, OHLCV[]>): Promise<number> {
  await ensureDirs()
  let saved = 0
  
  for (const [symbol, bars] of dataMap) {
    try {
      await saveHistoricalData(symbol, bars)
      saved++
    } catch (err) {
      console.error(`Failed to save ${symbol}:`, err)
    }
  }
  
  return saved
}

/** Mevcut historical dosyalarini listele */
export async function listHistoricalSymbols(): Promise<string[]> {
  try {
    await ensureDirs()
    const files = await fs.readdir(HISTORICAL_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  } catch {
    return []
  }
}

/** Scan sonuclarini kaydet */
export async function saveScanToFile(scanId: string, results: ScanResult[]): Promise<void> {
  await ensureDirs()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(SCANS_DIR, `scan_${timestamp}_${scanId}.json`)
  
  await fs.writeFile(filePath, JSON.stringify({
    scanId,
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    strongLongs: results.filter(r => r.hermes.signalType === 'strong_long').length,
    strongShorts: results.filter(r => r.hermes.signalType === 'strong_short').length,
    results,
  }, null, 2))
}

/** En son scan sonuclarini oku */
export async function loadLatestScan(): Promise<ScanResult[] | null> {
  try {
    await ensureDirs()
    const files = await fs.readdir(SCANS_DIR)
    const scanFiles = files.filter(f => f.startsWith('scan_') && f.endsWith('.json'))
    
    if (scanFiles.length === 0) return null
    
    // En yeni dosyayi bul
    scanFiles.sort().reverse()
    const latestFile = scanFiles[0]
    
    const content = await fs.readFile(path.join(SCANS_DIR, latestFile), 'utf-8')
    const data = JSON.parse(content)
    return data.results || null
  } catch {
    return null
  }
}

/** Historical veri istatistiklerini getir */
export async function getDataStats(): Promise<{
  totalSymbols: number
  totalBars: number
  oldestData: string | null
  newestData: string | null
}> {
  const symbols = await listHistoricalSymbols()
  let totalBars = 0
  let oldestData: string | null = null
  let newestData: string | null = null
  
  for (const symbol of symbols.slice(0, 100)) { // Ilk 100 dosyayi kontrol et
    try {
      const filePath = path.join(HISTORICAL_DIR, `${symbol}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      
      totalBars += data.barCount || 0
      
      if (data.dateRange?.from) {
        if (!oldestData || data.dateRange.from < oldestData) {
          oldestData = data.dateRange.from
        }
      }
      if (data.dateRange?.to) {
        if (!newestData || data.dateRange.to > newestData) {
          newestData = data.dateRange.to
        }
      }
    } catch {
      // Skip
    }
  }
  
  return {
    totalSymbols: symbols.length,
    totalBars,
    oldestData,
    newestData,
  }
}

/** Eski scan dosyalarini temizle (son 10 tane haric) */
export async function cleanupOldScans(keepCount: number = 10): Promise<number> {
  try {
    await ensureDirs()
    const files = await fs.readdir(SCANS_DIR)
    const scanFiles = files.filter(f => f.startsWith('scan_') && f.endsWith('.json'))
    
    if (scanFiles.length <= keepCount) return 0
    
    scanFiles.sort().reverse()
    const toDelete = scanFiles.slice(keepCount)
    
    for (const file of toDelete) {
      await fs.unlink(path.join(SCANS_DIR, file))
    }
    
    return toDelete.length
  } catch {
    return 0
  }
}

// ═══════════════════════════════════════════════════════════════════
// 15 DAKİKA VERİ FONKSİYONLARI (200 GÜN Modülü İçin)
// ═══════════════════════════════════════════════════════════════════

/** Tek bir hissenin 15-dakika historical verisini kaydet */
export async function save15MinData(symbol: string, bars: OHLCV[]): Promise<void> {
  await ensureDirs()
  const filePath = path.join(HISTORICAL_15M_DIR, `${symbol}.json`)
  await fs.writeFile(filePath, JSON.stringify({
    symbol,
    lastUpdated: new Date().toISOString(),
    barCount: bars.length,
    dateRange: {
      from: bars[0]?.date || null,
      to: bars[bars.length - 1]?.date || null,
    },
    bars,
  }, null, 2))
}

/** Tek bir hissenin 15-dakika historical verisini oku */
export async function load15MinData(symbol: string): Promise<OHLCV[] | null> {
  try {
    const filePath = path.join(HISTORICAL_15M_DIR, `${symbol}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    return data.bars || null
  } catch {
    return null
  }
}

/** 15-dakika verinin ne kadar eski oldugunu kontrol et */
export async function get15MinAge(symbol: string): Promise<number | null> {
  try {
    const filePath = path.join(HISTORICAL_15M_DIR, `${symbol}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content)
    if (data.lastUpdated) {
      return Date.now() - new Date(data.lastUpdated).getTime()
    }
    return null
  } catch {
    return null
  }
}
