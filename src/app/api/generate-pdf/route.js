import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function parseDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return new Date().toLocaleString('en-IN') }
}

export async function POST(req) {
  try {
    const { memo, items = [], firm, firmData = {}, customer = {}, subtotal = 0, gstAmt = 0, total = 0, memoType = 'sale' } = await req.json()

    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842]) // A4
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    
    const { width, height } = page.getSize()
    let y = height - 60

    // Header
    page.drawText(firmData.name || firm, { x: 50, y, size: 22, font: fontBold, color: rgb(0.067, 0.094, 0.153) })
    page.drawText(memoType === 'order' ? 'ORDER MEMO' : 'SALE MEMO', { x: width - 180, y, size: 13, font: fontBold, color: rgb(0.216, 0.255, 0.318) })
    y -= 30

    // Firm details
    page.setFont(font); page.setFontSize(9)
    if (firmData.address) { page.drawText(firmData.address, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) }); y -= 13 }
    if (firmData.phone_number) { page.drawText(`Tel: ${firmData.phone_number}`, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) }); y -= 13 }
    if (firmData.gst_number) { page.drawText(`GSTIN: ${firmData.gst_number}`, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) }); y -= 13 }
    y -= 10
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.6, color: rgb(0.898, 0.906, 0.918) })
    y -= 20

    // Bill-to / Date
    page.drawText('BILL TO', { x: 50, y, size: 7.5, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('DATE', { x: 350, y, size: 7.5, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('REF #', { x: 460, y, size: 7.5, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    y -= 15
    page.drawText(customer.name || 'Walk-in Customer', { x: 50, y, size: 10, font, color: rgb(0.067, 0.094, 0.153) })
    page.drawText(parseDate(memo?.created_at), { x: 350, y, size: 10, font, color: rgb(0.067, 0.094, 0.153) })
    page.drawText((memo?.id || 'DRAFT').toString().slice(0, 8).toUpperCase(), { x: 460, y, size: 10, font, color: rgb(0.067, 0.094, 0.153) })
    y -= 13
    page.drawText(`Ph: ${customer.phone || '—'}`, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) })
    y -= 25

    // Items table header
    const tableY = y
    page.drawRectangle({ x: 50, y: tableY - 22, width: width - 100, height: 22, color: rgb(0.953, 0.957, 0.965) })
    page.drawText('#', { x: 55, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Product', { x: 75, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Size', { x: 295, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Qty', { x: 365, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Rate', { x: 415, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Amount', { x: 485, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    y = tableY - 30

    // Items
    items.forEach((item, idx) => {
      const amount = item.unit_price * item.quantity
      if (idx % 2 === 1) page.drawRectangle({ x: 50, y: y - 16, width: width - 100, height: 22, color: rgb(0.976, 0.980, 0.984) })
      page.drawText(String(idx + 1), { x: 60, y, size: 9, font, color: rgb(0.122, 0.161, 0.216) })
      page.drawText((item.name || '—').slice(0, 35), { x: 75, y, size: 9, font, color: rgb(0.122, 0.161, 0.216) })
      page.drawText(item.size || '—', { x: 310, y, size: 9, font, color: rgb(0.122, 0.161, 0.216) })
      page.drawText(String(item.quantity), { x: 375, y, size: 9, font, color: rgb(0.122, 0.161, 0.216) })
      page.drawText(inr(item.unit_price), { x: 415, y, size: 9, font, color: rgb(0.122, 0.161, 0.216) })
      page.drawText(inr(amount), { x: 485, y, size: 9, font, color: rgb(0.122, 0.161, 0.216) })
      y -= 22
    })
    y -= 15

    // Totals
    const gstOn = gstAmt > 0
    const sumRows = gstOn
      ? [['Taxable Amount', subtotal], ['CGST @ 2.5%', gstAmt / 2], ['SGST @ 2.5%', gstAmt / 2]]
      : [['Subtotal', subtotal]]

    sumRows.forEach(([label, val]) => {
      page.drawText(label, { x: 380, y, size: 9.5, font, color: rgb(0.42, 0.447, 0.502) })
      page.drawText(inr(val), { x: 485, y, size: 9.5, font, color: rgb(0.122, 0.161, 0.216) })
      y -= 18
    })

    page.drawLine({ start: { x: 350, y + 10 }, end: { x: width - 50, y + 10 }, thickness: 0.8, color: rgb(0.067, 0.094, 0.153) })
    y -= 10
    page.drawText('TOTAL', { x: 380, y, size: 12, font: fontBold, color: rgb(0.067, 0.094, 0.153) })
    page.drawText(inr(total), { x: 485, y, size: 12, font: fontBold, color: rgb(0.067, 0.094, 0.153) })
    y -= 35

    // Footer
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.898, 0.906, 0.918) })
    y -= 12
    const footerNote = firmData.footer_note || 'Thank you for your business!'
    page.drawText(footerNote, { x: width / 2 - (footerNote.length * 2.5), y, size: 8, font, color: rgb(0.608, 0.639, 0.686) })
    y -= 13
    page.drawText(`Generated by Memo App · ${new Date().toLocaleDateString('en-IN')}`, { x: 180, y, size: 8, font, color: rgb(0.608, 0.639, 0.686) })

    const pdfBytes = await doc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename=memo.pdf',
        'Content-Length': String(pdfBytes.length),
      },
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
                                                  }    y += 6
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
                                                              
