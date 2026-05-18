import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)

const inr = (n) =>
  `Rs. ${Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function parseDate(iso) {
  try {
    const d = new Date(iso)

    return d
      .toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .toUpperCase()
  } catch {
    return new Date().toLocaleDateString('en-IN')
  }
}

async function fetchImage(url) {
  if (!url) return null

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!res.ok) return null

    return await res.arrayBuffer()
  } catch {
    return null
  }
}

export async function POST(req) {
  try {
    const {
      memo,
      items = [],
      firm,
      firmData = {},
      customer = {},
      subtotal = 0,
      gstAmt = 0,
      total = 0,
      memoType = 'sale',
    } = await req.json()

    // HALF A4
    const doc = await PDFDocument.create()
    const page = doc.addPage([595, 421])

    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
    const mono = await doc.embedFont(StandardFonts.Courier)

    const { width, height } = page.getSize()

    // TIGHT MARGIN
    const m = 18

    // MASTER OUTER BORDER
    page.drawRectangle({
      x: m,
      y: m,
      width: width - (m * 2),
      height: height - (m * 2),
      borderColor: BLACK,
      borderWidth: 1.2,
    })

    // HELPER
    const box = (x, y, w, h, bw = 1) => {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: BLACK,
        borderWidth: bw,
      })
    }

    // ==================================================
    // HEADER
    // ==================================================

    const headerY = height - m - 55

    box(m, headerY, width - (m * 2), 55)

    // LOGO
    if (firmData.logo_url) {
      const logoBytes = await fetchImage(firmData.logo_url)

      if (logoBytes) {
        try {
          const isPng =
            firmData.logo_url.toLowerCase().includes('.png')

          const logoImg = isPng
            ? await doc.embedPng(logoBytes)
            : await doc.embedJpg(logoBytes)

          const logoH = 28
          const logoW =
            (logoImg.width / logoImg.height) * logoH

          page.drawImage(logoImg, {
            x: m + 10,
            y: headerY + 14,
            width: logoW,
            height: logoH,
          })
        } catch {}
      }
    }

    // TITLE
    const invoiceLabel =
      memoType === 'order'
        ? 'ORDER'
        : 'INVOICE'

    const titleSize = 20

    const titleW =
      fontBold.widthOfTextAtSize(
        invoiceLabel,
        titleSize
      )

    page.drawText(invoiceLabel, {
      x: width - m - titleW - 12,
      y: headerY + 18,
      size: titleSize,
      font: fontBold,
      color: BLACK,
    })

    // ==================================================
    // CUSTOMER + INFO
    // ==================================================

    const infoY = headerY - 60

    box(m, infoY, width - (m * 2), 55)

    // CENTER DIVIDER
    page.drawLine({
      start: { x: width / 2, y: infoY },
      end: { x: width / 2, y: infoY + 55 },
      thickness: 1,
      color: BLACK,
    })

    // LEFT SIDE
    page.drawText('BILL TO', {
      x: m + 8,
      y: infoY + 40,
      size: 8,
      font: fontBold,
      color: BLACK,
    })

    page.drawText(
      customer.name || 'Walk-in Customer',
      {
        x: m + 8,
        y: infoY + 24,
        size: 10,
        font: fontBold,
        color: BLACK,
      }
    )

    if (customer.phone) {
      page.drawText(customer.phone, {
        x: m + 8,
        y: infoY + 10,
        size: 8,
        font,
        color: BLACK,
      })
    }

    // RIGHT SIDE
    const rx = width / 2 + 10

    page.drawText('INVOICE NO', {
      x: rx,
      y: infoY + 40,
      size: 8,
      font: fontBold,
      color: BLACK,
    })

    page.drawText(
      (memo?.id || 'DRAFT')
        .toString()
        .slice(0, 12)
        .toUpperCase(),
      {
        x: rx,
        y: infoY + 25,
        size: 9,
        font: mono,
        color: BLACK,
      }
    )

    page.drawText(parseDate(memo?.created_at), {
      x: rx,
      y: infoY + 10,
      size: 8,
      font,
      color: BLACK,
    })

    // ==================================================
    // ITEMS TABLE
    // ==================================================

    const tableY = infoY - 145
    const tableH = 140

    box(m, tableY, width - (m * 2), tableH)

    // HEADER HEIGHT
    const headH = 22

    // HEADER BG
    page.drawRectangle({
      x: m,
      y: tableY + tableH - headH,
      width: width - (m * 2),
      height: headH,
      color: BLACK,
    })

    // COLUMN POSITIONS
    const c1 = m
    const c2 = m + 55
    const c3 = width - m - 185
    const c4 = width - m - 125
    const c5 = width - m - 75

    // VERTICAL LINES
    ;[c2, c3, c4, c5].forEach((x) => {
      page.drawLine({
        start: { x, y: tableY },
        end: { x, y: tableY + tableH },
        thickness: 0.7,
        color: BLACK,
      })
    })

    // HEADER TEXT
    page.drawText('QTY', {
      x: c1 + 8,
      y: tableY + tableH - 15,
      size: 8,
      font: fontBold,
      color: WHITE,
    })

    page.drawText('DESCRIPTION', {
      x: c2 + 8,
      y: tableY + tableH - 15,
      size: 8,
      font: fontBold,
      color: WHITE,
    })

    page.drawText('HSN', {
      x: c3 + 8,
      y: tableY + tableH - 15,
      size: 8,
      font: fontBold,
      color: WHITE,
    })

    page.drawText('RATE', {
      x: c4 + 8,
      y: tableY + tableH - 15,
      size: 8,
      font: fontBold,
      color: WHITE,
    })

    page.drawText('AMOUNT', {
      x: c5 + 8,
      y: tableY + tableH - 15,
      size: 8,
      font: fontBold,
      color: WHITE,
    })

    // ROWS
    const rowH = 20
    let rowY = tableY + tableH - headH

    items.slice(0, 5).forEach((item) => {
      rowY -= rowH

      // HORIZONTAL LINE
      page.drawLine({
        start: { x: m, y: rowY },
        end: { x: width - m, y: rowY },
        thickness: 0.5,
        color: BLACK,
      })

      page.drawText(String(item.quantity || 0), {
        x: c1 + 8,
        y: rowY + 6,
        size: 8,
        font,
        color: BLACK,
      })

      let desc = (item.name || '-').slice(0, 28)

      if (item.size) {
        desc += ` (${item.size})`
      }

      page.drawText(desc, {
        x: c2 + 8,
        y: rowY + 6,
        size: 8,
        font,
        color: BLACK,
      })

      page.drawText(item.hsn_code || '6101', {
        x: c3 + 8,
        y: rowY + 6,
        size: 8,
        font: mono,
        color: BLACK,
      })

      page.drawText(
        inr(item.unit_price || 0),
        {
          x: c4 + 8,
          y: rowY + 6,
          size: 8,
          font: mono,
          color: BLACK,
        }
      )

      const amt = inr(
        (item.quantity || 0) *
          (item.unit_price || 0)
      )

      const amtW =
        mono.widthOfTextAtSize(amt, 8)

      page.drawText(amt, {
        x: width - m - amtW - 8,
        y: rowY + 6,
        size: 8,
        font: mono,
        color: BLACK,
      })
    })

    // ==================================================
    // TOTALS
    // ==================================================

    const totalY = tableY - 65

    box(width - 210, totalY, 192, 55)

    let ty = totalY + 38

    page.drawText('SUBTOTAL', {
      x: width - 195,
      y: ty,
      size: 8,
      font,
      color: BLACK,
    })

    const subText = inr(subtotal)

    const subW =
      mono.widthOfTextAtSize(subText, 8)

    page.drawText(subText, {
      x: width - 30 - subW,
      y: ty,
      size: 8,
      font: mono,
      color: BLACK,
    })

    ty -= 14

    page.drawText('GST', {
      x: width - 195,
      y: ty,
      size: 8,
      font,
      color: BLACK,
    })

    const gstText = inr(gstAmt)

    const gstW =
      mono.widthOfTextAtSize(gstText, 8)

    page.drawText(gstText, {
      x: width - 30 - gstW,
      y: ty,
      size: 8,
      font: mono,
      color: BLACK,
    })

    // TOTAL LINE
    page.drawLine({
      start: {
        x: width - 210,
        y: totalY + 18,
      },
      end: {
        x: width - 18,
        y: totalY + 18,
      },
      thickness: 1,
      color: BLACK,
    })

    page.drawText('TOTAL', {
      x: width - 195,
      y: totalY + 5,
      size: 10,
      font: fontBold,
      color: BLACK,
    })

    const totalText = inr(total)

    const totalW =
      mono.widthOfTextAtSize(totalText, 10)

    page.drawText(totalText, {
      x: width - 30 - totalW,
      y: totalY + 5,
      size: 10,
      font: mono,
      color: BLACK,
    })

    // ==================================================
    // FOOTER
    // ==================================================

    const footerY = m + 8

    box(m, footerY, width - (m * 2), 45)

    // DIVIDERS
    page.drawLine({
      start: { x: 130, y: footerY },
      end: { x: 130, y: footerY + 45 },
      thickness: 0.7,
      color: BLACK,
    })

    page.drawLine({
      start: { x: width - 150, y: footerY },
      end: { x: width - 150, y: footerY + 45 },
      thickness: 0.7,
      color: BLACK,
    })

    // QR
    if (firmData.qr_code_url) {
      const qrBytes = await fetchImage(
        firmData.qr_code_url
      )

      if (qrBytes) {
        try {
          const isPng =
            firmData.qr_code_url
              .toLowerCase()
              .includes('.png')

          const qrImg = isPng
            ? await doc.embedPng(qrBytes)
            : await doc.embedJpg(qrBytes)

          page.drawImage(qrImg, {
            x: m + 5,
            y: footerY + 5,
            width: 35,
            height: 35,
          })
        } catch {}
      }
    }

    // BANK
    page.drawText('BANK DETAILS', {
      x: 140,
      y: footerY + 30,
      size: 7,
      font: fontBold,
      color: BLACK,
    })

    page.drawText(
      'A/C: 050020110000230',
      {
        x: 140,
        y: footerY + 18,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    page.drawText(
      'IFSC: BKID0000500',
      {
        x: 140,
        y: footerY + 8,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    // SIGN
    page.drawText(
      'AUTHORIZED SIGNATORY',
      {
        x: width - 140,
        y: footerY + 18,
        size: 7,
        font: fontBold,
        color: BLACK,
      }
    )

    const pdfBytes = await doc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'inline; filename=invoice.pdf',
      },
    })
  } catch (err) {
    console.error('PDF error:', err)

    return Response.json(
      { error: err.message },
      { status: 500 }
    )
  }
        }
