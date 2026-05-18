import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)

const inr = (n) =>
  `Rs. ${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function parseDate(iso) {
  try {
    const d = new Date(iso)

    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).toUpperCase()
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

    // =========================================
    // DOCUMENT
    // =========================================

    const doc = await PDFDocument.create()

    // HALF A4 LANDSCAPE STYLE COMPACT
    const page = doc.addPage([595, 360])

    const font = await doc.embedFont(StandardFonts.Helvetica)
    const bold = await doc.embedFont(StandardFonts.HelveticaBold)
    const mono = await doc.embedFont(StandardFonts.Courier)

    const { width, height } = page.getSize()

    const m = 14

    // =========================================
    // HELPERS
    // =========================================

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

    const line = (x1, y1, x2, y2, t = 0.8) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: t,
        color: BLACK,
      })
    }

    // =========================================
    // MASTER OUTER BORDER
    // =========================================

    box(
      m,
      m,
      width - (m * 2),
      height - (m * 2),
      1.5
    )

    // =========================================
    // HEADER
    // =========================================

    const headerH = 42
    const headerY = height - m - headerH

    box(
      m,
      headerY,
      width - (m * 2),
      headerH,
      1
    )

    // LOGO
    if (firmData.logo_url) {
      const logoBytes = await fetchImage(
        firmData.logo_url
      )

      if (logoBytes) {
        try {
          const isPng =
            firmData.logo_url
              .toLowerCase()
              .includes('.png')

          const logoImg = isPng
            ? await doc.embedPng(logoBytes)
            : await doc.embedJpg(logoBytes)

          const logoH = 24
          const logoW =
            (logoImg.width / logoImg.height) *
            logoH

          page.drawImage(logoImg, {
            x: m + 10,
            y: headerY + 9,
            width: logoW,
            height: logoH,
          })
        } catch {}
      }
    }

    // RIGHT SIDE TITLE
    const title =
      memoType === 'order'
        ? 'ORDER'
        : 'INVOICE'

    const titleSize = 18

    const titleW =
      bold.widthOfTextAtSize(
        title,
        titleSize
      )

    page.drawText(title, {
      x: width - m - titleW - 12,
      y: headerY + 12,
      size: titleSize,
      font: bold,
      color: BLACK,
    })

    // =========================================
    // CUSTOMER + META
    // =========================================

    const infoH = 45
    const infoY = headerY - infoH

    box(
      m,
      infoY,
      width - (m * 2),
      infoH
    )

    // CENTER DIVIDER
    line(
      width / 2,
      infoY,
      width / 2,
      infoY + infoH,
      1
    )

    // LEFT
    page.drawText('BILL TO', {
      x: m + 8,
      y: infoY + 30,
      size: 7,
      font: bold,
      color: BLACK,
    })

    page.drawText(
      customer.name || 'Walk-in Customer',
      {
        x: m + 8,
        y: infoY + 16,
        size: 10,
        font: bold,
        color: BLACK,
      }
    )

    if (customer.phone) {
      page.drawText(customer.phone, {
        x: m + 8,
        y: infoY + 5,
        size: 7,
        font,
        color: BLACK,
      })
    }

    // RIGHT
    const rx = width / 2 + 10

    page.drawText('INVOICE NO', {
      x: rx,
      y: infoY + 30,
      size: 7,
      font: bold,
      color: BLACK,
    })

    page.drawText(
      (memo?.id || 'DRAFT')
        .toString()
        .slice(0, 12)
        .toUpperCase(),
      {
        x: rx + 75,
        y: infoY + 30,
        size: 8,
        font: mono,
        color: BLACK,
      }
    )

    page.drawText('DATE', {
      x: rx,
      y: infoY + 14,
      size: 7,
      font: bold,
      color: BLACK,
    })

    page.drawText(
      parseDate(memo?.created_at),
      {
        x: rx + 75,
        y: infoY + 14,
        size: 8,
        font,
        color: BLACK,
      }
    )

    // =========================================
    // TABLE
    // =========================================

    const visibleRows = Math.max(items.length, 3)

    const rowH = 20
    const tableH =
      24 + (visibleRows * rowH)

    const tableY =
      infoY - tableH

    box(
      m,
      tableY,
      width - (m * 2),
      tableH
    )

    // HEADER BG
    page.drawRectangle({
      x: m,
      y: tableY + tableH - 24,
      width: width - (m * 2),
      height: 24,
      color: BLACK,
    })

    // COLUMNS
    const c1 = m + 40
    const c2 = m + 330
    const c3 = m + 405
    const c4 = m + 490

    // VERTICAL LINES
    ;[c1, c2, c3, c4].forEach((x) => {
      line(
        x,
        tableY,
        x,
        tableY + tableH,
        0.8
      )
    })

    // HEADER TEXT
    page.drawText('QTY', {
      x: m + 10,
      y: tableY + tableH - 15,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('DESCRIPTION', {
      x: c1 + 10,
      y: tableY + tableH - 15,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('HSN', {
      x: c2 + 10,
      y: tableY + tableH - 15,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('RATE', {
      x: c3 + 10,
      y: tableY + tableH - 15,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('AMOUNT', {
      x: c4 + 10,
      y: tableY + tableH - 15,
      size: 8,
      font: bold,
      color: WHITE,
    })

    // ROWS
    let currentY =
      tableY + tableH - 24

    for (let i = 0; i < visibleRows; i++) {
      currentY -= rowH

      line(
        m,
        currentY,
        width - m,
        currentY,
        0.6
      )

      const item = items[i]

      if (!item) continue

      page.drawText(
        String(item.quantity || 0),
        {
          x: m + 10,
          y: currentY + 6,
          size: 8,
          font,
          color: BLACK,
        }
      )

      let desc = (
        item.name || '-'
      ).toUpperCase()

      if (item.size) {
        desc += ` (${item.size})`
      }

      desc = desc.slice(0, 38)

      page.drawText(desc, {
        x: c1 + 8,
        y: currentY + 6,
        size: 8,
        font,
        color: BLACK,
      })

      page.drawText(
        item.hsn_code || '6101',
        {
          x: c2 + 8,
          y: currentY + 6,
          size: 8,
          font: mono,
          color: BLACK,
        }
      )

      const rate = inr(
        item.unit_price || 0
      )

      page.drawText(rate, {
        x: c3 + 8,
        y: currentY + 6,
        size: 8,
        font: mono,
        color: BLACK,
      })

      const amt = inr(
        (item.quantity || 0) *
          (item.unit_price || 0)
      )

      const amtW =
        mono.widthOfTextAtSize(amt, 8)

      page.drawText(amt, {
        x: width - m - amtW - 8,
        y: currentY + 6,
        size: 8,
        font: mono,
        color: BLACK,
      })
    }

    // =========================================
    // FOOTER + TOTALS MERGED
    // =========================================

    const footerH = 52
    const footerY = tableY - footerH

    box(
      m,
      footerY,
      width - (m * 2),
      footerH
    )

    // DIVIDERS
    const leftDiv = 145
    const rightDiv = width - 180

    line(
      leftDiv,
      footerY,
      leftDiv,
      footerY + footerH,
      1
    )

    line(
      rightDiv,
      footerY,
      rightDiv,
      footerY + footerH,
      1
    )

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
            x: m + 8,
            y: footerY + 8,
            width: 36,
            height: 36,
          })
        } catch {}
      }
    }

    // BANK
    page.drawText('BANK DETAILS', {
      x: leftDiv + 10,
      y: footerY + 34,
      size: 7,
      font: bold,
      color: BLACK,
    })

    page.drawText(
      'A/C: 050020110000230',
      {
        x: leftDiv + 10,
        y: footerY + 22,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    page.drawText(
      'IFSC: BKID0000500',
      {
        x: leftDiv + 10,
        y: footerY + 10,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    // TOTALS
    let tx = rightDiv + 12
    let ty = footerY + 34

    page.drawText('SUBTOTAL', {
      x: tx,
      y: ty,
      size: 7,
      font,
      color: BLACK,
    })

    const sub = inr(subtotal)

    const subW =
      mono.widthOfTextAtSize(sub, 7)

    page.drawText(sub, {
      x: width - m - subW - 8,
      y: ty,
      size: 7,
      font: mono,
      color: BLACK,
    })

    ty -= 12

    page.drawText('GST', {
      x: tx,
      y: ty,
      size: 7,
      font,
      color: BLACK,
    })

    const gst = inr(gstAmt)

    const gstW =
      mono.widthOfTextAtSize(gst, 7)

    page.drawText(gst, {
      x: width - m - gstW - 8,
      y: ty,
      size: 7,
      font: mono,
      color: BLACK,
    })

    // TOTAL LINE
    line(
      rightDiv,
      footerY + 16,
      width - m,
      footerY + 16,
      1
    )

    const totalText = inr(total)

    const totalW =
      mono.widthOfTextAtSize(
        totalText,
        10
      )

    page.drawText('TOTAL', {
      x: tx,
      y: footerY + 5,
      size: 10,
      font: bold,
      color: BLACK,
    })

    page.drawText(totalText, {
      x: width - m - totalW - 8,
      y: footerY + 5,
      size: 10,
      font: mono,
      color: BLACK,
    })

    // =========================================
    // SAVE
    // =========================================

    const pdfBytes = await doc.save()

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type':
          'application/pdf',
        'Content-Disposition':
          'inline; filename=invoice.pdf',
      },
    })
  } catch (err) {
    console.error('PDF error:', err)

    return Response.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    )
  }
      }
