import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const inr = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)
const GRAY = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.95, 0.95, 0.95)

function parseDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  } catch { return new Date().toLocaleDateString('en-IN').toUpperCase() }
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
    const m = 40 // margin
    let y = height - 50

    // === LOGO (CENTERED, LARGE) ===
    if (firmData.logo_url) {
      const logoBytes = await fetchImage(firmData.logo_url)
      if (logoBytes) {
        try {
          const isPng = firmData.logo_url.toLowerCase().includes('.png')
          const logoImg = isPng ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes)
          const logoH = 70
          const logoW = (logoImg.width / logoImg.height) * logoH
          page.drawImage(logoImg, { x: (width - logoW) / 2, y: y - logoH, width: logoW, height: logoH })
        } catch (e) {
          console.error('Logo error:', e)
        }
      }
    }
    
    y -= 90

    // === INVOICE TYPE - BOLD CENTER ===
    const invoiceLabel = memoType === 'order' ? 'ORDER' : 'INVOICE'
    page.drawText(invoiceLabel, { x: width / 2 - fontBold.widthOfTextAtSize(invoiceLabel, 32) / 2, y, size: 32, font: fontBold, color: BLACK })
    y -= 50

    // === DIVIDER LINE ===
    page.drawRectangle({ x: m, y, width: width - 2 * m, height: 2, color: BLACK })
    y -= 30

    // === GRID LAYOUT: Left info | Right info ===
    const col1 = m
    const col2 = width / 2 + 20
    const labelSize = 7
    const valueSize = 10

    // LEFT COLUMN
    let leftY = y
    page.drawText('INVOICE NO.', { x: col1, y: leftY, size: labelSize, font: fontBold, color: GRAY })
    leftY -= 15
    page.drawText((memo?.id || 'DRAFT').toString().slice(0, 12).toUpperCase(), { x: col1, y: leftY, size: valueSize, font: fontBold, color: BLACK })
    leftY -= 25
    
    page.drawText('DATE', { x: col1, y: leftY, size: labelSize, font: fontBold, color: GRAY })
    leftY -= 15
    page.drawText(parseDate(memo?.created_at), { x: col1, y: leftY, size: valueSize, font, color: BLACK })
    leftY -= 25

    page.drawText('BILL TO', { x: col1, y: leftY, size: labelSize, font: fontBold, color: GRAY })
    leftY -= 15
    page.drawText(customer.name || 'Walk-in Customer', { x: col1, y: leftY, size: valueSize, font: fontBold, color: BLACK })
    leftY -= 15
    if (customer.phone) {
      page.drawText(customer.phone, { x: col1, y: leftY, size: 8, font, color: GRAY })
      leftY -= 20
    }

    // RIGHT COLUMN
    let rightY = y
    page.drawText('FROM', { x: col2, y: rightY, size: labelSize, font: fontBold, color: GRAY })
    rightY -= 15
    page.drawText(firmData.name || firm, { x: col2, y: rightY, size: valueSize, font: fontBold, color: BLACK })
    rightY -= 15
    if (firmData.address) {
      const addr = firmData.address.slice(0, 40)
      page.drawText(addr, { x: col2, y: rightY, size: 7, font, color: GRAY })
      rightY -= 12
    }
    if (firmData.phone_number) {
      page.drawText(`T: ${firmData.phone_number}`, { x: col2, y: rightY, size: 7, font, color: GRAY })
      rightY -= 12
    }
    if (firmData.gst_number) {
      page.drawText(`GSTIN: ${firmData.gst_number}`, { x: col2, y: rightY, size: 7, font, color: GRAY })
      rightY -= 12
    }

    y = Math.min(leftY, rightY) - 30

    // === DIVIDER ===
    page.drawRectangle({ x: m, y, width: width - 2 * m, height: 1, color: LIGHT })
    y -= 25

    // === ITEMS TABLE - MINIMAL GRID ===
    page.drawText('ITEMS', { x: m, y, size: 9, font: fontBold, color: BLACK })
    y -= 20

    // Column positions
    const c1 = m
    const c2 = m + 50
    const c3 = width - m - 180
    const c4 = width - m - 110
    const c5 = width - m - 60
    const c6 = width - m

    // Header
    page.drawRectangle({ x: m, y: y - 18, width: width - 2 * m, height: 18, color: BLACK })
    page.drawText('QTY', { x: c1 + 4, y: y - 12, size: 8, font: fontBold, color: WHITE })
    page.drawText('DESCRIPTION', { x: c2 + 4, y: y - 12, size: 8, font: fontBold, color: WHITE })
    page.drawText('HSN', { x: c3 + 4, y: y - 12, size: 8, font: fontBold, color: WHITE })
    page.drawText('RATE', { x: c4 + 4, y: y - 12, size: 8, font: fontBold, color: WHITE })
    page.drawText('AMOUNT', { x: c5 + 4, y: y - 12, size: 8, font: fontBold, color: WHITE })
    y -= 18

    // Items
    items.forEach((item, idx) => {
      const rowH = 22
      if (idx % 2 === 0) {
        page.drawRectangle({ x: m, y: y - rowH, width: width - 2 * m, height: rowH, color: LIGHT })
      }
      
      page.drawText(String(item.quantity), { x: c1 + 4, y: y - 14, size: 9, font })
      
      let desc = (item.name || '—').slice(0, 35)
      if (item.size) desc += ` · ${item.size}`
      page.drawText(desc, { x: c2 + 4, y: y - 14, size: 9, font })
      
      page.drawText(item.hsn_code || '6101', { x: c3 + 4, y: y - 14, size: 8, font, color: GRAY })
      page.drawText(inr(item.unit_price), { x: c4 + 4, y: y - 14, size: 9, font })
      
      const amt = inr(item.unit_price * item.quantity)
      const amtW = font.widthOfTextAtSize(amt, 9)
      page.drawText(amt, { x: c6 - amtW - 4, y: y - 14, size: 9, font: fontBold })
      
      y -= rowH
    })

    y -= 15

    // === SUMMARY SECTION ===
    page.drawRectangle({ x: m, y: y - 1, width: width - 2 * m, height: 1, color: BLACK })
    y -= 25

    const sumX = width - m - 180
    const valX = width - m - 60

    if (gstAmt > 0) {
      // Taxable
      page.drawText('TAXABLE AMOUNT', { x: sumX, y, size: 9, font, color: GRAY })
      const subW = font.widthOfTextAtSize(inr(subtotal), 9)
      page.drawText(inr(subtotal), { x: valX + 60 - subW, y, size: 9, font })
      y -= 16

      // CGST
      page.drawText('CGST @ 2.5%', { x: sumX, y, size: 9, font, color: GRAY })
      const cgstW = font.widthOfTextAtSize(inr(gstAmt / 2), 9)
      page.drawText(inr(gstAmt / 2), { x: valX + 60 - cgstW, y, size: 9, font })
      y -= 16

      // SGST
      page.drawText('SGST @ 2.5%', { x: sumX, y, size: 9, font, color: GRAY })
      const sgstW = font.widthOfTextAtSize(inr(gstAmt / 2), 9)
      page.drawText(inr(gstAmt / 2), { x: valX + 60 - sgstW, y, size: 9, font })
      y -= 20
    } else {
      page.drawText('SUBTOTAL', { x: sumX, y, size: 9, font, color: GRAY })
      const subW = font.widthOfTextAtSize(inr(subtotal), 9)
      page.drawText(inr(subtotal), { x: valX + 60 - subW, y, size: 9, font })
      y -= 20
    }

    // TOTAL - BOLD, LARGE
    page.drawRectangle({ x: sumX - 10, y: y - 35, width: 190, height: 35, color: BLACK })
    page.drawText('TOTAL', { x: sumX, y: y - 15, size: 11, font: fontBold, color: WHITE })
    const totalText = inr(total)
    const totalW = fontBold.widthOfTextAtSize(totalText, 16)
    page.drawText(totalText, { x: valX + 60 - totalW, y: y - 15, size: 16, font: fontBold, color: WHITE })

    y -= 50

    // === FOOTER SECTION ===
    page.drawRectangle({ x: m, y: 120, width: width - 2 * m, height: 1, color: LIGHT })

    // QR Code
    if (firmData.qr_code_url) {
      const qrBytes = await fetchImage(firmData.qr_code_url)
      if (qrBytes) {
        try {
          const isPng = firmData.qr_code_url.toLowerCase().includes('.png')
          const qrImg = isPng ? await doc.embedPng(qrBytes) : await doc.embedJpg(qrBytes)
          page.drawImage(qrImg, { x: m, y: 30, width: 70, height: 70 })
        } catch (e) {
          console.error('QR error:', e)
        }
      }
    }

    // Bank Details - Minimal
    page.drawText('BANK DETAILS', { x: m + 90, y: 100, size: 7, font: fontBold, color: BLACK })
    page.drawText('Acc: 050020110000230', { x: m + 90, y: 88, size: 7, font, color: GRAY })
    page.drawText('IFSC: BKID0000500', { x: m + 90, y: 76, size: 7, font, color: GRAY })
    page.drawText('Bank of India', { x: m + 90, y: 64, size: 7, font, color: GRAY })

    // Signature
    page.drawText('AUTHORIZED SIGNATORY', { x: width - m - 120, y: 100, size: 7, font: fontBold, color: BLACK })
    page.drawText(firmData.name || firm, { x: width - m - 120, y: 70, size: 8, font, color: GRAY })

    // Footer note - centered
    const footer = firmData.footer_note || 'Thank you for your business'
    const footerW = font.widthOfTextAtSize(footer, 8)
    page.drawText(footer, { x: (width - footerW) / 2, y: 35, size: 8, font, color: GRAY })
    
    page.drawText('Generated by Memo App', { x: (width - font.widthOfTextAtSize('Generated by Memo App', 7)) / 2, y: 20, size: 7, font, color: LIGHT })

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
