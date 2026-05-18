import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const inr = (n) => `Rs. ${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function parseDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-IN', { 
      day: '2-digit', month: '2-digit', year: 'numeric' 
    }).replace(/\//g, '/')
  } catch { return new Date().toLocaleString('en-IN') }
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
    const navy = rgb(0.102, 0.137, 0.176)
    const gold = rgb(0.804, 0.686, 0.510)
    const gray = rgb(0.45, 0.45, 0.45)
    const lightGray = rgb(0.95, 0.95, 0.95)
    let y = height - 40

    // === HEADER BAND ===
    page.drawRectangle({ x: 0, y: height - 100, width, height: 100, color: navy })

    // Logo in header
    let logoImg = null
    if (firmData.logo_url) {
      const logoBytes = await fetchImage(firmData.logo_url)
      if (logoBytes) {
        try {
          const isPng = firmData.logo_url.toLowerCase().includes('.png')
          logoImg = isPng ? await doc.embedPng(logoBytes) : await doc.embedJpg(logoBytes)
          const logoH = 60
          const logoW = (logoImg.width / logoImg.height) * logoH
          page.drawImage(logoImg, { x: 40, y: height - 90, width: logoW, height: logoH })
        } catch (e) {
          console.error('Logo embed error:', e)
        }
      }
    }

    // Company name in gold
    page.drawText(firmData.name || firm, { x: 40, y: height - 55, size: 20, font: fontBold, color: gold })

    // Invoice type on right
    const invoiceLabel = memoType === 'order' ? 'ORDER INVOICE' : (memoType === 'sale' ? 'CASH INVOICE' : 'CREDIT INVOICE')
    page.drawText('INVOICE', { x: width - 180, y: height - 45, size: 16, font: fontBold, color: rgb(1, 1, 1) })
    page.drawText(invoiceLabel, { x: width - 180, y: height - 65, size: 10, font, color: gold })

    y = height - 110

    // === COMPANY INFO ===
    y -= 5
    if (firmData.address) { 
      page.drawText(firmData.address, { x: 40, y, size: 8, font, color: gray })
      y -= 12
    }
    const infoLine = [
      firmData.gst_number ? `GSTN: ${firmData.gst_number}` : '',
      firmData.phone_number ? `Tel: ${firmData.phone_number}` : '',
    ].filter(Boolean).join('    ')
    if (infoLine) {
      page.drawText(infoLine, { x: 40, y, size: 8, font, color: gray })
      y -= 12
    }
    page.drawText(`Email: ${firmData.email || 'info@' + firm.toLowerCase().replace(/\s/g, '') + '.com'}`, { x: 40, y, size: 8, font, color: gray })
    y -= 20

    // === CUSTOMER & INVOICE INFO BOX ===
    page.drawRectangle({ x: 40, y: y - 55, width: width - 80, height: 55, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 })
    
    // Customer section
    page.drawText('Customer:', { x: 50, y: y - 15, size: 9, font: fontBold, color: navy })
    page.drawText(customer.name || 'Walk-in Customer', { x: 50, y: y - 28, size: 10, font, color: rgb(0, 0, 0) })
    if (customer.phone) {
      page.drawText(`Mob: ${customer.phone}`, { x: 50, y: y - 42, size: 8, font, color: gray })
    }

    // Invoice details
    page.drawText('Invoice No:', { x: width - 250, y: y - 15, size: 9, font: fontBold, color: navy })
    page.drawText((memo?.id || 'DRAFT').toString().slice(0, 12).toUpperCase(), { x: width - 250, y: y - 28, size: 10, font, color: rgb(0, 0, 0) })
    
    page.drawText('Invoice Date:', { x: width - 140, y: y - 15, size: 9, font: fontBold, color: navy })
    page.drawText(parseDate(memo?.created_at), { x: width - 140, y: y - 28, size: 10, font, color: rgb(0, 0, 0) })

    y -= 70

    // === ITEMS TABLE ===
    const tableTop = y
    const colX = { no: 50, desc: 90, hsn: 320, qty: 390, rate: 450, gst: 510, amt: 540 }

    // Table header
    page.drawRectangle({ x: 40, y: tableTop - 20, width: width - 80, height: 20, color: lightGray })
    page.drawText('Sr', { x: colX.no, y: tableTop - 14, size: 9, font: fontBold })
    page.drawText('Description of Goods', { x: colX.desc, y: tableTop - 14, size: 9, font: fontBold })
    page.drawText('HSN', { x: colX.hsn, y: tableTop - 14, size: 9, font: fontBold })
    page.drawText('Qty', { x: colX.qty, y: tableTop - 14, size: 9, font: fontBold })
    page.drawText('Rate', { x: colX.rate, y: tableTop - 14, size: 9, font: fontBold })
    page.drawText('GST%', { x: colX.gst, y: tableTop - 14, size: 9, font: fontBold })
    page.drawText('Amount', { x: colX.amt, y: tableTop - 14, size: 9, font: fontBold })

    y = tableTop - 35

    // Table rows
    items.forEach((item, idx) => {
      const amount = item.unit_price * item.quantity
      const rowH = 18
      
      // Alternating row background
      if (idx % 2 === 0) {
        page.drawRectangle({ x: 40, y: y - rowH + 5, width: width - 80, height: rowH, color: rgb(0.98, 0.98, 0.98) })
      }

      page.drawText(String(idx + 1), { x: colX.no + 5, y, size: 9, font })
      page.drawText((item.name || '—').slice(0, 30), { x: colX.desc, y, size: 9, font })
      if (item.size) {
        page.drawText(`Size: ${item.size}`, { x: colX.desc, y: y - 10, size: 7, font, color: gray })
      }
      page.drawText(item.hsn_code || '6101', { x: colX.hsn, y, size: 9, font })
      page.drawText(String(item.quantity), { x: colX.qty, y, size: 9, font })
      page.drawText(inr(item.unit_price), { x: colX.rate, y, size: 9, font })
      page.drawText('5.00%', { x: colX.gst, y, size: 9, font })
      page.drawText(inr(amount), { x: colX.amt, y, size: 9, font })

      y -= item.size ? rowH + 5 : rowH
    })

    // Table border
    page.drawRectangle({ x: 40, y: y, width: width - 80, height: tableTop - y - 20, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 })

    y -= 20

    // === GST BREAKDOWN TABLE ===
    if (gstAmt > 0) {
      y -= 10
      const gstTableY = y
      
      // Header
      page.drawRectangle({ x: 40, y: gstTableY - 18, width: 200, height: 18, color: lightGray })
      page.drawText('GST', { x: 50, y: gstTableY - 12, size: 9, font: fontBold })
      page.drawText('Taxable', { x: 90, y: gstTableY - 12, size: 9, font: fontBold })
      page.drawText('SGST', { x: 145, y: gstTableY - 12, size: 9, font: fontBold })
      page.drawText('CGST', { x: 190, y: gstTableY - 12, size: 9, font: fontBold })

      // Data row
      y = gstTableY - 32
      page.drawText('GST 5%', { x: 50, y, size: 9, font })
      page.drawText(inr(subtotal), { x: 90, y, size: 9, font })
      page.drawText(inr(gstAmt / 2), { x: 145, y, size: 9, font })
      page.drawText(inr(gstAmt / 2), { x: 190, y, size: 9, font })

      // Total row
      y -= 15
      page.drawRectangle({ x: 40, y: y - 5, width: 200, height: 18, color: lightGray })
      page.drawText('Total', { x: 50, y, size: 9, font: fontBold })
      page.drawText(inr(subtotal), { x: 90, y, size: 9, font: fontBold })
      page.drawText(inr(gstAmt / 2), { x: 145, y, size: 9, font: fontBold })
      page.drawText(inr(gstAmt / 2), { x: 190, y, size: 9, font: fontBold })

      page.drawText(`TOTAL GST: ${inr(gstAmt)}`, { x: 50, y: y - 20, size: 10, font: fontBold })

      y -= 35
    }

    // === NET AMOUNT BOX ===
    page.drawRectangle({ x: width - 220, y: y - 35, width: 180, height: 35, borderColor: navy, borderWidth: 1 })
    page.drawText('Net Amount', { x: width - 210, y: y - 15, size: 10, font })
    page.drawText(inr(total), { x: width - 210, y: y - 28, size: 14, font: fontBold, color: navy })

    y -= 50

    // === FOOTER ===
    if (firmData.qr_code_url) {
      const qrBytes = await fetchImage(firmData.qr_code_url)
      if (qrBytes) {
        try {
          const isPng = firmData.qr_code_url.toLowerCase().includes('.png')
          const qrImg = isPng ? await doc.embedPng(qrBytes) : await doc.embedJpg(qrBytes)
          page.drawImage(qrImg, { x: 50, y: 50, width: 70, height: 70 })
        } catch (e) {
          console.error('QR embed error:', e)
        }
      }
    }

    // Bank details
    page.drawText('Bank Details:', { x: 140, y: 100, size: 8, font: fontBold })
    page.drawText('Acc: 050020110000230  |  IFSC: BKID0000500', { x: 140, y: 90, size: 7, font, color: gray })
    page.drawText('Bank of India - Main Branch Pune', { x: 140, y: 80, size: 7, font, color: gray })

    // Signature
    page.drawText('For ' + (firmData.name || firm).toUpperCase(), { x: width - 180, y: 90, size: 8, font: fontBold })
    page.drawText('Authorised Signatory', { x: width - 180, y: 65, size: 7, font, color: gray })

    // Footer note
    page.drawLine({ start: { x: 40, y: 45 }, end: { x: width - 40, y: 45 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) })
    const footerText = firmData.footer_note || 'Thank you for your business!'
    page.drawText(footerText, { x: width / 2 - (footerText.length * 2), y: 32, size: 8, font, color: gray })
    page.drawText('"Original for Recipient / Duplicate for Supplier"', { x: width / 2 - 100, y: 20, size: 7, font, color: rgb(0.6, 0.6, 0.6) })

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
