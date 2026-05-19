import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const inr = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.92, 0.92, 0.92)

function parseDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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

export async function POST(req) {
  try {
    const { memo, items = [], firm, firmData = {}, customer = {}, subtotal = 0, gstAmt = 0, total = 0, memoType = 'sale' } = await req.json()

    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 842])
    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    
    const { width, height } = page.getSize()
    const m = 30
    let y = height - m

    // === 1. HEADER - TWO EQUAL HALVES ===
    const headerH = 80
    const halfW = (width - 2 * m) / 2

    // Left box - Logo (fills entire box, no margin)
    page.drawRectangle({ x: m, y: y - headerH, width: halfW, height: headerH, borderColor: BLACK, borderWidth: 1 })
    
    if (firmData.logo_url) {
      const logoBytes = await fetchImage(firmData.logo_url)
      if (logoBytes) {
        try {
          const isPng = firmData.logo_url.toLowerCase().includes('.png')
          const logoImg = isPng ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes)
          
          // Scale logo to fit the box perfectly
          const boxAspect = halfW / headerH
          const imgAspect = logoImg.width / logoImg.height
          let logoW, logoH
          
          if (imgAspect > boxAspect) {
            logoW = halfW
            logoH = halfW / imgAspect
          } else {
            logoH = headerH
            logoW = headerH * imgAspect
          }
          
          const logoX = m + (halfW - logoW) / 2
          const logoY = y - headerH + (headerH - logoH) / 2
          
          page.drawImage(logoImg, { x: logoX, y: logoY, width: logoW, height: logoH })
        } catch (e) {
          console.error('Logo error:', e)
        }
      }
    }

    // Right box - Customer details
    page.drawRectangle({ x: m + halfW, y: y - headerH, width: halfW, height: headerH, borderColor: BLACK, borderWidth: 1 })
    
    let custY = y - 25
    page.drawText('Customer Name:', { x: m + halfW + 10, y: custY, size: 9, font, color: GRAY })
    custY -= 15
    page.drawText(customer.name || 'Walk-in Customer', { x: m + halfW + 10, y: custY, size: 11, font: fontBold })
    custY -= 25
    page.drawText('Mobile No:', { x: m + halfW + 10, y: custY, size: 9, font, color: GRAY })
    custY -= 15
    page.drawText(customer.phone || 'N/A', { x: m + halfW + 10, y: custY, size: 10, font })

    y -= headerH + 15

    // === 2. DOCUMENT HEADING - LONG ROW ===
    const headingH = 35
    page.drawRectangle({ x: m, y: y - headingH, width: width - 2 * m, height: headingH, borderColor: BLACK, borderWidth: 1, color: BLACK })
    
    const invoiceType = memoType === 'order' ? 'ORDER INVOICE' : 'TAX INVOICE'
    const headingText = invoiceType + ' #' + (memo?.id || 'DRAFT').toString().slice(0, 12).toUpperCase()
    const headingW = fontBold.widthOfTextAtSize(headingText, 14)
    page.drawText(headingText, { x: (width - headingW) / 2, y: y - 22, size: 14, font: fontBold, color: WHITE })
    
    const dateText = parseDate(memo?.created_at)
    const dateW = font.widthOfTextAtSize(dateText, 9)
    page.drawText(dateText, { x: width - m - dateW - 10, y: y - 22, size: 9, font, color: WHITE })

    y -= headingH + 15

    // === 3. PRODUCT TABLE - VERTICAL LINES ONLY ===
    const tableTop = y
    const rowH = 20
    const minRows = 12

    // Column definitions
    const cols = [
      { x: m, w: 40, label: 'SR' },
      { x: m + 40, w: 50, label: 'QTY' },
      { x: m + 90, w: 200, label: 'DESCRIPTION' },
      { x: m + 290, w: 60, label: 'HSN' },
      { x: m + 350, w: 70, label: 'RATE' },
      { x: m + 420, w: width - 2 * m - 420, label: 'AMOUNT' }
    ]

    // Table header
    page.drawRectangle({ x: m, y: y - rowH, width: width - 2 * m, height: rowH, borderColor: BLACK, borderWidth: 1, color: LIGHT })
    cols.forEach((col, idx) => {
      if (idx < cols.length - 1) {
        page.drawLine({ 
          start: { x: col.x + col.w, y: y - rowH }, 
          end: { x: col.x + col.w, y: y - rowH - (items.length + 1) * rowH }, 
          thickness: 1, 
          color: BLACK 
        })
      }
      page.drawText(col.label, { x: col.x + 5, y: y - 13, size: 9, font: fontBold })
    })
    y -= rowH

    // Items (no horizontal lines between rows)
    items.forEach((item, idx) => {
      page.drawText(String(idx + 1), { x: cols[0].x + 5, y: y - 13, size: 9, font })
      page.drawText(String(item.quantity), { x: cols[1].x + 5, y: y - 13, size: 9, font })
      
      let desc = (item.name || '—').slice(0, 32)
      if (item.size) desc += ` (${item.size})`
      page.drawText(desc, { x: cols[2].x + 5, y: y - 13, size: 9, font })
      
      page.drawText(item.hsn_code || '6101', { x: cols[3].x + 5, y: y - 13, size: 8, font, color: GRAY })
      page.drawText(inr(item.unit_price), { x: cols[4].x + 5, y: y - 13, size: 9, font })
      
      const amt = inr(item.unit_price * item.quantity)
      const amtW = font.widthOfTextAtSize(amt, 9)
      page.drawText(amt, { x: cols[5].x + cols[5].w - amtW - 5, y: y - 13, size: 9, font: fontBold })
      
      y -= rowH
    })

    // Empty rows to maintain table height
    for (let i = items.length; i < minRows; i++) {
      y -= rowH
    }

    // Table border (top, bottom, left, right only)
    page.drawRectangle({ 
      x: m, 
      y: y, 
      width: width - 2 * m, 
      height: tableTop - y, 
      borderColor: BLACK, 
      borderWidth: 1 
    })

    y -= 20

    // === 4. FOOTER - 4 COLUMNS ===
    const footerH = 110
    const col1W = 100  // QR
    const col2W = 150  // GST breakdown
    const col3W = 130  // Payment status
    const col4W = width - 2 * m - col1W - col2W - col3W  // Totals

    // Column 1 - Payment QR
    page.drawRectangle({ x: m, y: y - footerH, width: col1W, height: footerH, borderColor: BLACK, borderWidth: 1 })
    
    if (firmData.qr_code_url) {
      const qrBytes = await fetchImage(firmData.qr_code_url)
      if (qrBytes) {
        try {
          const isPng = firmData.qr_code_url.toLowerCase().includes('.png')
          const qrImg = isPng ? await doc.embedPng(qrBytes) : await doc.embedJpg(qrBytes)
          const qrSize = 80
          page.drawImage(qrImg, { 
            x: m + (col1W - qrSize) / 2, 
            y: y - footerH + (footerH - qrSize) / 2, 
            width: qrSize, 
            height: qrSize 
          })
        } catch (e) {
          console.error('QR error:', e)
        }
      }
    }

    // Column 2 - GST Breakdown
    page.drawRectangle({ x: m + col1W, y: y - footerH, width: col2W, height: footerH, borderColor: BLACK, borderWidth: 1 })
    
    let gstY = y - 20
    page.drawText('GST BREAKDOWN', { x: m + col1W + 8, y: gstY, size: 8, font: fontBold })
    gstY -= 18
    
    if (gstAmt > 0) {
      page.drawText(`Taxable: ${inr(subtotal)}`, { x: m + col1W + 8, y: gstY, size: 8, font, color: GRAY })
      gstY -= 14
      page.drawText(`CGST @ 2.5%: ${inr(gstAmt / 2)}`, { x: m + col1W + 8, y: gstY, size: 8, font })
      gstY -= 14
      page.drawText(`SGST @ 2.5%: ${inr(gstAmt / 2)}`, { x: m + col1W + 8, y: gstY, size: 8, font })
      gstY -= 14
      page.drawText(`Total GST: ${inr(gstAmt)}`, { x: m + col1W + 8, y: gstY, size: 8, font: fontBold })
    } else {
      page.drawText('No GST', { x: m + col1W + 8, y: gstY, size: 8, font, color: GRAY })
    }

    // Column 3 - Payment Status (LOGIC-BASED)
    page.drawRectangle({ x: m + col1W + col2W, y: y - footerH, width: col3W, height: footerH, borderColor: BLACK, borderWidth: 1 })
    
    let payY = y - 20
    page.drawText('PAYMENT STATUS', { x: m + col1W + col2W + 8, y: payY, size: 8, font: fontBold })
    payY -= 18
    
    // Logic-based payment status
    const paidAmount = memo?.paid_amount || 0
    const balance = total - paidAmount
    const paymentMethod = memo?.payment_method || 'pending'
    
    if (paidAmount >= total) {
      page.drawText('PAID IN FULL', { x: m + col1W + col2W + 8, y: payY, size: 9, font: fontBold, color: rgb(0, 0.5, 0) })
      payY -= 14
      page.drawText(`via ${paymentMethod.toUpperCase()}`, { x: m + col1W + col2W + 8, y: payY, size: 8, font })
      payY -= 14
      page.drawText(`Amt: ${inr(paidAmount)}`, { x: m + col1W + col2W + 8, y: payY, size: 8, font })
    } else if (paidAmount > 0) {
      page.drawText('PARTIAL PAYMENT', { x: m + col1W + col2W + 8, y: payY, size: 9, font: fontBold, color: rgb(0.8, 0.5, 0) })
      payY -= 14
      page.drawText(`Paid: ${inr(paidAmount)}`, { x: m + col1W + col2W + 8, y: payY, size: 8, font })
      payY -= 14
      page.drawText(`Balance: ${inr(balance)}`, { x: m + col1W + col2W + 8, y: payY, size: 8, font, color: rgb(0.8, 0, 0) })
    } else {
      page.drawText('PENDING', { x: m + col1W + col2W + 8, y: payY, size: 9, font: fontBold, color: rgb(0.7, 0, 0) })
      payY -= 14
      page.drawText(`Bill Balance: ${inr(total)}`, { x: m + col1W + col2W + 8, y: payY, size: 8, font })
    }

    // Column 4 - Totals (3-row table)
    const totalX = m + col1W + col2W + col3W
    
    // Row 1 - Subtotal
    const row1Y = y - 35
    page.drawRectangle({ x: totalX, y: row1Y, width: col4W, height: 35, borderColor: BLACK, borderWidth: 1, color: LIGHT })
    page.drawText('SUB TOTAL', { x: totalX + 8, y: row1Y + 20, size: 9, font })
    const subW = fontBold.widthOfTextAtSize(inr(subtotal), 11)
    page.drawText(inr(subtotal), { x: totalX + col4W - subW - 8, y: row1Y + 18, size: 11, font: fontBold })
    
    // Row 2 - GST
    const row2Y = row1Y - 35
    page.drawRectangle({ x: totalX, y: row2Y, width: col4W, height: 35, borderColor: BLACK, borderWidth: 1, color: LIGHT })
    page.drawText('GST', { x: totalX + 8, y: row2Y + 20, size: 9, font })
    const gstW = fontBold.widthOfTextAtSize(inr(gstAmt), 11)
    page.drawText(inr(gstAmt), { x: totalX + col4W - gstW - 8, y: row2Y + 18, size: 11, font: fontBold })
    
    // Row 3 - Grand Total
    const row3Y = row2Y - 40
    page.drawRectangle({ x: totalX, y: row3Y, width: col4W, height: 40, borderColor: BLACK, borderWidth: 1, color: BLACK })
    page.drawText('GRAND TOTAL', { x: totalX + 8, y: row3Y + 23, size: 10, font: fontBold, color: WHITE })
    const totalW = fontBold.widthOfTextAtSize(inr(total), 14)
    page.drawText(inr(total), { x: totalX + col4W - totalW - 8, y: row3Y + 20, size: 14, font: fontBold, color: WHITE })

    // Footer note
    const footerNote = firmData.footer_note || 'Thank you for your business!'
    const noteW = font.widthOfTextAtSize(footerNote, 8)
    page.drawText(footerNote, { x: (width - noteW) / 2, y: 20, size: 8, font, color: GRAY })

    const pdfBytes = await doc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename=invoice.pdf' },
    })
  } catch (err) {
    console.error('PDF error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
        }
