export interface PdfField {
  label: string
  value: string | number | null | undefined
  color?: 'green' | 'red' | 'amber' | 'default'
}

export interface PdfSection {
  title: string
  rows: PdfField[]
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
}

function safeValue(value: PdfField['value']): string {
  if (value == null) return '-'
  const s = String(value).trim()
  return s.length > 0 ? s : '-'
}

function drawWatermark(doc: any): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.saveGraphicsState()
  doc.setGState(new doc.GState({ opacity: 0.09 }))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(44)
  doc.setTextColor(180, 150, 90)
  for (let y = 100; y <= pageHeight + 50; y += 120) {
    for (let x = 50; x <= pageWidth + 100; x += 340) {
      doc.text('Hermes Ai Neural Core', x, y, { angle: 25, align: 'center' })
    }
  }
  doc.restoreGraphicsState()
}

function drawHeader(doc: any, title: string, subtitle: string, marginX: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 36

  doc.setFillColor(18, 18, 28)
  doc.rect(0, 0, pageWidth, 60, 'F')

  doc.setFillColor(180, 150, 90)
  doc.rect(marginX, 52, 80, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(255, 255, 255)
  doc.text(title, marginX, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(180, 180, 195)
  doc.text(subtitle, marginX, y)

  doc.setTextColor(130, 130, 145)
  doc.setFontSize(8)
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  doc.text(`Generated: ${dateStr}`, pageWidth - marginX, y, { align: 'right' })

  return 72
}

function drawScoreBox(doc: any, x: number, y: number, summary: NonNullable<DownloadPdfInput['scoreSummary']>): void {
  const boxW = 150
  const boxH = 60

  doc.setFillColor(22, 22, 35)
  doc.roundedRect(x, y, boxW, boxH, 4, 4, 'F')
  doc.setDrawColor(180, 150, 90)
  doc.setLineWidth(0.5)
  doc.roundedRect(x, y, boxW, boxH, 4, 4, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  const scoreColor = summary.total >= 66 ? [98, 203, 193] : summary.total >= 33 ? [251, 191, 36] : [239, 68, 68]
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
  doc.text(String(Math.round(summary.total)), x + 20, y + 30)

  doc.setFontSize(10)
  doc.text(summary.level, x + 20, y + 42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(160, 160, 175)
  doc.text(`Confidence: ${summary.confidence}%`, x + 85, y + 26)
  doc.text(`Valuation: ${summary.valuationLabel}`, x + 85, y + 38)
}

function drawSectionTitle(doc: any, title: string, x: number, y: number, width: number): number {
  doc.setFillColor(180, 150, 90)
  doc.rect(x, y, 3, 12, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 45)
  doc.text(title, x + 8, y + 9)

  doc.setDrawColor(230, 230, 235)
  doc.setLineWidth(0.3)
  doc.line(x, y + 14, x + width, y + 14)

  return y + 20
}

function drawFieldRow(doc: any, label: string, value: string, x: number, y: number, color?: PdfField['color']): number {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 100, 115)
  doc.text(label, x, y)

  if (color === 'green') doc.setTextColor(34, 170, 150)
  else if (color === 'red') doc.setTextColor(220, 60, 60)
  else if (color === 'amber') doc.setTextColor(210, 170, 50)
  else doc.setTextColor(30, 30, 45)

  doc.setFont('helvetica', 'bold')
  doc.text(value, x + 110, y)

  return y + 13
}

function drawFooter(doc: any): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerY = pageHeight - 20

  doc.setDrawColor(220, 220, 230)
  doc.setLineWidth(0.3)
  doc.line(30, footerY - 4, pageWidth - 30, footerY - 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 165)
  doc.text('Hermes Ai Neural Core — Institutional-Grade Analysis', 30, footerY)
  doc.text('For informational purposes only. Not financial advice.', pageWidth / 2, footerY, { align: 'center' })
  doc.text(`Page ${doc.internal.getNumberOfPages()}`, pageWidth - 30, footerY, { align: 'right' })
}

export async function downloadHermesReportPdf(input: DownloadPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 30
  const colWidth = (pageWidth - marginX * 3) / 2
  const bottomLimit = pageHeight - 36

  drawWatermark(doc)

  const subtitleText = input.subtitle || 'Hermes AI Terminal'
  let y = drawHeader(doc, input.title, subtitleText, marginX)

  if (input.scoreSummary) {
    drawScoreBox(doc, pageWidth - marginX - 155, 6, input.scoreSummary)
  }

  const leftSections = input.sections.slice(0, Math.ceil(input.sections.length / 2))
  const rightSections = input.sections.slice(Math.ceil(input.sections.length / 2))

  function renderColumn(sections: PdfSection[], startX: number, startY: number, maxWidth: number): number {
    let cy = startY
    for (const section of sections) {
      const visibleRows = section.rows.filter(r => safeValue(r.value) !== '-')
      if (visibleRows.length === 0) continue

      if (cy + 30 > bottomLimit) {
        drawFooter(doc)
        drawWatermark(doc)
        doc.addPage()
        cy = 36
      }

      cy = drawSectionTitle(doc, section.title, startX, cy, maxWidth)

      for (const row of visibleRows) {
        if (cy + 14 > bottomLimit) {
          drawFooter(doc)
          drawWatermark(doc)
          doc.addPage()
          cy = 36
        }
        cy = drawFieldRow(doc, row.label, safeValue(row.value), startX, cy, row.color)
      }
      cy += 8
    }
    return cy
  }

  renderColumn(leftSections, marginX, y, colWidth)
  renderColumn(rightSections, marginX + colWidth + marginX, y, colWidth)

  drawFooter(doc)
  doc.save(input.fileName)
}
