import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { money } from '../db.js'

// Builds a clean, ledger-style PDF: shop header, a title/subtitle, a table,
// and an optional list of bold total lines at the bottom.
//
// columns: [{ header, dataKey, halign? }]
// rows: array of plain objects keyed by dataKey
// rowStyleFn(row) => { textColor: [r,g,b] } | undefined  (used to colour red/green lines)
// totals: [{ label, value, color: 'red' | 'green' | null }]
//   `value` is formatted as money; pass `text` instead for a plain (non-money) line.
export function buildLedgerPdf({ settings = {}, title, subtitle, columns, rows, totals = [], rowStyleFn, fileName }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 40

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(settings.shopName || 'Pesticide Store', pageWidth / 2, y, { align: 'center' })
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  if (settings.address) {
    doc.text(settings.address, pageWidth / 2, y, { align: 'center' })
    y += 13
  }
  if (settings.phone) {
    doc.text('Phone: ' + settings.phone, pageWidth / 2, y, { align: 'center' })
    y += 13
  }

  y += 10
  doc.setDrawColor(180)
  doc.line(40, y, pageWidth - 40, y)
  y += 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(title, 40, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(90)
  if (subtitle) {
    doc.text(subtitle, 40, y)
    y += 10
  }
  doc.text('Generated: ' + new Date().toLocaleString(), 40, y)
  doc.setTextColor(0)
  y += 14

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => r[c.dataKey])),
    columnStyles: columns.reduce((acc, c, i) => {
      if (c.halign) acc[i] = { halign: c.halign }
      return acc
    }, {}),
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 6 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 247] },
    didParseCell: (data) => {
      if (data.section !== 'body' || !rowStyleFn) return
      const row = rows[data.row.index]
      const style = rowStyleFn(row)
      if (style && style.textColor) data.cell.styles.textColor = style.textColor
    },
    margin: { left: 40, right: 40 },
  })

  let finalY = doc.lastAutoTable.finalY + 20

  totals.forEach((t) => {
    if (finalY > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage()
      finalY = 40
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    if (t.color === 'red') doc.setTextColor(200, 30, 30)
    else if (t.color === 'green') doc.setTextColor(20, 130, 60)
    else doc.setTextColor(0)
    const shown = t.text !== undefined ? t.text : money(t.value)
    doc.text(`${t.label}:  ${shown}`, pageWidth - 40, finalY, { align: 'right' })
    doc.setTextColor(0)
    finalY += 18
  })

  doc.save(fileName)
}
