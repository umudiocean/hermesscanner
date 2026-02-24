export interface PdfField {
  label: string
  value: string | number | null | undefined
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
}

function safeValue(value: PdfField['value']): string {
  if (value == null) return '-'
  const s = String(value).trim()
  return s.length > 0 ? s : '-'
}

function drawWatermark(doc: any): void {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(30)
  doc.setTextColor(235, 235, 240)

  for (let y = 120; y <= pageHeight - 40; y += 150) {
    for (let x = 70; x <= pageWidth - 70; x += 220) {
      doc.text('Hermes Ai Neural Core', x, y, { angle: 35, align: 'center' })
    }
  }
}

export async function downloadHermesReportPdf(input: DownloadPdfInput): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 42
  const topY = 48
  const bottomY = pageHeight - 46
  let y = topY

  const startNewPage = () => {
    drawWatermark(doc)
    doc.addPage()
    y = topY
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > bottomY) startNewPage()
  }

  drawWatermark(doc)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(22, 22, 30)
  doc.text(input.title, marginX, y)
  y += 20

  if (input.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(75, 75, 85)
    doc.text(input.subtitle, marginX, y)
    y += 16
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(95, 95, 105)
  doc.text(`Generated: ${new Date().toISOString()}`, marginX, y)
  y += 18

  for (const section of input.sections) {
    const visibleRows = section.rows.filter(r => safeValue(r.value) !== '-')
    if (visibleRows.length === 0) continue

    ensureSpace(30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(25, 25, 35)
    doc.text(section.title, marginX, y)
    y += 10

    doc.setDrawColor(220, 220, 230)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const row of visibleRows) {
      ensureSpace(16)
      doc.setTextColor(70, 70, 82)
      doc.text(`${row.label}:`, marginX, y)
      doc.setTextColor(20, 20, 28)
      doc.text(safeValue(row.value), marginX + 170, y)
      y += 14
    }

    y += 6
  }

  doc.save(input.fileName)
}
