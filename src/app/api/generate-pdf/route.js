import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const inr = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function parseDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return new Date().toLocaleDateString('en-IN') }
}

async function fetchImage(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }})
    if (!res.ok) return null
    return await res.arrayBuffer()
  } catch { return null }
}

function drawBox(page, x, y, w, h, opts = {}) {
  page.drawRectangle({ 
    x, y, width: w, height: h, 
    borderColor: opts.borderColor || rgb(0, 0, 0), 
    borderWidth: opts.borderWidth || 0.75,
    color: opts.fillColor 
  })
}

function drawCell(page, text, x, y, w, h, font, size = 9, opts = {}) {
  drawBox(page, x, y, w, h, opts)
  const textY = y + h / 2 - size / 3
  const textX = opts.align === 'right' ? x + w - page.getFont().widthOfTextAtSize(text, size) - 4 : 
                opts.align === 'center' ? x + (w - page.getFont().widthOfTextAtSize(text, size)) / 2 : x + 4
  page.drawText(text, { x: textX, y: textY, size, font, color: opts.color || rgb(0, 0, 0) })
}

export async function POST(req) {
  try {
    const { memo, items = [], firm, firmData = {}, customer = {}, subtotal = 0, gstAmt = 0, total = 0, memoType = 'sale' } = await req.json()

    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    
    const { width, height } = page.getSize()
    const margin = 30
    const contentWidth = width - (2 * margin)
    let y = height - 50

    // === LOGO ONLY ===
    if (firmData.logo_url) {
      const logoBytes = await fetchImage(firmData.logo_url)
      if (logoBytes) {
        try {
          const isPng = firmData.logo_url.toLowerCase().includes('.png')
          const logoImg = isPng ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes)
          const logoH = 60
          const logoW = (logoImg.width / logoImg.height) * logoH
          page.drawImage(logoImg, { x: margin, y: y - logoH, width: logoW, height: logoH })
        } catch (e) {
          console.error('Logo error:', e)
        }
      }
    }

    y -= 75

    // === HEADER BOX - Company Info ===
    const headerHeight = 60
    drawBox(page, margin, y - headerHeight, contentWidth, headerHeight)
    
    let infoY = y - 15
    page.drawText(firmData.address || '289, M.G. Road, 1st Floor, Pune 411001', { x: margin + 8, y: infoY, size: 8, font })
    infoY -= 12
    page.drawText(`Tel: ${firmData.phone_number || '26132509'}   Mob: ${firmData.phone_number || '7385299464'}`, { x: margin + 8, y: infoY, size: 8, font })
    infoY -= 12
    page.drawText(`GSTN: ${firmData.gst_number || '27AAAFY0749C2ZB'}   Email: ${firmData.email || 'info@' + firm.toLowerCase().replace(/\s/g, '') + '.com'}`, { x: margin + 8, y: infoY, size: 8, font })
    infoY -= 12
    
    // Invoice type on right
    const invoiceType = memoType === 'order' ? 'ORDER INVOICE' : 'CASH INVOICE'
    page.drawText('INVOICE', { x: width - 140, y: y - 20, size: 14, font: fontBold })
    page.drawText(invoiceType, { x: width - 140, y: y - 35, size: 9, font })

    y -= headerHeight + 10

    // === CUSTOMER & INVOICE DETAILS BOX ===
    const detailsHeight = 50
    drawBox(page, margin, y - detailsHeight, contentWidth, detailsHeight)
    
    // Vertical dividers
    page.drawLine({ start: { x: contentWidth / 2, y: y - detailsHeight }, end: { x: contentWidth / 2, y }, thickness: 0.75 })
    page.drawLine({ start: { x: contentWidth * 0.75, y: y - detailsHeight }, end: { x: contentWidth * 0.75, y }, thickness: 0.75 })
    
    // Customer
    page.drawText('Customer:', { x: margin + 8, y: y - 15, size: 9, font: fontBold })
    page.drawText(customer.name || 'Walk-in Customer', { x: margin + 8, y: y - 28, size: 10, font })
    page.drawText(`Mob: ${customer.phone || '—'}`, { x: margin + 8, y: y - 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) })
    
    // Invoice No
    page.drawText('Invoice No:', { x: contentWidth / 2 + 8, y: y - 15, size: 9, font: fontBold })
    page.drawText((memo?.id || 'DRAFT').toString().slice(0, 12), { x: contentWidth / 2 + 8, y: y - 28, size: 10, font })
    
    // Date
    page.drawText('Invoice Date:', { x: contentWidth * 0.75 + 8, y: y - 15, size: 9, font: fontBold })
    page.drawText(parseDate(memo?.created_at), { x: contentWidth * 0.75 + 8, y: y - 28, size: 10, font })
    
    // State Code
    page.drawText('State Code: 15', { x: contentWidth * 0.75 + 8, y: y - 40, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

    y -= detailsHeight + 10

    // === ITEMS TABLE ===
    const rowH = 16
    const cols = [
      { label: 'Sr No', x: margin, w: 35 },
      { label: 'Qty', x: margin + 35, w: 35 },
      { label: 'Description of Goods', x: margin + 70, w: 180 },
      { label: 'HSN', x: margin + 250, w: 55 },
      { label: 'Rate', x: margin + 305, w: 70 },
      { label: 'GST %', x: margin + 375, w: 50 },
      { label: 'Total Amount', x: margin + 425, w: contentWidth - 395 },
    ]

    // Table header
    cols.forEach(col => {
      drawBox(page, col.x, y - rowH, col.w, rowH, { fillColor: rgb(0.92, 0.92, 0.92) })
      page.drawText(col.label, { x: col.x + 4, y: y - 11, size: 8, font: fontBold })
    })
    
    y -= rowH

    // Table rows
    items.forEach((item, idx) => {
      cols.forEach(col => drawBox(page, col.x, y - rowH, col.w, rowH))
      
      page.drawText(String(idx + 1), { x: cols[0].x + 4, y: y - 11, size: 9, font })
      page.drawText(String(item.quantity), { x: cols[1].x + 4, y: y - 11, size: 9, font })
      
      const desc = (item.name || '—') + (item.size ? ` (Size: ${item.size})` : '')
      page.drawText(desc.slice(0, 35), { x: cols[2].x + 4, y: y - 11, size: 9, font })
      
      page.drawText(item.hsn_code || '6101', { x: cols[3].x + 4, y: y - 11, size: 9, font })
      page.drawText(inr(item.unit_price), { x: cols[4].x + 4, y: y - 11, size: 9, font })
      page.drawText('5.00%', { x: cols[5].x + 4, y: y - 11, size: 9, font })
      page.drawText(inr(item.unit_price * item.quantity), { x: cols[6].x + contentWidth - 395 - page.widthOfTextAtSize(inr(item.unit_price * item.quantity), 9) - 4, y: y - 11, size: 9, font })
      
      y -= rowH
    })

    // Add empty rows if needed
    const minRows = 8
    for (let i = items.length; i < minRows; i++) {
      cols.forEach(col => drawBox(page, col.x, y - rowH, col.w, rowH))
      y -= rowH
    }

    y -= 10

    // === GST SUMMARY TABLE ===
    if (gstAmt > 0) {
      const gstCols = [
        { label: 'GST', x: margin, w: 60 },
        { label: 'Taxable', x: margin + 60, w: 90 },
        { label: 'SGST', x: margin + 150, w: 75 },
        { label: 'CGST', x: margin + 225, w: 75 },
      ]

      // Header
      gstCols.forEach(col => {
        drawBox(page, col.x, y - rowH, col.w, rowH, { fillColor: rgb(0.92, 0.92, 0.92) })
        page.drawText(col.label, { x: col.x + 4, y: y - 11, size: 8, font: fontBold })
      })
      y -= rowH

      // Data row
      gstCols.forEach(col => drawBox(page, col.x, y - rowH, col.w, rowH))
      page.drawText('GST 5%', { x: gstCols[0].x + 4, y: y - 11, size: 9, font })
      page.drawText(inr(subtotal), { x: gstCols[1].x + 4, y: y - 11, size: 9, font })
      page.drawText(inr(gstAmt / 2), { x: gstCols[2].x + 4, y: y - 11, size: 9, font })
      page.drawText(inr(gstAmt / 2), { x: gstCols[3].x + 4, y: y - 11, size: 9, font })
      y -= rowH

      // TOTAL GST
      page.drawText(`TOTAL GST: ${inr(gstAmt)}`, { x: margin, y: y - 15, size: 10, font: fontBold })
      y -= 25
    }

    // === NET AMOUNT BOX ===
    drawBox(page, width - margin - 180, y - 35, 180, 35, { borderWidth: 1.5 })
    page.drawText('Net Amount', { x: width - margin - 170, y: y - 15, size: 10, font: fontBold })
    page.drawText(inr(total), { x: width - margin - 170, y: y - 28, size: 14, font: fontBold })

    y -= 50

    // === FOOTER BOXES ===
    // QR Code box
    if (firmData.qr_code_url) {
      drawBox(page, margin, 45, 90, 90)
      const qrBytes = await fetchImage(firmData.qr_code_url)
      if (qrBytes) {
        try {
          const isPng = firmData.qr_code_url.toLowerCase().includes('.png')
          const qrImg = isPng ? await doc.embedPng(qrBytes) : await doc.embedJpg(qrBytes)
          page.drawImage(qrImg, { x: margin + 5, y: 50, width: 80, height: 80 })
        } catch (e) {
          console.error('QR error:', e)
        }
      }
    }

    // Bank details box
    drawBox(page, margin + 100, 45, 250, 90)
    page.drawText('Bank Details:', { x: margin + 110, y: 115, size: 9, font: fontBold })
    page.drawText('Acc: 050020110000230', { x: margin + 110, y: 100, size: 8, font })
    page.drawText('IFSC: BKID0000500', { x: margin + 110, y: 88, size: 8, font })
    page.drawText('Bank of India - Main Branch Pune', { x: margin + 110, y: 76, size: 8, font })
    page.drawText(firmData.footer_note || 'Thank you for your business!', { x: margin + 110, y: 58, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

    // Signature box
    drawBox(page, margin + 360, 45, width - margin - 360 - margin, 90)
    page.drawText('For ' + (firmData.name || firm).toUpperCase(), { x: margin + 370, y: 110, size: 9, font: fontBold })
    page.drawText('Authorised Signatory', { x: margin + 370, y: 55, size: 8, font, color: rgb(0.4, 0.4, 0.4) })

    // Footer line
    page.drawText('"Original for Recipient / Duplicate for Supplier"', { x: width / 2 - 110, y: 28, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
    page.drawText(`Software By Memo App | Generated: ${new Date().toLocaleDateString('en-IN')}`, { x: width / 2 - 120, y: 18, size: 7, font, color: rgb(0.6, 0.6, 0.6) })

    const pdfBytes = await doc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename=memo.pdf' },
    })
  } catch (err) {
    console.error('PDF error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
