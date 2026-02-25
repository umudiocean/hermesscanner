// ═══════════════════════════════════════════════════════════════════════
// HERMES AI PREMIUM PDF REPORT GENERATOR
// Institutional-grade PDF reports with advanced visualizations
// ═══════════════════════════════════════════════════════════════════════

export interface PdfField {
  label: string
  value: string | number | null | undefined
  color?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'default'
  badge?: boolean
  icon?: string // Unicode icon
}

export interface PdfSection {
  title: string
  rows: PdfField[]
  icon?: string // Section icon
  columns?: 2 | 3 // Multi-column layout
}

export interface ChartData {
  labels: string[]
  values: number[]
  color: 'green' | 'red' | 'amber' | 'blue'
  type: 'line' | 'bar' | 'sparkline'
}

export interface WallStreetPulse {
  insiderActivity: {
    netBuys: number
    netSales: number
    recentClusterBuy: boolean
  }
  institutionalFlow: {
    netFlow: string
    majorBuyers: string[]
    trend: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL'
  }
  smartMoney: {
    score: number
    confidence: number
  }
}

export interface MacroEconomy {
  gdp: { latest: number; trend: string }
  sentiment: { index: number; label: string }
  fedPolicy: { rate: string; stance: string }
  inflation: { cpi: string; trend: string }
}

export interface SectorComparison {
  peers: Array<{
    symbol: string
    peRatio: number
    marketCap: string
    score: number
  }>
}

export interface TechnicalIndicators {
  rsi: { value: number; signal: string }
  macd: { value: number; signal: string }
  sma50: { value: number; position: string }
  sma200: { value: number; position: string }
}

interface DownloadPdfInput {
  fileName: string
  title: string
  subtitle?: string
  sections: PdfSection[]
  scoreSummary?: {
    total: number
    level: string
    confidence: number
    valuationLabel: string
  }
  // NEW: Enhanced data
  wallStreetPulse?: WallStreetPulse
  macroEconomy?: MacroEconomy
  sectorComparison?: SectorComparison
  technicalIndicators?: TechnicalIndicators
  priceChart?: ChartData
  scoreBreakdown?: Array<{ category: string; score: number; weight: number }>
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function safeValue(value: PdfField['value']): string {
  if (value == null) return '-'
  const s = String(value).trim()
  return s.length > 0 ? s : '-'
}

function getColorRgb(color: PdfField['color']): [number, number, number] {
  switch (color) {
    case 'green': return [34, 170, 150]
    case 'red': return [239, 68, 68]
    case 'amber': return [251, 191, 36]
    case 'blue': return [59, 130, 246]
    case 'purple': return [168, 85, 247]
    default: return [30, 30, 45]
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DRAWING PRIMITIVES - Premium Style
// ═══════════════════════════════════════════════════════════════════════

function drawGradientHeader(doc: any, title: string, subtitle: string, marginX: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 38

  // Gradient effect simulation (dark to darker)
  for (let i = 0; i < 70; i += 2) {
    const alpha = 1 - (i / 70) * 0.3
    doc.setFillColor(12, 12, 20, alpha * 255)
    doc.rect(0, i, pageWidth, 2, 'F')
  }

  // Gold accent bar - thicker and more prominent
  doc.setFillColor(180, 150, 90)
  doc.rect(marginX, 62, 100, 3, 'F')
  
  // Hermes icon placeholder (premium badge)
  doc.setFillColor(180, 150, 90)
  doc.circle(pageWidth - marginX - 20, 35, 12, 'F')
  doc.setFontSize(14)
  doc.setTextColor(12, 12, 20)
  doc.setFont('helvetica', 'bold')
  doc.text('H', pageWidth - marginX - 23, 40)

  // Main title - larger and bolder
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(255, 255, 255)
  doc.text(title, marginX, y)
  y += 18

  // Subtitle with icon
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(180, 180, 195)
  doc.text(`📊 ${subtitle}`, marginX, y)

  // Timestamp - right aligned
  doc.setTextColor(140, 140, 155)
  doc.setFontSize(8)
  const dateStr = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', month: 'long', day: 'numeric', 
    hour: '2-digit', minute: '2-digit', hour12: true 
  })
  doc.text(`Generated: ${dateStr}`, pageWidth - marginX, y, { align: 'right' })

  return 82
}

function drawPremiumScoreCard(
  doc: any, 
  x: number, 
  y: number, 
  summary: NonNullable<DownloadPdfInput['scoreSummary']>
): void {
  const boxW = 170
  const boxH = 70

  // Card shadow effect
  doc.setFillColor(0, 0, 0, 20)
  doc.roundedRect(x + 2, y + 2, boxW, boxH, 6, 6, 'F')

  // Card background with subtle gradient
  doc.setFillColor(18, 18, 28)
  doc.roundedRect(x, y, boxW, boxH, 6, 6, 'F')
  
  // Gold border
  doc.setDrawColor(180, 150, 90)
  doc.setLineWidth(1.5)
  doc.roundedRect(x, y, boxW, boxH, 6, 6, 'S')

  // Score - large and prominent
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(36)
  const scoreColor = summary.total >= 66 ? [98, 203, 193] : 
                     summary.total >= 33 ? [251, 191, 36] : [239, 68, 68]
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
  doc.text(String(Math.round(summary.total)), x + 25, y + 38)

  // Level badge
  doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2], 25)
  doc.roundedRect(x + 25, y + 45, 50, 16, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
  doc.setFont('helvetica', 'bold')
  doc.text(summary.level, x + 50, y + 56, { align: 'center' })

  // Metadata - right side
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 175)
  doc.text('Confidence', x + 100, y + 24)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(251, 191, 36)
  doc.text(`${summary.confidence}%`, x + 100, y + 38)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 175)
  doc.text('Valuation', x + 100, y + 48)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  const valColor = summary.valuationLabel === 'UCUZ' ? [98, 203, 193] :
                   summary.valuationLabel === 'PAHALI' ? [239, 68, 68] : [251, 191, 36]
  doc.setTextColor(valColor[0], valColor[1], valColor[2])
  doc.text(summary.valuationLabel, x + 100, y + 59)
}

function drawPremiumSectionHeader(
  doc: any, 
  title: string, 
  x: number, 
  y: number, 
  width: number,
  icon?: string
): number {
  // Section card background
  doc.setFillColor(22, 22, 35)
  doc.roundedRect(x - 4, y - 2, width + 8, 20, 4, 4, 'F')

  // Gold accent line
  doc.setFillColor(180, 150, 90)
  doc.rect(x - 4, y - 2, 4, 20, 'F')

  // Icon if provided
  if (icon) {
    doc.setFontSize(12)
    doc.text(icon, x + 4, y + 12)
  }

  // Title text
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(255, 255, 255)
  doc.text(title, x + (icon ? 20 : 8), y + 12)

  return y + 26
}

function drawPremiumFieldRow(
  doc: any, 
  label: string, 
  value: string, 
  x: number, 
  y: number, 
  color?: PdfField['color'],
  badge?: boolean
): number {
  // Label
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(140, 140, 155)
  doc.text(label, x, y)

  // Value styling
  const [r, g, b] = getColorRgb(color)
  doc.setTextColor(r, g, b)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)

  if (badge) {
    // Draw badge background
    const textWidth = doc.getTextWidth(value)
    doc.setFillColor(r, g, b, 25)
    doc.roundedRect(x + 120, y - 8, textWidth + 12, 14, 3, 3, 'F')
    doc.text(value, x + 126, y)
  } else {
    doc.text(value, x + 120, y)
  }

  return y + 14
}

// ═══════════════════════════════════════════════════════════════════════
// ADVANCED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

function drawMiniSparkline(
  doc: any,
  x: number,
  y: number,
  width: number,
  height: number,
  data: number[],
  color: 'green' | 'red' | 'amber'
): void {
  if (data.length < 2) return

  const [r, g, b] = getColorRgb(color)
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  // Draw area fill
  doc.setFillColor(r, g, b, 15)
  const points: Array<[number, number]> = []
  data.forEach((val, i) => {
    const px = x + (i / (data.length - 1)) * width
    const py = y + height - ((val - min) / range) * height
    points.push([px, py])
  })
  // Close path for fill
  points.push([x + width, y + height])
  points.push([x, y + height])
  
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(1.5)
  // Draw line
  for (let i = 0; i < data.length - 1; i++) {
    const x1 = x + (i / (data.length - 1)) * width
    const y1 = y + height - ((data[i] - min) / range) * height
    const x2 = x + ((i + 1) / (data.length - 1)) * width
    const y2 = y + height - ((data[i + 1] - min) / range) * height
    doc.line(x1, y1, x2, y2)
  }
}

function drawScoreBreakdownBars(
  doc: any,
  x: number,
  y: number,
  width: number,
  breakdown: Array<{ category: string; score: number; weight: number }>
): number {
  let cy = y
  const barHeight = 18
  const barSpacing = 6

  breakdown.forEach(item => {
    // Category label
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 135)
    doc.text(`${item.category} (${item.weight}%)`, x, cy + 10)

    // Background bar
    doc.setFillColor(30, 30, 45)
    doc.roundedRect(x + 85, cy, width - 120, barHeight, 3, 3, 'F')

    // Score bar (filled portion)
    const fillWidth = ((width - 120) * item.score) / 100
    const barColor = item.score >= 66 ? [98, 203, 193] :
                     item.score >= 33 ? [251, 191, 36] : [239, 68, 68]
    doc.setFillColor(barColor[0], barColor[1], barColor[2])
    doc.roundedRect(x + 85, cy, fillWidth, barHeight, 3, 3, 'F')

    // Score value
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(String(Math.round(item.score)), x + width - 30, cy + 12)

    cy += barHeight + barSpacing
  })

  return cy
}

function drawWallStreetSection(
  doc: any,
  x: number,
  y: number,
  width: number,
  pulse: WallStreetPulse
): number {
  let cy = y

  // Section header
  cy = drawPremiumSectionHeader(doc, 'WALL STREET NABZI', x, cy, width, '💰')

  // Card background
  doc.setFillColor(18, 18, 28)
  doc.roundedRect(x, cy, width, 100, 4, 4, 'F')

  cy += 15

  // Insider Activity
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(180, 150, 90)
  doc.text('Insider Aktivite', x + 10, cy)
  cy += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(98, 203, 193)
  doc.text(`Alis: +${pulse.insiderActivity.netBuys}`, x + 10, cy)
  doc.setTextColor(239, 68, 68)
  doc.text(`Satis: -${pulse.insiderActivity.netSales}`, x + 80, cy)
  
  if (pulse.insiderActivity.recentClusterBuy) {
    doc.setFillColor(98, 203, 193, 25)
    doc.roundedRect(x + 140, cy - 8, 50, 12, 2, 2, 'F')
    doc.setTextColor(98, 203, 193)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('CLUSTER BUY', x + 145, cy)
  }

  cy += 20

  // Institutional Flow
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(180, 150, 90)
  doc.text('Kurumsal Akim', x + 10, cy)
  cy += 14

  const flowColor = pulse.institutionalFlow.trend === 'ACCUMULATION' ? [98, 203, 193] :
                    pulse.institutionalFlow.trend === 'DISTRIBUTION' ? [239, 68, 68] : [251, 191, 36]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(flowColor[0], flowColor[1], flowColor[2])
  doc.text(pulse.institutionalFlow.trend, x + 10, cy)
  
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 140, 155)
  doc.text(`Net: ${pulse.institutionalFlow.netFlow}`, x + 100, cy)

  cy += 18

  // Smart Money Score
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(180, 150, 90)
  doc.text('Akilli Para Skoru', x + 10, cy)
  
  const smColor = pulse.smartMoney.score >= 66 ? [98, 203, 193] :
                  pulse.smartMoney.score >= 33 ? [251, 191, 36] : [239, 68, 68]
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(smColor[0], smColor[1], smColor[2])
  doc.text(`${pulse.smartMoney.score}/100`, x + 140, cy)

  return cy + 25
}

function drawMacroEconomySection(
  doc: any,
  x: number,
  y: number,
  width: number,
  macro: MacroEconomy
): number {
  let cy = y

  cy = drawPremiumSectionHeader(doc, 'MAKRO EKONOMI', x, cy, width, '🌍')

  // Card background
  doc.setFillColor(18, 18, 28)
  doc.roundedRect(x, cy, width, 90, 4, 4, 'F')

  cy += 15

  // GDP
  cy = drawPremiumFieldRow(doc, 'GDP Buyume', `${macro.gdp.latest}% (${macro.gdp.trend})`, x + 10, cy, 'blue')
  
  // Sentiment
  const sentColor = macro.sentiment.index >= 60 ? 'green' : macro.sentiment.index >= 40 ? 'amber' : 'red'
  cy = drawPremiumFieldRow(doc, 'Tuketici Guveni', `${macro.sentiment.index} - ${macro.sentiment.label}`, x + 10, cy, sentColor)
  
  // Fed Policy
  cy = drawPremiumFieldRow(doc, 'Fed Politikasi', `${macro.fedPolicy.rate} (${macro.fedPolicy.stance})`, x + 10, cy, 'purple')
  
  // Inflation
  const infColor = parseFloat(macro.inflation.cpi) > 3 ? 'red' : 'green'
  cy = drawPremiumFieldRow(doc, 'Enflasyon (CPI)', `${macro.inflation.cpi} (${macro.inflation.trend})`, x + 10, cy, infColor)

  return cy + 15
}

function drawSectorComparisonTable(
  doc: any,
  x: number,
  y: number,
  width: number,
  comparison: SectorComparison
): number {
  let cy = y

  cy = drawPremiumSectionHeader(doc, 'SEKTOR KARSILASTIRMASI', x, cy, width, '📊')

  // Table background
  doc.setFillColor(18, 18, 28)
  doc.roundedRect(x, cy, width, 25 * comparison.peers.length + 20, 4, 4, 'F')

  cy += 15

  // Table header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(180, 150, 90)
  doc.text('SEMBOL', x + 10, cy)
  doc.text('P/E', x + 70, cy)
  doc.text('MARKET CAP', x + 110, cy)
  doc.text('SKOR', x + 180, cy)

  cy += 10

  // Table rows
  comparison.peers.forEach((peer, i) => {
    const bgColor = i % 2 === 0 ? 22 : 18
    doc.setFillColor(bgColor, bgColor, 35)
    doc.rect(x + 5, cy - 7, width - 10, 18, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text(peer.symbol, x + 10, cy)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(140, 140, 155)
    doc.text(String(peer.peRatio.toFixed(1)), x + 70, cy)
    doc.text(peer.marketCap, x + 110, cy)

    const scoreColor = peer.score >= 66 ? [98, 203, 193] :
                       peer.score >= 33 ? [251, 191, 36] : [239, 68, 68]
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
    doc.text(String(Math.round(peer.score)), x + 180, cy)

    cy += 18
  })

  return cy + 10
}

function drawTechnicalIndicatorsSection(
  doc: any,
  x: number,
  y: number,
  width: number,
  tech: TechnicalIndicators
): number {
  let cy = y

  cy = drawPremiumSectionHeader(doc, 'TEKNIK GOSTERGELER', x, cy, width, '📈')

  // Card background
  doc.setFillColor(18, 18, 28)
  doc.roundedRect(x, cy, width, 95, 4, 4, 'F')

  cy += 15

  // RSI with gauge-like display
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 155)
  doc.text('RSI (14)', x + 10, cy)
  
  const rsiColor = tech.rsi.value < 30 ? 'green' : tech.rsi.value > 70 ? 'red' : 'amber'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...getColorRgb(rsiColor))
  doc.text(String(tech.rsi.value.toFixed(1)), x + 80, cy)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(140, 140, 155)
  doc.text(tech.rsi.signal, x + 120, cy)

  cy += 20

  // MACD
  cy = drawPremiumFieldRow(doc, 'MACD', `${tech.macd.value.toFixed(2)} (${tech.macd.signal})`, x + 10, cy, 
    tech.macd.signal.includes('ALIS') ? 'green' : tech.macd.signal.includes('SATIS') ? 'red' : 'amber')

  // SMA 50
  cy = drawPremiumFieldRow(doc, 'SMA 50', `$${tech.sma50.value.toFixed(2)} (${tech.sma50.position})`, x + 10, cy, 
    tech.sma50.position.includes('YUKARIDA') ? 'green' : 'red')

  // SMA 200
  cy = drawPremiumFieldRow(doc, 'SMA 200', `$${tech.sma200.value.toFixed(2)} (${tech.sma200.position})`, x + 10, cy,
    tech.sma200.position.includes('YUKARIDA') ? 'green' : 'red')

  return cy + 15
}

function drawWatermark(doc: any): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.06 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(48)
  doc.setTextColor(180, 150, 90)
  for (let y = 100; y <= pageHeight + 50; y += 130) {
    for (let x = 50; x <= pageWidth + 100; x += 360) {
      doc.text('HERMES AI', x, y, { angle: 28, align: 'center' })
    }
  }
  doc.restoreGraphicsState()
}

function drawPremiumFooter(doc: any): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 18

  // Gradient footer bar
  doc.setFillColor(12, 12, 20)
  doc.rect(0, footerY - 12, pageWidth, 30, 'F')

  // Gold line
  doc.setDrawColor(180, 150, 90)
  doc.setLineWidth(0.5)
  doc.line(30, footerY - 6, pageWidth - 30, footerY - 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(180, 150, 90)
  doc.text('HERMES AI NEURAL CORE', 30, footerY)
  
  doc.setTextColor(140, 140, 155)
  doc.text('Institutional-Grade Analysis • Not Financial Advice', pageWidth / 2, footerY, { align: 'center' })
  
  doc.setTextColor(180, 150, 90)
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 30, footerY, { align: 'right' })
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PDF GENERATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════

export async function downloadHermesReportPdf(input: DownloadPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 28
  const colWidth = (pageWidth - marginX * 3) / 2
  const bottomLimit = pageHeight - 42

  // Page background
  doc.setFillColor(240, 240, 245)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  drawWatermark(doc)

  const subtitleText = input.subtitle || 'Hermes AI Terminal - Premium Report'
  let y = drawGradientHeader(doc, input.title, subtitleText, marginX)

  if (input.scoreSummary) {
    drawPremiumScoreCard(doc, pageWidth - marginX - 175, 6, input.scoreSummary)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1: Core Data + Wall Street Pulse
  // ═══════════════════════════════════════════════════════════════════════

  let leftY = y
  let rightY = y

  // LEFT COLUMN: Core sections
  const leftSections = input.sections.slice(0, Math.ceil(input.sections.length / 2))
  
  for (const section of leftSections) {
    const visibleRows = section.rows.filter(r => safeValue(r.value) !== '-')
    if (visibleRows.length === 0) continue

    if (leftY + 40 > bottomLimit) {
      drawPremiumFooter(doc)
      doc.addPage()
      doc.setFillColor(240, 240, 245)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')
      drawWatermark(doc)
      leftY = 36
    }

    leftY = drawPremiumSectionHeader(doc, section.title, marginX, leftY, colWidth, section.icon)
    
    for (const row of visibleRows) {
      if (leftY + 16 > bottomLimit) {
        drawPremiumFooter(doc)
        doc.addPage()
        doc.setFillColor(240, 240, 245)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
        drawWatermark(doc)
        leftY = 36
      }
      leftY = drawPremiumFieldRow(doc, row.label, safeValue(row.value), marginX + 4, leftY, row.color, row.badge)
    }
    leftY += 12
  }

  // RIGHT COLUMN: Wall Street Pulse + remaining sections
  if (input.wallStreetPulse) {
    rightY = drawWallStreetSection(doc, marginX + colWidth + marginX, rightY, colWidth, input.wallStreetPulse)
    rightY += 20
  }

  const rightSections = input.sections.slice(Math.ceil(input.sections.length / 2))
  for (const section of rightSections) {
    const visibleRows = section.rows.filter(r => safeValue(r.value) !== '-')
    if (visibleRows.length === 0) continue

    if (rightY + 40 > bottomLimit) {
      drawPremiumFooter(doc)
      doc.addPage()
      doc.setFillColor(240, 240, 245)
      doc.rect(0, 0, pageWidth, pageHeight, 'F')
      drawWatermark(doc)
      rightY = 36
    }

    rightY = drawPremiumSectionHeader(doc, section.title, marginX + colWidth + marginX, rightY, colWidth, section.icon)
    
    for (const row of visibleRows) {
      if (rightY + 16 > bottomLimit) {
        drawPremiumFooter(doc)
        doc.addPage()
        doc.setFillColor(240, 240, 245)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
        drawWatermark(doc)
        rightY = 36
      }
      rightY = drawPremiumFieldRow(doc, row.label, safeValue(row.value), marginX + colWidth + marginX + 4, rightY, row.color, row.badge)
    }
    rightY += 12
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 2: Score Breakdown + Macro + Technical
  // ═══════════════════════════════════════════════════════════════════════

  drawPremiumFooter(doc)
  doc.addPage()
  doc.setFillColor(240, 240, 245)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')
  drawWatermark(doc)

  y = 36

  // Score Breakdown (full width)
  if (input.scoreBreakdown && input.scoreBreakdown.length > 0) {
    y = drawPremiumSectionHeader(doc, 'HERMES AI SKOR DAGILIMI', marginX, y, pageWidth - marginX * 2, '🎯')
    
    // Card background
    doc.setFillColor(18, 18, 28)
    doc.roundedRect(marginX, y, pageWidth - marginX * 2, input.scoreBreakdown.length * 24 + 20, 6, 6, 'F')
    
    y = drawScoreBreakdownBars(doc, marginX + 10, y + 10, pageWidth - marginX * 2 - 20, input.scoreBreakdown)
    y += 20
  }

  // Two columns: Macro + Technical
  leftY = y
  rightY = y

  if (input.macroEconomy) {
    leftY = drawMacroEconomySection(doc, marginX, leftY, colWidth, input.macroEconomy)
    leftY += 20
  }

  if (input.technicalIndicators) {
    rightY = drawTechnicalIndicatorsSection(doc, marginX + colWidth + marginX, rightY, colWidth, input.technicalIndicators)
    rightY += 20
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 3: Sector Comparison (if provided)
  // ═══════════════════════════════════════════════════════════════════════

  if (input.sectorComparison && input.sectorComparison.peers.length > 0) {
    drawPremiumFooter(doc)
    doc.addPage()
    doc.setFillColor(240, 240, 245)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    drawWatermark(doc)

    y = 36
    y = drawSectorComparisonTable(doc, marginX, y, pageWidth - marginX * 2, input.sectorComparison)
  }

  drawPremiumFooter(doc)
  doc.save(input.fileName)
}
