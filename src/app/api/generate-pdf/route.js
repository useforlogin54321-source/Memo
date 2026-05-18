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

    // ==================================================
    // DOCUMENT
    // ==================================================

    const doc = await PDFDocument.create()

    // HALF A4 STYLE
    const page = doc.addPage([595, 380])

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

    const m = 14

    // ==================================================
    // HELPERS
    // ==================================================

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

    // ==================================================
    // OUTER BORDER
    // ==================================================

    box(
      m,
      m,
      width - (m * 2),
      height - (m * 2),
      1.5
    )

    // ==================================================
    // TOP SECTION
    // ==================================================

    const topH = 62
    const topY = height - m - topH

    box(
      m,
      topY,
      width - (m * 2),
      topH
    )

    // LOGO DIVIDER
    const logoSectionW = 110

    line(
      m + logoSectionW,
      topY,
      m + logoSectionW,
      topY + topH,
      1
    )

    // ==================================================
    // LOGO
    // ==================================================

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

          const logoH = 38

          const logoW =
            (logoImg.width / logoImg.height) *
            logoH

          page.drawImage(logoImg, {
            x:
              m +
              ((logoSectionW - logoW) / 2),
            y: topY + 12,
            width: logoW,
            height: logoH,
          })
        } catch {}
      }
    }

    // ==================================================
    // CUSTOMER DETAILS
    // ==================================================

    const cx = m + logoSectionW + 10

    page.drawText(
      'CUSTOMER DETAILS',
      {
        x: cx,
        y: topY + 45,
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
        y: topY + 30,
        size: 10,
        font: bold,
        color: BLACK,
      }
    )

    if (customer.phone) {
      page.drawText(customer.phone, {
        x: cx,
        y: topY + 17,
        size: 8,
        font,
        color: BLACK,
      })
    }

    if (customer.address) {
      page.drawText(
        customer.address
          .toUpperCase()
          .slice(0, 55),
        {
          x: cx,
          y: topY + 5,
          size: 7,
          font,
          color: BLACK,
        }
      )
    }

    // ==================================================
    // META ROW
    // ==================================================

    const metaH = 24
    const metaY = topY - metaH

    box(
      m,
      metaY,
      width - (m * 2),
      metaH
    )

    page.drawText(
      `INVOICE NO: ${(
        memo?.id || 'DRAFT'
      )
        .toString()
        .slice(0, 12)
        .toUpperCase()}`,
      {
        x: m + 10,
        y: metaY + 7,
        size: 8,
        font: mono,
        color: BLACK,
      }
    )

    const dateText = `DATE: ${parseDate(
      memo?.created_at
    )}`

    const dateW =
      mono.widthOfTextAtSize(
        dateText,
        8
      )

    page.drawText(dateText, {
      x: width - m - dateW - 10,
      y: metaY + 7,
      size: 8,
      font: mono,
      color: BLACK,
    })

    // ==================================================
    // DOCUMENT TITLE
    // ==================================================

    const titleH = 28
    const titleY = metaY - titleH

    box(
      m,
      titleY,
      width - (m * 2),
      titleH
    )

    const invoiceLabel =
      memoType === 'order'
        ? 'ORDER'
        : 'TAX INVOICE'

    const titleSize = 13

    const titleW =
      bold.widthOfTextAtSize(
        invoiceLabel,
        titleSize
      )

    page.drawText(invoiceLabel, {
      x: (width - titleW) / 2,
      y: titleY + 8,
      size: titleSize,
      font: bold,
      color: BLACK,
    })

    // ==================================================
    // TABLE
    // ==================================================

    const visibleRows = 6

    const rowH = 18

    const tableH =
      24 + (visibleRows * rowH)

    const tableY =
      titleY - tableH

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

    // HEADER BOTTOM LINE
    line(
      m,
      tableY + tableH - 24,
      width - m,
      tableY + tableH - 24,
      1
    )

    // COLUMNS
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

    // ITEMS
    let currentY =
      tableY + tableH - 24

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

      desc = desc.slice(0, 38)

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

    // ==================================================
    // FOOTER
    // ==================================================

    const footerH = 42
    const footerY =
      tableY - footerH + 1

    box(
      m,
      footerY,
      width - (m * 2),
      footerH
    )

    const totalSectionW = 180

    line(
      width - totalSectionW,
      footerY,
      width - totalSectionW,
      footerY + footerH,
      1
    )

    // BANK DETAILS
    page.drawText(
      'BANK DETAILS',
      {
        x: m + 10,
        y: footerY + 25,
        size: 7,
        font: bold,
        color: BLACK,
      }
    )

    page.drawText(
      'A/C: 050020110000230',
      {
        x: m + 10,
        y: footerY + 13,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    page.drawText(
      'IFSC: BKID0000500',
      {
        x: m + 180,
        y: footerY + 13,
        size: 7,
        font: mono,
        color: BLACK,
      }
    )

    // TOTALS
    const tx =
      width - totalSectionW + 12

    page.drawText('SUBTOTAL', {
      x: tx,
      y: footerY + 25,
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
      y: footerY + 25,
      size: 7,
      font: mono,
      color: BLACK,
    })

    page.drawText('GST', {
      x: tx,
      y: footerY + 13,
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
      y: footerY + 13,
      size: 7,
      font: mono,
      color: BLACK,
    })

    // TOTAL LINE
    line(
      width - totalSectionW,
      footerY + 10,
      width - m,
      footerY + 10,
      1
    )

    page.drawText('TOTAL', {
      x: tx,
      y: footerY + 1,
      size: 10,
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
      y: footerY + 1,
      size: 10,
      font: mono,
      color: BLACK,
    })

    // ==================================================
    // SAVE
    // ==================================================

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
