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
    const page = doc.addPage([595, 842])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    
    const { width, height } = page.getSize()
    let y = height - 60

    page.drawText(firmData.name || firm, { x: 50, y, size: 22, font: fontBold, color: rgb(0.067, 0.094, 0.153) })
    page.drawText(memoType === 'order' ? 'ORDER MEMO' : 'SALE MEMO', { x: width - 180, y, size: 13, font: fontBold, color: rgb(0.216, 0.255, 0.318) })
    y -= 30

    if (firmData.address) { page.drawText(firmData.address, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) }); y -= 13 }
    if (firmData.phone_number) { page.drawText(`Tel: ${firmData.phone_number}`, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) }); y -= 13 }
    if (firmData.gst_number) { page.drawText(`GSTIN: ${firmData.gst_number}`, { x: 50, y, size: 9, font, color: rgb(0.42, 0.447, 0.502) }); y -= 13 }
    y -= 10
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.6, color: rgb(0.898, 0.906, 0.918) })
    y -= 20

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

    const tableY = y
    page.drawRectangle({ x: 50, y: tableY - 22, width: width - 100, height: 22, color: rgb(0.953, 0.957, 0.965) })
    page.drawText('#', { x: 55, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Product', { x: 75, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Size', { x: 295, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Qty', { x: 365, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Rate', { x: 415, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    page.drawText('Amount', { x: 485, y: tableY - 15, size: 8, font: fontBold, color: rgb(0.42, 0.447, 0.502) })
    y = tableY - 30

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

    const gstOn = gstAmt > 0
    const sumRows = gstOn ? [['Taxable Amount', subtotal], ['CGST @ 2.5%', gstAmt / 2], ['SGST @ 2.5%', gstAmt / 2]] : [['Subtotal', subtotal]]

    sumRows.forEach(([label, val]) => {
      page.drawText(label, { x: 380, y, size: 9.5, font, color: rgb(0.42, 0.447, 0.502) })
      page.drawText(inr(val), { x: 485, y, size: 9.5, font, color: rgb(0.122, 0.161, 0.216) })
      y -= 18
    })

    const lineY = y + 10
    page.drawLine({ start: { x: 350, y: lineY }, end: { x: width - 50, y: lineY }, thickness: 0.8, color: rgb(0.067, 0.094, 0.153) })
    y -= 10
    page.drawText('TOTAL', { x: 380, y, size: 12, font: fontBold, color: rgb(0.067, 0.094, 0.153) })
    page.drawText(inr(total), { x: 485, y, size: 12, font: fontBold, color: rgb(0.067, 0.094, 0.153) })
    y -= 35

    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5, color: rgb(0.898, 0.906, 0.918) })
    y -= 12
    const footerNote = firmData.footer_note || 'Thank you for your business!'
    page.drawText(footerNote, { x: width / 2 - (footerNote.length * 2.5), y, size: 8, font, color: rgb(0.608, 0.639, 0.686) })
    y -= 13
    page.drawText(`Generated by Memo App · ${new Date().toLocaleDateString('en-IN')}`, { x: 180, y, size: 8, font, color: rgb(0.608, 0.639, 0.686) })

    const pdfBytes = await doc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename=memo.pdf', 'Content-Length': String(pdfBytes.length) },
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
        }
