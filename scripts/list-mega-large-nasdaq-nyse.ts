/**
 * FMP API uzerinden NASDAQ ve NYSE'deki MEGA ve LARGE sirketlerin sayisi ve listesi
 * 
 * Segment tanimlari (hermes-project):
 * MEGA: marketCap >= $200B
 * LARGE: $10B <= marketCap < $200B
 * 
 * Calistir: npx tsx scripts/list-mega-large-nasdaq-nyse.ts
 */

const FMP_BASE = 'https://financialmodelingprep.com/stable'
const MEGA_MIN = 200_000_000_000   // $200B
const LARGE_MIN = 10_000_000_000   // $10B
const LARGE_MAX = 199_999_999_999   // < $200B

function getApiKey(): string {
  const key = process.env.FMP_API_KEY
  if (!key) throw new Error('FMP_API_KEY env variable not set. Add to .env.local or export.')
  return key
}

async function fetchExchangeQuotes(exchange: string): Promise<Array<{ symbol: string; name: string; marketCap: number; price: number }>> {
  const url = `${FMP_BASE}/batch-exchange-quote?exchange=${exchange}`
  const res = await fetch(url, { headers: { apikey: getApiKey() } })
  if (!res.ok) throw new Error(`FMP API error ${res.status}: ${res.statusText}`)
  const data = await res.json()
  const quotes = Array.isArray(data) ? data : data.value ?? []
  return quotes.map((q: { symbol?: string; name?: string; marketCap?: number; price?: number }) => ({
    symbol: q.symbol || '',
    name: q.name || q.symbol || '',
    marketCap: Number(q.marketCap) || 0,
    price: Number(q.price) || 0,
  }))
}

function formatMcap(mcap: number): string {
  if (mcap >= 1e12) return `$${(mcap / 1e12).toFixed(2)}T`
  if (mcap >= 1e9) return `$${(mcap / 1e9).toFixed(2)}B`
  if (mcap >= 1e6) return `$${(mcap / 1e6).toFixed(2)}M`
  return `$${mcap.toFixed(0)}`
}

async function main() {
  // .env.local yukle (hermes-scanner root)
  try {
    const fs = await import('fs')
    const path = await import('path')
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/)
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch { /* ignore */ }

  console.log('FMP API ile NASDAQ ve NYSE MEGA/LARGE sirketler cekiliyor...\n')

  const [nasdaqQuotes, nyseQuotes] = await Promise.all([
    fetchExchangeQuotes('NASDAQ'),
    fetchExchangeQuotes('NYSE'),
  ])

  const nasdaqMega = nasdaqQuotes.filter(q => q.marketCap >= MEGA_MIN).sort((a, b) => b.marketCap - a.marketCap)
  const nasdaqLarge = nasdaqQuotes.filter(q => q.marketCap >= LARGE_MIN && q.marketCap < LARGE_MAX).sort((a, b) => b.marketCap - a.marketCap)
  const nyseMega = nyseQuotes.filter(q => q.marketCap >= MEGA_MIN).sort((a, b) => b.marketCap - a.marketCap)
  const nyseLarge = nyseQuotes.filter(q => q.marketCap >= LARGE_MIN && q.marketCap < LARGE_MAX).sort((a, b) => b.marketCap - a.marketCap)

  console.log('=== OZET ===')
  console.log('')
  console.log('NASDAQ:')
  console.log(`  MEGA (>= $200B): ${nasdaqMega.length}`)
  console.log(`  LARGE ($10B-$200B): ${nasdaqLarge.length}`)
  console.log(`  Toplam MEGA+LARGE: ${nasdaqMega.length + nasdaqLarge.length}`)
  console.log('')
  console.log('NYSE:')
  console.log(`  MEGA (>= $200B): ${nyseMega.length}`)
  console.log(`  LARGE ($10B-$200B): ${nyseLarge.length}`)
  console.log(`  Toplam MEGA+LARGE: ${nyseMega.length + nyseLarge.length}`)
  console.log('')
  console.log('GENEL TOPLAM:')
  const totalMega = nasdaqMega.length + nyseMega.length
  const totalLarge = nasdaqLarge.length + nyseLarge.length
  console.log(`  MEGA: ${totalMega}`)
  console.log(`  LARGE: ${totalLarge}`)
  console.log(`  Toplam: ${totalMega + totalLarge}`)
  console.log('')

  console.log('=== NASDAQ MEGA ===')
  nasdaqMega.forEach((q, i) => console.log(`  ${i + 1}. ${q.symbol.padEnd(8)} ${q.name.slice(0, 35).padEnd(36)} ${formatMcap(q.marketCap)}`))

  console.log('')
  console.log('=== NASDAQ LARGE ===')
  nasdaqLarge.forEach((q, i) => console.log(`  ${i + 1}. ${q.symbol.padEnd(8)} ${q.name.slice(0, 35).padEnd(36)} ${formatMcap(q.marketCap)}`))

  console.log('')
  console.log('=== NYSE MEGA ===')
  nyseMega.forEach((q, i) => console.log(`  ${i + 1}. ${q.symbol.padEnd(8)} ${q.name.slice(0, 35).padEnd(36)} ${formatMcap(q.marketCap)}`))

  console.log('')
  console.log('=== NYSE LARGE ===')
  nyseLarge.forEach((q, i) => console.log(`  ${i + 1}. ${q.symbol.padEnd(8)} ${q.name.slice(0, 35).padEnd(36)} ${formatMcap(q.marketCap)}`))

  // JSON cikti (opsiyonel - kopyala kullan)
  console.log('\n=== Sadece semboller (CSV) ===')
  const allSymbols = [
    ...nasdaqMega.map(q => q.symbol),
    ...nasdaqLarge.map(q => q.symbol),
    ...nyseMega.map(q => q.symbol),
    ...nyseLarge.map(q => q.symbol),
  ]
  console.log('NASDAQ MEGA:', nasdaqMega.map(q => q.symbol).join(', '))
  console.log('NASDAQ LARGE:', nasdaqLarge.map(q => q.symbol).join(', '))
  console.log('NYSE MEGA:', nyseMega.map(q => q.symbol).join(', '))
  console.log('NYSE LARGE:', nyseLarge.map(q => q.symbol).join(', '))
}

main().catch(e => {
  console.error('Hata:', e.message)
  process.exit(1)
})
