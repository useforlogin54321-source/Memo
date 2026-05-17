import PDFDocument from 'pdfkit'

export const runtime = 'nodejs'
export const maxDuration = 30

const inr = (n) => `\u20b9${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function parseDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return new Date().toLocaleString('en-IN') }
}

export async function POST(req) {
  try {
    const { memo, items = [], firm, firmData = {}, customer = {}, subtotal = 0, gstAmt = 0, total = 0, memoType = 'sale' } = await req.json()

    const chunks = []
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `${firm} – Memo` } })
    doc.on('data', (c) => chunks.push(c))

    const W = doc.page.width - 100   // usable width (50mm margin each side)
    const gstOn = gstAmt > 0

    // ── HEADER ───────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').text(firmData.name || firm, 50, 50)
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#374151')
       .text(memoType === 'order' ? 'ORDER MEMO' : 'SALE MEMO', 50, 52, { align: 'right' })
    doc.fillColor('#111827')

    let y = 82
    doc.fontSize(9).font('Helvetica').fillColor('#6B7280')
    if (firmData.address)      { doc.text(firmData.address, 50, y); y += 13 }
    if (firmData.phone_number) { doc.text(`Tel: ${firmData.phone_number}`, 50, y); y += 13 }
    if (firmData.gst_number)   { doc.text(`GSTIN: ${firmData.gst_number}`, 50, y); y += 13 }

    y += 6
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#E5E7EB').lineWidth(0.6).stroke()
    y += 12

    // ── BILL-TO / DATE ────────────────────────────────────────────────────
    doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold')
       .text('BILL TO', 50, y).text('DATE', 350, y).text('REF #', 460, y)
    y += 12
    doc.fillColor('#111827').fontSize(10).font('Helvetica')
       .text(customer.name || 'Walk-in Customer', 50, y)
       .text(parseDate(memo?.created_at), 350, y)
       .text((memo?.id || 'DRAFT').toString().slice(0, 8).toUpperCase(), 460, y)
    y += 13
    doc.fillColor('#6B7280').fontSize(9)
       .text(`Ph: ${customer.phone || '—'}`, 50, y)
    y += 22

    // ── ITEMS TABLE ───────────────────────────────────────────────────────
    const ROW_H = 22
    const COL = { num: 50, name: 72, size: 290, qty: 360, rate: 410, amt: 480 }

    // Header row
    doc.rect(50, y, W, ROW_H).fill('#F3F4F6')
    doc.fillColor('#6B7280').fontSize(8).font('Helvetica-Bold')
       .text('#',       COL.num,  y + 7, { width: 20, align: 'right' })
       .text('Product', COL.name, y + 7)
       .text('Size',    COL.size, y + 7, { width: 60, align: 'center' })
       .text('Qty',     COL.qty,  y + 7, { width: 45, align: 'right' })
       .text('Rate',    COL.rate, y + 7, { width: 60, align: 'right' })
       .text('Amount',  COL.amt,  y + 7, { width: 70, align: 'right' })
    doc.moveTo(50, y + ROW_H).lineTo(50 + W, y + ROW_H).strokeColor('#E5E7EB').lineWidth(0.6).stroke()
    y += ROW_H

    // Data rows
    items.forEach((item, idx) => {
      const amount = item.unit_price * item.quantity
      if (idx % 2 === 1) doc.rect(50, y, W, ROW_H).fill('#F9FAFB')
      doc.fillColor('#1F2937').fontSize(9).font('Helvetica')
         .text(String(idx + 1),             COL.num,  y + 6, { width: 20, align: 'right' })
         .text(item.name || '—',            COL.name, y + 6, { width: 215 })
         .text(item.size || '—',            COL.size, y + 6, { width: 60, align: 'center' })
         .text(String(item.quantity),       COL.qty,  y + 6, { width: 45, align: 'right' })
         .text(inr(item.unit_price),        COL.rate, y + 6, { width: 60, align: 'right' })
         .text(inr(amount),                 COL.amt,  y + 6, { width: 70, align: 'right' })
      doc.moveTo(50, y + ROW_H).lineTo(50 + W, y + ROW_H).strokeColor('#E5E7EB').lineWidth(0.3).stroke()
      y += ROW_H
    })

    y += 12

    // ── TOTALS ────────────────────────────────────────────────────────────
    const sumRows = gstOn
      ? [['Taxable Amount', subtotal], ['CGST @ 2.5%', gstAmt / 2], ['SGST @ 2.5%', gstAmt / 2]]
      : [['Subtotal', subtotal]]

    sumRows.forEach(([label, val]) => {
      doc.fillColor('#6B7280').fontSize(9.5).font('Helvetica')
         .text(label, 50, y, { width: W - 70, align: 'right' })
         .fillColor('#1F2937')
         .text(inr(val), 50, y, { width: W, align: 'right' })
      y += 18
    })

    doc.moveTo(350, y).lineTo(50 + W, y).strokeColor('#111827').lineWidth(0.8).stroke()
    y += 8
    doc.fillColor('#111827').fontSize(12).font('Helvetica-Bold')
       .text('TOTAL', 50, y, { width: W - 70, align: 'right' })
       .text(inr(total), 50, y, { width: W, align: 'right' })
    y += 32

    // ── FOOTER ────────────────────────────────────────────────────────────
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
    y += 10
    const footerNote = firmData.footer_note || 'Thank you for your business!'
    doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica-Oblique')
       .text(footerNote, 50, y, { align: 'center', width: W })
    y += 13
    doc.text(`Generated by Memo App · ${new Date().toLocaleDateString('en-IN')}`, 50, y, { align: 'center', width: W })

    doc.end()

    await new Promise((resolve) => doc.on('end', resolve))
    const pdf = Buffer.concat(chunks)

    return new Response(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=memo.pdf',
        'Content-Length': String(pdf.length),
      },
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
      }
                                                              
