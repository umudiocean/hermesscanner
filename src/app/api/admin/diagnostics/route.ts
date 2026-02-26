import { NextRequest, NextResponse } from 'next/server'
import { isRedisAvailable, getRedis } from '@/lib/cache/redis-client'
import { getBootstrapProgress, getBootstrapCheckpoint, getBootstrapSkipped, getBarCacheCount } from '@/lib/cache/redis-cache'
import { getCleanSymbols } from '@/lib/symbols'
import { providerMonitor } from '@/lib/monitor/provider-monitor'

export const maxDuration = 30

interface DiagnosticIssue {
  severity: 'critical' | 'warning' | 'info'
  module: string
  message: string
  detail?: string
  timestamp: string
}

export async function GET(request: NextRequest) {
  const issues: DiagnosticIssue[] = []
  const now = new Date().toISOString()
  const modules: Record<string, { status: 'ok' | 'warning' | 'error'; lastUpdate: string | null; detail: string }> = {}

  try {
    // 1. Redis check
    const redisOk = isRedisAvailable()
    modules['Redis'] = {
      status: redisOk ? 'ok' : 'error',
      lastUpdate: null,
      detail: redisOk ? 'Connected' : 'DISCONNECTED - All cron/scan disabled',
    }
    if (!redisOk) {
      issues.push({ severity: 'critical', module: 'Redis', message: 'Redis baglantisi yok — tum cron/scan devre disi', timestamp: now })
    }

    // 2. Bootstrap status
    const allSymbols = getCleanSymbols('ALL')
    const total = allSymbols.length
    let bootstrapStatus = 'unknown'
    let barCount = 0
    let completedCount = 0
    let skippedCount = 0
    let missingCount = 0

    if (redisOk) {
      const [progress, checkpoint, skipped, bc] = await Promise.all([
        getBootstrapProgress(),
        getBootstrapCheckpoint(),
        getBootstrapSkipped(),
        getBarCacheCount(),
      ])
      barCount = bc
      completedCount = checkpoint?.length ?? 0
      skippedCount = skipped?.length ?? 0
      missingCount = total - completedCount - skippedCount

      if (progress?.status === 'complete' || (completedCount + skippedCount >= total * 0.95)) {
        bootstrapStatus = 'complete'
      } else if (completedCount > 0) {
        bootstrapStatus = 'partial'
      } else {
        bootstrapStatus = 'not_started'
      }

      modules['Bootstrap'] = {
        status: bootstrapStatus === 'complete' ? 'ok' : bootstrapStatus === 'partial' ? 'warning' : 'error',
        lastUpdate: progress?.startedAt ?? null,
        detail: `${completedCount}/${total} cached, ${skippedCount} skipped, ${missingCount} missing, barCache=${barCount}`,
      }

      if (bootstrapStatus !== 'complete') {
        issues.push({
          severity: 'warning',
          module: 'Bootstrap',
          message: `Bootstrap ${bootstrapStatus}: ${completedCount}/${total} hisse yuklu`,
          detail: `${missingCount} hisse eksik. auto-cron her 5dk'da devam edecek.`,
          timestamp: now,
        })
      }
    }

    // 3. Provider status
    const [fmpStatus, cgStatus] = await Promise.all([
      providerMonitor.getProviderStatus('fmp'),
      providerMonitor.getProviderStatus('coingecko'),
    ])

    modules['FMP API'] = {
      status: fmpStatus.ok ? 'ok' : 'error',
      lastUpdate: fmpStatus.lastSuccessAt,
      detail: `OK=${fmpStatus.ok}, ErrorRate=${(fmpStatus.errorRate1h * 100).toFixed(1)}%, 429Rate=${(fmpStatus.http429Rate1h * 100).toFixed(1)}%`,
    }
    if (!fmpStatus.ok && fmpStatus.lastSuccessAt) {
      issues.push({ severity: 'critical', module: 'FMP API', message: 'FMP API hatali', detail: `Son basarili: ${fmpStatus.lastSuccessAt}`, timestamp: now })
    }

    modules['CoinGecko API'] = {
      status: cgStatus.ok ? 'ok' : cgStatus.lastSuccessAt ? 'warning' : 'error',
      lastUpdate: cgStatus.lastSuccessAt,
      detail: `OK=${cgStatus.ok}, ErrorRate=${(cgStatus.errorRate1h * 100).toFixed(1)}%`,
    }

    // 4. Data freshness
    const freshness = await providerMonitor.getDataFreshness()
    
    modules['NASDAQ Scan'] = {
      status: freshness.scanAgeMin !== null ? (freshness.scanAgeMin < 60 ? 'ok' : 'warning') : 'error',
      lastUpdate: freshness.scanAgeMin !== null ? `${freshness.scanAgeMin} dk once` : null,
      detail: freshness.scanAgeMin !== null ? `Son scan: ${freshness.scanAgeMin} dk once` : 'Hic scan yapilmamis',
    }
    if (freshness.scanAgeMin === null) {
      issues.push({ severity: 'critical', module: 'NASDAQ Scan', message: 'Hic scan yapilmamis — sinyaller guncel degil', timestamp: now })
    } else if (freshness.scanAgeMin > 60) {
      issues.push({ severity: 'warning', module: 'NASDAQ Scan', message: `Scan ${freshness.scanAgeMin} dk once — guncel olmayabilir`, timestamp: now })
    }

    modules['Stocks Quote'] = {
      status: freshness.stocksQuoteAgeMin !== null ? (freshness.stocksQuoteAgeMin < 15 ? 'ok' : 'warning') : 'error',
      lastUpdate: freshness.stocksQuoteAgeMin !== null ? `${freshness.stocksQuoteAgeMin} dk once` : null,
      detail: freshness.stocksQuoteAgeMin !== null ? `Son fiyat: ${freshness.stocksQuoteAgeMin} dk once` : 'Fiyat verisi yok',
    }

    modules['Crypto Market'] = {
      status: freshness.cryptoMarketAgeMin !== null ? 'ok' : 'warning',
      lastUpdate: freshness.cryptoMarketAgeMin !== null ? `${freshness.cryptoMarketAgeMin} dk once` : null,
      detail: freshness.cryptoMarketAgeMin !== null ? `Son guncelleme: ${freshness.cryptoMarketAgeMin} dk once` : 'Crypto verisi bekleniyor',
    }

    // 5. Cron status - check last cron runs
    if (redisOk) {
      try {
        const r = getRedis()!
        const [lastAutoRun, lastStockRefresh, lastCryptoRefresh] = await Promise.all([
          r.get('cron:auto:lastRunAt'),
          r.get('cron:refresh:stocks:lastRunAt'),
          r.get('cron:refresh:crypto:lastRunAt'),
        ])

        modules['Cron Auto (5dk)'] = {
          status: lastAutoRun ? 'ok' : 'warning',
          lastUpdate: lastAutoRun as string | null,
          detail: lastAutoRun ? `Son calisma: ${lastAutoRun}` : 'Henuz calismadi (yeni deploy?)',
        }
        if (!lastAutoRun) {
          issues.push({ severity: 'warning', module: 'Cron Auto', message: 'Auto-cron henuz calismadi — Vercel cron baslatmayi bekliyor', timestamp: now })
        }

        modules['Cron Stocks'] = {
          status: lastStockRefresh ? 'ok' : 'warning',
          lastUpdate: lastStockRefresh as string | null,
          detail: lastStockRefresh ? `Son: ${lastStockRefresh}` : 'Henuz calismadi',
        }

        modules['Cron Crypto'] = {
          status: lastCryptoRefresh ? 'ok' : 'warning',
          lastUpdate: lastCryptoRefresh as string | null,
          detail: lastCryptoRefresh ? `Son: ${lastCryptoRefresh}` : 'Henuz calismadi',
        }
      } catch { /* ignore Redis errors */ }
    }

    // 6. Symbol count check
    modules['Sembol Evreni'] = {
      status: 'ok',
      lastUpdate: null,
      detail: `${total} hisse aktif (symbols.ts)`,
    }

    // Sort issues by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    const overallStatus = issues.some(i => i.severity === 'critical') ? 'critical' : issues.some(i => i.severity === 'warning') ? 'warning' : 'healthy'

    return NextResponse.json({
      status: overallStatus,
      issueCount: issues.length,
      criticalCount: issues.filter(i => i.severity === 'critical').length,
      warningCount: issues.filter(i => i.severity === 'warning').length,
      issues,
      modules,
      symbolCount: total,
      barCacheCount: barCount,
      timestamp: now,
    })
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      error: err.message,
      issues: [{ severity: 'critical' as const, module: 'Diagnostics', message: `Diagnostics hatasi: ${err.message}`, timestamp: now }],
      modules: {},
      timestamp: now,
    }, { status: 500 })
  }
}
