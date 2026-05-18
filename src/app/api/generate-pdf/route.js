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
      customer = {},
      firmData = {},
      subtotal = 0,
      gstAmt = 0,
      total = 0,
    } = await req.json()

    // =================================================
    // PDF DOCUMENT
    // =================================================

    const doc = await PDFDocument.create()

    // HALF A4 LANDSCAPE STYLE
    const page = doc.addPage([595, 355])

    const font = await doc.embedFont(
      StandardFonts.Helvetica
    )

    const bold = await doc.embedFont(
      StandardFonts.HelveticaBold
    )

    const mono = await doc.embedFont(
      StandardFonts.Courier
    )

    const { width, height } = page.getSize()

    const m = 10

    // =================================================
    // HELPERS
    // =================================================

    const box = (
      x,
      y,
      w,
      h,
      bw = 1
    ) => {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: BLACK,
        borderWidth: bw,
      })
    }

    const line = (
      x1,
      y1,
      x2,
      y2,
      t = 0.8
    ) => {
      page.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: t,
        color: BLACK,
      })
    }

    // =================================================
    // MASTER BORDER
    // =================================================

    box(
      m,
      m,
      width - (m * 2),
      height - (m * 2),
      1.5
    )

    // =================================================
    // TOP SECTION
    // =================================================

    const topH = 42

    const topY = height - m - topH

    box(
      m,
      topY,
      width - (m * 2),
      topH,
      1
    )

    // COLUMN DIVIDERS
    const logoW = 90
    const customerW = 260
    const invoiceW = 110

    const x1 = m + logoW
    const x2 = x1 + customerW
    const x3 = x2 + invoiceW

    line(
      x1,
      topY,
      x1,
      topY + topH,
      1
    )

    line(
      x2,
      topY,
      x2,
      topY + topH,
      1
    )

    line(
      x3,
      topY,
      x3,
      topY + topH,
      1
    )

    // =================================================
    // LOGO
    // =================================================

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

          const logoH = 28

          const logoW2 =
            (logoImg.width / logoImg.height) *
            logoH

          page.drawImage(logoImg, {
            x:
              m +
              ((logoW - logoW2) / 2),
            y: topY + 7,
            width: logoW2,
            height: logoH,
          })
        } catch {}
      }
    }

    // =================================================
    // CUSTOMER DETAILS
    // =================================================

    const cx = x1 + 8

    page.drawText(
      'CUSTOMER DETAILS',
      {
        x: cx,
        y: topY + 28,
        size: 7,
        font: bold,
        color: BLACK,
      }
    )

    page.drawText(
      (
        customer.name ||
        'Walk-in Customer'
      ).toUpperCase(),
      {
        x: cx,
        y: topY + 15,
        size: 9,
        font: bold,
        color: BLACK,
      }
    )

    if (customer.phone) {
      page.drawText(customer.phone, {
        x: cx,
        y: topY + 4,
        size: 7,
        font,
        color: BLACK,
      })
    }

    // =================================================
    // INVOICE NUMBER
    // =================================================

    page.drawText('INVOICE NO', {
      x: x2 + 8,
      y: topY + 26,
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
        x: x2 + 8,
        y: topY + 12,
        size: 8,
        font: mono,
        color: BLACK,
      }
    )

    // =================================================
    // DATE
    // =================================================

    page.drawText('DATE', {
      x: x3 + 8,
      y: topY + 26,
      size: 7,
      font: bold,
      color: BLACK,
    })

    page.drawText(
      parseDate(memo?.created_at),
      {
        x: x3 + 8,
        y: topY + 12,
        size: 8,
        font: mono,
        color: BLACK,
      }
    )

    // =================================================
    // TABLE
    // =================================================

    const visibleRows = 8

    const rowH = 18

    const tableH =
      42 + (visibleRows * rowH)

    const tableY =
      topY - tableH

    box(
      m,
      tableY,
      width - (m * 2),
      tableH,
      1
    )

    // =================================================
    // TAX INVOICE TITLE
    // =================================================

    page.drawText('TAX INVOICE', {
      x: width / 2 - 42,
      y: tableY + tableH - 14,
      size: 11,
      font: bold,
      color: BLACK,
    })

    // =================================================
    // BLACK TABLE HEADER
    // =================================================

    const headerY =
      tableY + tableH - 36

    page.drawRectangle({
      x: m,
      y: headerY,
      width: width - (m * 2),
      height: 22,
      color: BLACK,
    })

    // =================================================
    // COLUMNS
    // =================================================

    const c1 = m + 42
    const c2 = m + 330
    const c3 = m + 405
    const c4 = m + 490

    // VERTICAL LINES
    ;[c1, c2, c3, c4].forEach((x) => {
      line(
        x,
        tableY,
        x,
        tableY + tableH - 14,
        0.8
      )
    })

    // =================================================
    // HEADER TEXT
    // =================================================

    page.drawText('QTY', {
      x: m + 10,
      y: headerY + 7,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('DESCRIPTION', {
      x: c1 + 8,
      y: headerY + 7,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('HSN', {
      x: c2 + 8,
      y: headerY + 7,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('RATE', {
      x: c3 + 8,
      y: headerY + 7,
      size: 8,
      font: bold,
      color: WHITE,
    })

    page.drawText('AMOUNT', {
      x: c4 + 8,
      y: headerY + 7,
      size: 8,
      font: bold,
      color: WHITE,
    })

    // =================================================
    // ITEMS
    // =================================================

    let currentY = headerY

    for (let i = 0; i < visibleRows; i++) {
      currentY -= rowH

      const item = items[i]

      if (!item) continue

      page.drawText(
        String(item.quantity || 0),
        {
          x: m + 10,
          y: currentY + 5,
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

      desc = desc.slice(0, 40)

      page.drawText(desc, {
        x: c1 + 8,
        y: currentY + 5,
        size: 8,
        font,
        color: BLACK,
      })

      page.drawText(
        item.hsn_code || '6101',
        {
          x: c2 + 8,
          y: currentY + 5,
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
        y: currentY + 5,
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
        x:
          width -
          m -
          amtW -
          8,
        y: currentY + 5,
        size: 8,
        font: mono,
        color: BLACK,
      })
    }

    // =================================================
    // FOOTER
    // =================================================

    const footerH = 38

    const footerY =
      tableY - footerH + 1

    box(
      m,
      footerY,
      width - (m * 2),
      footerH,
      1
    )

    // TOTAL DIVIDER
    const totalX = width - 180

    line(
      totalX,
      footerY,
      totalX,
      footerY + footerH,
      1
    )

    // =================================================
    // BANK DETAILS
    // =================================================

    page.drawText(
      'BANK DETAILS',
      {
        x: m + 10,
        y: footerY + 22,
        size: 7,
        font: bold,
        color: BLACK,
      }
    )

    page.drawText(
      'A/C: 050020110000230',
      {
        x: m + 10,
        y: footerY + 9,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    page.drawText(
      'IFSC: BKID0000500',
      {
        x: m + 170,
        y: footerY + 9,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    // =================================================
    // TOTALS
    // =================================================

    const tx = totalX + 10

    page.drawText('SUBTOTAL', {
      x: tx,
      y: footerY + 22,
      size: 7,
      font,
      color: BLACK,
    })

    const subText = inr(subtotal)

    const subW =
      mono.widthOfTextAtSize(
        subText,
        7
      )

    page.drawText(subText, {
      x:
        width -
        m -
        subW -
        8,
      y: footerY + 22,
      size: 7,
      font: mono,
      color: BLACK,
    })

    page.drawText('GST', {
      x: tx,
      y: footerY + 10,
      size: 7,
      font,
      color: BLACK,
    })

    const gstText = inr(gstAmt)

    const gstW =
      mono.widthOfTextAtSize(
        gstText,
        7
      )

    page.drawText(gstText, {
      x:
        width -
        m -
        gstW -
        8,
      y: footerY + 10,
      size: 7,
      font: mono,
      color: BLACK,
    })

    // TOTAL LINE
    line(
      totalX,
      footerY + 8,
      width - m,
      footerY + 8,
      1
    )

    page.drawText('GRAND TOTAL', {
      x: tx,
      y: footerY - 2,
      size: 9,
      font: bold,
      color: BLACK,
    })

    const totalText = inr(total)

    const totalW =
      mono.widthOfTextAtSize(
        totalText,
        10
      )

    page.drawText(totalText, {
      x:
        width -
        m -
        totalW -
        8,
      y: footerY - 2,
      size: 10,
      font: mono,
      color: BLACK,
    })

    // =================================================
    // SAVE PDF
    // =================================================

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
