import { NextResponse } from 'next/server'
import { getCompanyProfiles } from '@/lib/fmp-client'
import { promises as fs } from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
const SECTORS_FILE = path.join(DATA_DIR, 'sectors.json')
const SECTORS_TTL = 7 * 24 * 60 * 60 * 1000 // 1 hafta - sektörler sık değişmez

export const maxDuration = 300 // 5 dakika timeout

// Sektör cache'i memory'de tut
let sectorCache: Map<string, string> | null = null
let sectorCacheTime = 0

async function loadSectorsFromDisk(): Promise<Map<string, string> | null> {
  try {
    const content = await fs.readFile(SECTORS_FILE, 'utf-8')
    const data = JSON.parse(content)
    
    // TTL kontrolü
    if (data.timestamp && Date.now() - new Date(data.timestamp).getTime() < SECTORS_TTL) {
      const map = new Map<string, string>()
      for (const [symbol, sector] of Object.entries(data.sectors)) {
        map.set(symbol, sector as string)
      }
      return map
    }
    return null
  } catch {
    return null
  }
}

async function saveSectorsToDisk(sectors: Map<string, string>): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    const obj: Record<string, string> = {}
    for (const [symbol, sector] of sectors) {
      obj[symbol] = sector
    }
    await fs.writeFile(SECTORS_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      count: sectors.size,
      sectors: obj,
    }, null, 2))
  } catch (err) {
    console.error('Failed to save sectors to disk:', err)
  }
}

export async function GET() {
  try {
    // Memory cache
    if (sectorCache && Date.now() - sectorCacheTime < SECTORS_TTL) {
      const obj: Record<string, string> = {}
      for (const [symbol, sector] of sectorCache) {
        obj[symbol] = sector
      }
      return NextResponse.json({ sectors: obj, fromCache: true, source: 'memory' })
    }

    // Disk cache
    const diskCache = await loadSectorsFromDisk()
    if (diskCache) {
      sectorCache = diskCache
      sectorCacheTime = Date.now()
      
      const obj: Record<string, string> = {}
      for (const [symbol, sector] of diskCache) {
        obj[symbol] = sector
      }
      return NextResponse.json({ sectors: obj, fromCache: true, source: 'disk' })
    }

    return NextResponse.json({ sectors: {}, fromCache: false, message: 'No cached sectors, use POST to fetch' })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get sectors', message: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const symbols: string[] = body.symbols || []

    if (symbols.length === 0) {
      return NextResponse.json({ error: 'No symbols provided' }, { status: 400 })
    }

    // FMP'den sektör bilgilerini çek
    const profiles = await getCompanyProfiles(symbols)
    
    const sectors = new Map<string, string>()
    for (const [symbol, profile] of profiles) {
      sectors.set(symbol, profile.sector || 'Other')
    }

    // Cache'e kaydet
    sectorCache = sectors
    sectorCacheTime = Date.now()
    
    // Disk'e kaydet
    await saveSectorsToDisk(sectors)

    const obj: Record<string, string> = {}
    for (const [symbol, sector] of sectors) {
      obj[symbol] = sector
    }

    return NextResponse.json({
      sectors: obj,
      fetched: profiles.size,
      total: symbols.length,
    })

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch sectors', message: (error as Error).message },
      { status: 500 }
    )
  }
}
