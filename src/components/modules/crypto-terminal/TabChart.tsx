'use client'

// HERMES AI CRYPTO TERMINAL — Tab: GRAFIK (K1: TradingView Lightweight Charts)
// Professional candlestick + volume + RSI/EMA overlays
// 6/6 AI Consensus: lightweight-charts v4.x

import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, BarChart3, Activity, Layers } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────

interface TabChartProps {
  coinId: string
  onSelectCoin: (id: string) => void
}

type TimeRange = '1' | '7' | '30' | '90' | '365' | 'max'

interface OHLCCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface VolumeBar {
  time: number
  value: number
  color: string
}

type ChartMode = 'candle' | 'line'
type IndicatorType = 'ema' | 'rsi' | 'bb' | 'macd'

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1', label: '24s' },
  { value: '7', label: '7g' },
  { value: '30', label: '1Ay' },
  { value: '90', label: '3Ay' },
  { value: '365', label: '1Y' },
  { value: 'max', label: 'Tumu' },
]

// ─── Technical Indicator Calculations (K4) ──────────────────────────

function calculateEMA(data: number[], period: number): (number | null)[] {
  if (data.length < period) return data.map(() => null)
  const k = 2 / (period + 1)
  const result: (number | null)[] = []
  let ema = data.slice(0, period).reduce((a, b) => a + b) / period
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (i === period - 1) {
      result.push(ema)
    } else {
      ema = data[i] * k + ema * (1 - k)
      result.push(ema)
    }
  }
  return result
}

function calculateRSI(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null)
  const result: (number | null)[] = []
  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    gains.push(diff > 0 ? diff : 0)
    losses.push(diff < 0 ? Math.abs(diff) : 0)
  }

  // First average
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period

  result.push(null) // index 0 has no change
  for (let i = 0; i < gains.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (i === period - 1) {
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    } else {
      avgGain = (avgGain * (period - 1) + gains[i]) / period
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }
  return result
}

function calculateBollingerBands(closes: number[], period = 20, mult = 2): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = []
  const middle: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null); middle.push(null); lower.push(null)
      continue
    }
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b) / period
    const std = Math.sqrt(slice.reduce((a, v) => a + (v - mean) ** 2, 0) / period)
    middle.push(mean)
    upper.push(mean + mult * std)
    lower.push(mean - mult * std)
  }
  return { upper, middle, lower }
}

function calculateMACD(closes: number[]): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)
  const macdLine: (number | null)[] = []

  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] != null && ema26[i] != null) {
      macdLine.push(ema12[i]! - ema26[i]!)
    } else {
      macdLine.push(null)
    }
  }

  const validMacd = macdLine.filter(v => v != null) as number[]
  const signalEma = calculateEMA(validMacd, 9)

  const signal: (number | null)[] = []
  const histogram: (number | null)[] = []
  let signalIdx = 0

  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] == null) {
      signal.push(null)
      histogram.push(null)
    } else {
      const s = signalEma[signalIdx] ?? null
      signal.push(s)
      histogram.push(s != null ? macdLine[i]! - s : null)
      signalIdx++
    }
  }

  return { macd: macdLine, signal, histogram }
}

// ─── Price Formatting ───────────────────────────────────────────────

function formatPrice(p: number): string {
  if (!p) return '$0'
  if (p >= 1000) return `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (p >= 1) return `$${p.toFixed(2)}`
  if (p >= 0.01) return `$${p.toFixed(4)}`
  return `$${p.toFixed(8)}`
}

// ─── Main Component ─────────────────────────────────────────────────

export default function TabChart({ coinId, onSelectCoin }: TabChartProps) {
  const [ohlcData, setOhlcData] = useState<OHLCCandle[]>([])
  const [volumeData, setVolumeData] = useState<VolumeBar[]>([])
  const [loading, setLoading] = useState(false)
  const [range, setRange] = useState<TimeRange>('30')
  const [searchInput, setSearchInput] = useState('')
  const [chartMode, setChartMode] = useState<ChartMode>('candle')
  const [indicators, setIndicators] = useState<Set<IndicatorType>>(new Set(['ema']))
  const [lastPrice, setLastPrice] = useState<number>(0)
  const [priceChange, setPriceChange] = useState<number>(0)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const macdContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const rsiChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const macdChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const resizeObserversRef = useRef<ResizeObserver[]>([])

  const toggleIndicator = useCallback((ind: IndicatorType) => {
    setIndicators(prev => {
      const next = new Set(prev)
      if (next.has(ind)) next.delete(ind)
      else next.add(ind)
      return next
    })
  }, [])

  // Fetch OHLC data
  useEffect(() => {
    if (!coinId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`/api/crypto-terminal/chart/${coinId}?days=${range}&type=both`)
        if (!res.ok) throw new Error('Chart data load failed')
        const data = await res.json()

        if (cancelled) return

        // Parse OHLC: CoinGecko returns [[ts, open, high, low, close], ...]
        const rawOhlc = data.ohlc ?? []
        const candles: OHLCCandle[] = rawOhlc.map((c: number[]) => ({
          time: Math.floor(c[0] / 1000) as number,
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
        }))

        // Remove duplicates by time (CoinGecko sometimes returns dups)
        const seen = new Set<number>()
        const uniqueCandles = candles.filter(c => {
          if (seen.has(c.time)) return false
          seen.add(c.time)
          return true
        }).sort((a, b) => a.time - b.time)

        setOhlcData(uniqueCandles)

        // Parse volume from market_chart
        const rawChart = data.chart ?? {}
        const prices = rawChart.prices ?? []
        const volumes = rawChart.total_volumes ?? []

        // Build volume bars aligned to OHLC
        const volBars: VolumeBar[] = []
        if (uniqueCandles.length > 0 && volumes.length > 0) {
          for (let i = 0; i < uniqueCandles.length; i++) {
            const c = uniqueCandles[i]
            // Find closest volume data point
            let closestVol = 0
            let minDist = Infinity
            for (const [ts, vol] of volumes) {
              const dist = Math.abs(Math.floor(ts / 1000) - c.time)
              if (dist < minDist) {
                minDist = dist
                closestVol = vol
              }
            }
            volBars.push({
              time: c.time as number,
              value: closestVol,
              color: c.close >= c.open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)',
            })
          }
        }
        setVolumeData(volBars)

        if (uniqueCandles.length > 0) {
          const last = uniqueCandles[uniqueCandles.length - 1]
          setLastPrice(last.close)
          if (uniqueCandles.length > 1) {
            const first = uniqueCandles[0]
            setPriceChange(((last.close - first.open) / first.open) * 100)
          }
        }
      } catch {
        setOhlcData([])
        setVolumeData([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [coinId, range])

  // Create/update chart
  useEffect(() => {
    if (!chartContainerRef.current || ohlcData.length < 2) return

    let isMounted = true

    async function renderChart() {
      const lc = await import('lightweight-charts')
      if (!isMounted || !chartContainerRef.current) return

      // Destroy previous chart
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      const chart = lc.createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: '#0d0d14' },
          textColor: '#9ca3af',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.03)' },
          horzLines: { color: 'rgba(255,255,255,0.03)' },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
          vertLine: { color: 'rgba(245,158,11,0.3)', width: 1, style: lc.LineStyle.Dashed },
          horzLine: { color: 'rgba(245,158,11,0.3)', width: 1, style: lc.LineStyle.Dashed },
        },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.06)',
          scaleMargins: { top: 0.05, bottom: 0.15 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.06)',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
        handleScale: { mouseWheel: true, pinch: true },
      })

      chartRef.current = chart

      // Main price series
      if (chartMode === 'candle') {
        const candleSeries = chart.addSeries(lc.CandlestickSeries, {
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        candleSeries.setData(ohlcData as any)
      } else {
        const closes = ohlcData.map(c => c.close)
        const isPositive = closes[closes.length - 1] >= closes[0]
        const lineSeries = chart.addSeries(lc.AreaSeries, {
          lineColor: isPositive ? '#22c55e' : '#ef4444',
          topColor: isPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          bottomColor: 'transparent',
          lineWidth: 2,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        lineSeries.setData(ohlcData.map(c => ({ time: c.time, value: c.close })) as any)
      }

      // Volume
      if (volumeData.length > 0) {
        const volSeries = chart.addSeries(lc.HistogramSeries, {
          priceScaleId: 'volume',
          priceFormat: { type: 'volume' },
        })
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        volSeries.setData(volumeData as any)
      }

      const closes = ohlcData.map(c => c.close)
      const times = ohlcData.map(c => c.time)

      // EMA overlays
      if (indicators.has('ema')) {
        const ema9 = calculateEMA(closes, 9)
        const ema21 = calculateEMA(closes, 21)
        const ema50 = calculateEMA(closes, 50)

        const addEma = (data: (number | null)[], color: string, title: string) => {
          const series = chart.addSeries(lc.LineSeries, {
            color,
            lineWidth: 1,
            title,
            priceLineVisible: false,
            lastValueVisible: false,
          })
          const lineData = data.map((v, i) => v != null ? { time: times[i], value: v } : null)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter(Boolean) as any[]
          series.setData(lineData)
        }

        addEma(ema9, '#f59e0b', 'EMA9')
        addEma(ema21, '#8b5cf6', 'EMA21')
        if (closes.length >= 50) addEma(ema50, '#06b6d4', 'EMA50')
      }

      // Bollinger Bands overlay
      if (indicators.has('bb')) {
        const bb = calculateBollingerBands(closes, 20, 2)
        const addBBLine = (data: (number | null)[], color: string, title: string) => {
          const series = chart.addSeries(lc.LineSeries, {
            color,
            lineWidth: 1,
            lineStyle: lc.LineStyle.Dotted,
            title,
            priceLineVisible: false,
            lastValueVisible: false,
          })
          const lineData = data.map((v, i) => v != null ? { time: times[i], value: v } : null)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .filter(Boolean) as any[]
          series.setData(lineData)
        }
        addBBLine(bb.upper, 'rgba(168,85,247,0.5)', 'BB Upper')
        addBBLine(bb.middle, 'rgba(168,85,247,0.3)', 'BB Mid')
        addBBLine(bb.lower, 'rgba(168,85,247,0.5)', 'BB Lower')
      }

      // Fit content
      chart.timeScale().fitContent()

      // Resize observer
      resizeObserversRef.current.forEach(ro => ro.disconnect())
      resizeObserversRef.current = []
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const { width } = entry.contentRect
          chart.applyOptions({ width })
        }
      })
      resizeObserver.observe(chartContainerRef.current)
      resizeObserversRef.current.push(resizeObserver)

      // RSI sub-chart
      if (indicators.has('rsi') && rsiContainerRef.current) {
        if (rsiChartRef.current) {
          rsiChartRef.current.remove()
          rsiChartRef.current = null
        }

        const rsiChart = lc.createChart(rsiContainerRef.current, {
          width: rsiContainerRef.current.clientWidth,
          height: 120,
          layout: { background: { color: '#0d0d14' }, textColor: '#9ca3af', fontSize: 10 },
          grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.05, bottom: 0.05 } },
          timeScale: { visible: false },
          crosshair: { mode: lc.CrosshairMode.Normal },
        })
        rsiChartRef.current = rsiChart

        const rsiValues = calculateRSI(closes, 14)
        const rsiSeries = rsiChart.addSeries(lc.LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          title: 'RSI(14)',
          priceLineVisible: false,
        })
        const rsiData = rsiValues.map((v, i) => v != null ? { time: times[i], value: v } : null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter(Boolean) as any[]
        rsiSeries.setData(rsiData)

        // RSI levels (30/70)
        const addLevel = (val: number, color: string) => {
          const s = rsiChart.addSeries(lc.LineSeries, {
            color, lineWidth: 1, lineStyle: lc.LineStyle.Dashed,
            priceLineVisible: false, lastValueVisible: false,
          })
          if (times.length >= 2) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            s.setData([
              { time: times[0], value: val },
              { time: times[times.length - 1], value: val },
            ] as any[])
          }
        }
        addLevel(70, 'rgba(239,68,68,0.3)')
        addLevel(30, 'rgba(34,197,94,0.3)')

        rsiChart.timeScale().fitContent()

        // Sync timescales
        chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
          if (logicalRange) rsiChart.timeScale().setVisibleLogicalRange(logicalRange)
        })

        const rsiResizeObs = new ResizeObserver(entries => {
          for (const entry of entries) rsiChart.applyOptions({ width: entry.contentRect.width })
        })
        rsiResizeObs.observe(rsiContainerRef.current)
        resizeObserversRef.current.push(rsiResizeObs)
      }

      // MACD sub-chart
      if (indicators.has('macd') && macdContainerRef.current) {
        if (macdChartRef.current) {
          macdChartRef.current.remove()
          macdChartRef.current = null
        }

        const macdChart = lc.createChart(macdContainerRef.current, {
          width: macdContainerRef.current.clientWidth,
          height: 120,
          layout: { background: { color: '#0d0d14' }, textColor: '#9ca3af', fontSize: 10 },
          grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
          timeScale: { visible: false },
          crosshair: { mode: lc.CrosshairMode.Normal },
        })
        macdChartRef.current = macdChart

        const macdData = calculateMACD(closes)

        // MACD histogram
        const histSeries = macdChart.addSeries(lc.HistogramSeries, {
          title: 'Hist',
          priceLineVisible: false,
        })
        const histData = macdData.histogram.map((v, i) => {
          if (v == null) return null
          return { time: times[i], value: v, color: v >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)' }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).filter(Boolean) as any[]
        histSeries.setData(histData)

        // MACD line
        const macdLineSeries = macdChart.addSeries(lc.LineSeries, {
          color: '#3b82f6', lineWidth: 1, title: 'MACD',
          priceLineVisible: false, lastValueVisible: false,
        })
        const macdLineData = macdData.macd.map((v, i) => v != null ? { time: times[i], value: v } : null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter(Boolean) as any[]
        macdLineSeries.setData(macdLineData)

        // Signal line
        const signalSeries = macdChart.addSeries(lc.LineSeries, {
          color: '#f97316', lineWidth: 1, title: 'Signal',
          priceLineVisible: false, lastValueVisible: false,
        })
        const signalData = macdData.signal.map((v, i) => v != null ? { time: times[i], value: v } : null)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter(Boolean) as any[]
        signalSeries.setData(signalData)

        macdChart.timeScale().fitContent()

        // Sync timescales
        chart.timeScale().subscribeVisibleLogicalRangeChange((logicalRange) => {
          if (logicalRange) macdChart.timeScale().setVisibleLogicalRange(logicalRange)
        })

        const macdResizeObs = new ResizeObserver(entries => {
          for (const entry of entries) macdChart.applyOptions({ width: entry.contentRect.width })
        })
        macdResizeObs.observe(macdContainerRef.current)
        resizeObserversRef.current.push(macdResizeObs)
      }
    }

    renderChart()

    return () => {
      isMounted = false
      resizeObserversRef.current.forEach(ro => ro.disconnect())
      resizeObserversRef.current = []
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
      if (rsiChartRef.current) { rsiChartRef.current.remove(); rsiChartRef.current = null }
      if (macdChartRef.current) { macdChartRef.current.remove(); macdChartRef.current = null }
    }
  }, [ohlcData, volumeData, chartMode, indicators])

  // ─── Empty state (no coin selected) ───────────────────────────────

  if (!coinId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <TrendingUp size={48} className="text-text-quaternary mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Coin Secin</h3>
        <p className="text-text-tertiary text-sm mb-6">Grafik gormek icin bir coin secin</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value.toLowerCase())}
            onKeyDown={e => { if (e.key === 'Enter' && searchInput) { onSelectCoin(searchInput); setSearchInput('') } }}
            placeholder="Orn: bitcoin, ethereum..."
            className="px-4 py-2 rounded-lg bg-surface-3 border border-stroke text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-500/40 w-56"
          />
          <button onClick={() => { if (searchInput) { onSelectCoin(searchInput); setSearchInput('') } }}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium">
            Git
          </button>
        </div>
      </div>
    )
  }

  // ─── Chart UI ─────────────────────────────────────────────────────

  const isPositive = priceChange >= 0

  return (
    <div className="space-y-1.5 sm:space-y-2 animate-fade-in">
      {/* Header: Price + Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-white">{coinId.toUpperCase()}</h3>
          {lastPrice > 0 && (
            <>
              <span className="text-base sm:text-lg font-bold text-white">{formatPrice(lastPrice)}</span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isPositive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 flex-wrap min-w-0">
          {/* Chart mode toggle */}
          <button
            onClick={() => setChartMode(chartMode === 'candle' ? 'line' : 'candle')}
            className={`p-1.5 rounded-xl text-[10px] transition-all duration-300 border ${chartMode === 'candle' ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/8 text-amber-300 border-amber-500/35 shadow-sm shadow-amber-500/10' : 'text-text-tertiary hover:text-amber-200/80 border-stroke-subtle hover:border-amber-500/20'}`}
            title={chartMode === 'candle' ? 'Mum Grafik' : 'Cizgi Grafik'}
          >
            <BarChart3 size={14} />
          </button>

          {/* Indicator toggles */}
          {(['ema', 'rsi', 'bb', 'macd'] as IndicatorType[]).map(ind => (
            <button
              key={ind}
              onClick={() => toggleIndicator(ind)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all duration-300 border ${
                indicators.has(ind)
                  ? 'bg-gradient-to-r from-violet-500/15 to-purple-500/8 text-violet-300 border-violet-500/35 shadow-sm shadow-violet-500/10'
                  : 'text-text-tertiary hover:text-violet-300/70 border-stroke-subtle hover:border-violet-500/20'
              }`}
            >
              {ind.toUpperCase()}
            </button>
          ))}

          <div className="w-px h-4 bg-white/10 mx-1" />

          {/* Time ranges */}
          {TIME_RANGES.map(tr => (
            <button
              key={tr.value}
              onClick={() => setRange(tr.value)}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all duration-300 ${
                range === tr.value
                  ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/8 text-amber-300 border border-amber-500/35 shadow-sm shadow-amber-500/10'
                  : 'text-text-tertiary hover:text-amber-200/80 border border-stroke-subtle hover:border-amber-500/20'
              }`}
            >
              {tr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-surface-1 rounded-2xl border border-stroke-subtle relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-1/90 z-10 rounded-2xl">
            <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </div>
        )}
        <div ref={chartContainerRef} className="w-full" />
        {ohlcData.length === 0 && !loading && (
          <div className="flex items-center justify-center h-[400px] text-text-tertiary text-sm">
            Grafik verisi bulunamadi
          </div>
        )}
      </div>

      {/* RSI Sub-chart */}
      {indicators.has('rsi') && ohlcData.length > 15 && (
        <div className="bg-surface-1 rounded-xl border border-stroke-subtle overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-stroke-subtle">
            <Activity size={12} className="text-amber-400/60" />
            <span className="text-[10px] font-medium text-text-tertiary">RSI (14)</span>
          </div>
          <div ref={rsiContainerRef} className="w-full" />
        </div>
      )}

      {/* MACD Sub-chart */}
      {indicators.has('macd') && ohlcData.length > 26 && (
        <div className="bg-surface-1 rounded-xl border border-stroke-subtle overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-stroke-subtle">
            <Layers size={12} className="text-blue-400/60" />
            <span className="text-[10px] font-medium text-text-tertiary">MACD (12, 26, 9)</span>
          </div>
          <div ref={macdContainerRef} className="w-full" />
        </div>
      )}

      {/* Quick Stats */}
      {ohlcData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
          {[
            { label: 'Acilis', value: formatPrice(ohlcData[0].open), color: 'text-text-secondary' },
            { label: 'En Yuksek', value: formatPrice(Math.max(...ohlcData.map(c => c.high))), color: 'text-emerald-400/70' },
            { label: 'En Dusuk', value: formatPrice(Math.min(...ohlcData.map(c => c.low))), color: 'text-red-400/70' },
            { label: 'Kapanis', value: formatPrice(ohlcData[ohlcData.length - 1].close), color: 'text-white' },
          ].map(stat => (
            <div key={stat.label} className="bg-surface-3 rounded-xl border border-stroke-subtle px-2 sm:px-3 py-1.5 sm:py-2 hover:border-stroke hover:shadow-md hover:shadow-black/20 transition-all duration-300">
              <div className="text-[9px] text-text-tertiary uppercase tracking-wider">{stat.label}</div>
              <div className={`text-xs sm:text-sm font-semibold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
