import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

// ======================================================
// COLORS
// ======================================================

const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)

const DARK = rgb(0.12, 0.12, 0.12)
const GRAY = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.95, 0.95, 0.95)

const GREEN = rgb(0.1, 0.45, 0.2)
const ORANGE = rgb(0.8, 0.5, 0)
const RED = rgb(0.75, 0.1, 0.1)

// ======================================================
// TYPOGRAPHY
// ======================================================

const TYPE = {
  xs: 7,
  sm: 8,
  md: 9,
  lg: 11,
  xl: 14,
  hero: 18,
}

// ======================================================
// HELPERS
// ======================================================

const inr = (n) =>
  `Rs. ${Number(n || 0).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`

function parseDate(date) {
  try {
    return new Date(date)
      .toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .toUpperCase()
  } catch {
    return new Date()
      .toLocaleDateString('en-IN')
      .toUpperCase()
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

    const contentType =
      res.headers.get('content-type') || ''

    const bytes =
      await res.arrayBuffer()

    return {
      bytes,
      contentType,
    }
  } catch {
    return null
  }
}

function line(
  page,
  x1,
  y1,
  x2,
  y2,
  thickness = 1,
  color = BLACK
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color,
  })
}

function box(
  page,
  x,
  y,
  w,
  h,
  thickness = 1,
  color = undefined
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderWidth: thickness,
    borderColor: BLACK,
    color,
  })
}

function text(
  page,
  value,
  x,
  y,
  font,
  size = 9,
  color = BLACK
) {
  page.drawText(String(value || ''), {
    x,
    y,
    size,
    font,
    color,
  })
}

function rightText(
  page,
  value,
  rightX,
  y,
  font,
  size = 9,
  color = BLACK
) {
  const width =
    font.widthOfTextAtSize(
      String(value),
      size
    )

  page.drawText(String(value), {
    x: rightX - width,
    y,
    size,
    font,
    color,
  })
}

// ======================================================
// MAIN
// ======================================================

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
      memoType = 'sale',
    } = await req.json()

    // ==================================================
    // PDF
    // ==================================================

    const doc =
      await PDFDocument.create()

    const page =
      doc.addPage([595, 842])

    const regular =
      await doc.embedFont(
        StandardFonts.Helvetica
      )

    const bold =
      await doc.embedFont(
        StandardFonts.HelveticaBold
      )

    const mono =
      await doc.embedFont(
        StandardFonts.Courier
      )

    const { width, height } =
      page.getSize()

    const M = 28

    // ==================================================
    // MASTER BORDER
    // ==================================================

    box(
      page,
      M,
      M,
      width - M * 2,
      height - M * 2,
      1.4
    )

    // ==================================================
    // WATERMARK
    // ==================================================

    page.drawText('ORIGINAL', {
      x: 170,
      y: 390,
      size: 70,
      rotate: {
        type: 'degrees',
        angle: 35,
      },
      font: bold,
      color: rgb(
        0.95,
        0.95,
        0.95
      ),
    })

    // ==================================================
    // HEADER
    // ==================================================

    let y = height - M

    const headerH = 88
    const halfW =
      (width - M * 2) / 2

    // LEFT
    box(
      page,
      M,
      y - headerH,
      halfW,
      headerH,
      1
    )

    // RIGHT
    box(
      page,
      M + halfW,
      y - headerH,
      halfW,
      headerH,
      1
    )

    // ==================================================
    // LOGO
    // ==================================================

    if (firmData.logo_url) {
      const logo =
        await fetchImage(
          firmData.logo_url
        )

      if (logo) {
        try {
          const img =
            logo.contentType.includes(
              'png'
            )
              ? await doc.embedPng(
                  logo.bytes
                )
              : await doc.embedJpg(
                  logo.bytes
                )

          const padding = 0

          const areaW =
            halfW - padding * 2

          const areaH =
            headerH - padding * 2

          const imgAspect =
            img.width / img.height

          const areaAspect =
            areaW / areaH

          let drawW
          let drawH

          if (
            imgAspect > areaAspect
          ) {
            drawW = areaW
            drawH =
              areaW / imgAspect
          } else {
            drawH = areaH
            drawW =
              areaH * imgAspect
          }

          const x =
            M +
            (halfW - drawW) / 2

          const iy =
            y -
            headerH +
            (headerH - drawH) /
              2

          page.drawImage(img, {
            x,
            y: iy,
            width: drawW,
            height: drawH,
          })
        } catch {}
      }
    }

    // ==================================================
    // CUSTOMER DETAILS
    // ==================================================

    const cx = M + halfW + 16
    let cy = y - 22

    text(
      page,
      'CUSTOMER DETAILS',
      cx,
      cy,
      bold,
      TYPE.md
    )

    cy -= 24

    text(
      page,
      'Customer Name',
      cx,
      cy,
      regular,
      TYPE.sm,
      GRAY
    )

    text(
      page,
      ':',
      cx + 95,
      cy,
      regular,
      TYPE.sm,
      GRAY
    )

    text(
      page,
      customer.name ||
        'Walk-in Customer',
      cx + 110,
      cy,
      bold,
      TYPE.lg,
      DARK
    )

    cy -= 26

    text(
      page,
      'Mobile No',
      cx,
      cy,
      regular,
      TYPE.sm,
      GRAY
    )

    text(
      page,
      ':',
      cx + 95,
      cy,
      regular,
      TYPE.sm,
      GRAY
    )

    text(
      page,
      customer.phone || '-',
      cx + 110,
      cy,
      regular,
      TYPE.md
    )

    y -= headerH + 18

    // ==================================================
    // TITLE ROW
    // ==================================================

    const titleH = 38

    line(
      page,
      M,
      y,
      width - M,
      y,
      2
    )

    line(
      page,
      M,
      y - titleH,
      width - M,
      y - titleH,
      1
    )

    const heading =
      memoType === 'order'
        ? 'ORDER INVOICE'
        : 'TAX INVOICE'

    const headingW =
      bold.widthOfTextAtSize(
        heading,
        TYPE.hero
      )

    text(
      page,
      heading,
      (width - headingW) / 2,
      y - 25,
      bold,
      TYPE.hero
    )

    const dateText =
      parseDate(
        memo?.created_at
      )

    rightText(
      page,
      dateText,
      width - M - 10,
      y - 23,
      mono,
      TYPE.sm,
      GRAY
    )

    y -= titleH + 14

    // ==================================================
    // INVOICE META
    // ==================================================

    text(
      page,
      'Invoice No',
      M + 2,
      y,
      regular,
      TYPE.sm,
      GRAY
    )

    text(
      page,
      memo?.id || 'DRAFT',
      M + 75,
      y,
      mono,
      TYPE.md
    )

    rightText(
      page,
      `Items: ${items.length}`,
      width - M,
      y,
      regular,
      TYPE.sm,
      GRAY
    )

    y -= 18

    // ==================================================
    // PRODUCT TABLE
    // ==================================================

    const rowH = 24
    const headerH2 = 26

    const cols = [
      {
        x: M,
        w: 42,
        label: 'SR',
      },
      {
        x: M + 42,
        w: 50,
        label: 'QTY',
      },
      {
        x: M + 92,
        w: 220,
        label: 'DESCRIPTION',
      },
      {
        x: M + 312,
        w: 70,
        label: 'HSN',
      },
      {
        x: M + 382,
        w: 75,
        label: 'RATE',
      },
      {
        x: M + 457,
        w:
          width -
          M * 2 -
          457,
        label: 'AMOUNT',
      },
    ]

    const minRows = 13

    const visibleRows =
      Math.max(
        items.length,
        minRows
      )

    const tableTop = y

    const tableBottom =
      tableTop -
      headerH2 -
      visibleRows * rowH

    // HEADER BG

    box(
      page,
      M,
      tableTop - headerH2,
      width - M * 2,
      headerH2,
      1,
      LIGHT
    )

    // VERTICALS

    cols.forEach((col, i) => {
      if (i !== cols.length - 1) {
        line(
          page,
          col.x + col.w,
          tableTop,
          col.x + col.w,
          tableBottom,
          1
        )
      }

      const tw =
        bold.widthOfTextAtSize(
          col.label,
          TYPE.sm
        )

      text(
        page,
        col.label,
        col.x +
          (col.w - tw) / 2,
        tableTop - 17,
        bold,
        TYPE.sm
      )
    })

    // OUTER BORDER

    box(
      page,
      M,
      tableBottom,
      width - M * 2,
      tableTop - tableBottom,
      1
    )

    // ITEMS

    let rowY =
      tableTop -
      headerH2 -
      16

    items.forEach((item, i) => {
      text(
        page,
        i + 1,
        cols[0].x + 10,
        rowY,
        regular,
        TYPE.sm
      )

      text(
        page,
        item.quantity || 0,
        cols[1].x + 10,
        rowY,
        regular,
        TYPE.sm
      )

      let desc =
        item.name || '-'

      if (item.size) {
        desc += ` (${item.size})`
      }

      text(
        page,
        desc
          .toUpperCase()
          .slice(0, 38),
        cols[2].x + 8,
        rowY,
        regular,
        TYPE.sm
      )

      text(
        page,
        item.hsn_code ||
          '6101',
        cols[3].x + 8,
        rowY,
        mono,
        TYPE.xs,
        GRAY
      )

      rightText(
        page,
        inr(
          item.unit_price || 0
        ),
        cols[4].x +
          cols[4].w -
          8,
        rowY,
        mono,
        TYPE.sm
      )

      rightText(
        page,
        inr(
          (item.quantity ||
            0) *
            (item.unit_price ||
              0)
        ),
        width - M - 8,
        rowY,
        mono,
        TYPE.sm,
        DARK
      )

      rowY -= rowH
    })

    y = tableBottom - 18

    // ==================================================
    // FOOTER
    // ==================================================

    const footerH = 120

    const col1W = 110
    const col2W = 150
    const col3W = 125

    const col4W =
      width -
      M * 2 -
      col1W -
      col2W -
      col3W

    const fx = M

    // OUTER

    box(
      page,
      fx,
      y - footerH,
      width - M * 2,
      footerH,
      1
    )

    // SPLITS

    const s1 = fx + col1W
    const s2 = s1 + col2W
    const s3 = s2 + col3W

    ;[s1, s2, s3].forEach(
      (sx) => {
        line(
          page,
          sx,
          y,
          sx,
          y - footerH,
          1
        )
      }
    )

    // ==================================================
    // QR
    // ==================================================

    text(
      page,
      'PAYMENT QR',
      fx + 18,
      y - 18,
      bold,
      TYPE.sm
    )

    if (firmData.qr_code_url) {
      const qr =
        await fetchImage(
          firmData.qr_code_url
        )

      if (qr) {
        try {
          const img =
            qr.contentType.includes(
              'png'
            )
              ? await doc.embedPng(
                  qr.bytes
                )
              : await doc.embedJpg(
                  qr.bytes
                )

          page.drawImage(img, {
            x: fx + 15,
            y: y - 100,
            width: 80,
            height: 80,
          })
        } catch {}
      }
    } else {
      text(
        page,
        'NO QR',
        fx + 28,
        y - 58,
        bold,
        TYPE.md,
        GRAY
      )

      text(
        page,
        'AVAILABLE',
        fx + 15,
        y - 74,
        regular,
        TYPE.sm,
        GRAY
      )
    }

    // ==================================================
    // GST
    // ==================================================

    text(
      page,
      'GST BREAKDOWN',
      s1 + 12,
      y - 18,
      bold,
      TYPE.sm
    )

    let gy = y - 42

    text(
      page,
      'Taxable',
      s1 + 12,
      gy,
      regular,
      TYPE.sm,
      GRAY
    )

    rightText(
      page,
      inr(subtotal),
      s2 - 12,
      gy,
      mono,
      TYPE.sm
    )

    gy -= 18

    text(
      page,
      'CGST 2.5%',
      s1 + 12,
      gy,
      regular,
      TYPE.sm,
      GRAY
    )

    rightText(
      page,
      inr(gstAmt / 2),
      s2 - 12,
      gy,
      mono,
      TYPE.sm
    )

    gy -= 18

    text(
      page,
      'SGST 2.5%',
      s1 + 12,
      gy,
      regular,
      TYPE.sm,
      GRAY
    )

    rightText(
      page,
      inr(gstAmt / 2),
      s2 - 12,
      gy,
      mono,
      TYPE.sm
    )

    gy -= 22

    line(
      page,
      s1 + 12,
      gy + 10,
      s2 - 12,
      gy + 10,
      0.8
    )

    text(
      page,
      'TOTAL GST',
      s1 + 12,
      gy - 2,
      bold,
      TYPE.sm
    )

    rightText(
      page,
      inr(gstAmt),
      s2 - 12,
      gy - 2,
      mono,
      TYPE.sm
    )

    // ==================================================
    // PAYMENT STATUS
    // ==================================================

    text(
      page,
      'PAYMENT STATUS',
      s2 + 12,
      y - 18,
      bold,
      TYPE.sm
    )

    const paid =
      memo?.paid_amount || 0

    const balance =
      total - paid

    let status = 'PENDING'
    let statusColor = RED

    if (paid >= total) {
      status = 'PAID IN FULL'
      statusColor = GREEN
    } else if (paid > 0) {
      status = 'PARTIAL'
      statusColor = ORANGE
    }

    text(
      page,
      status,
      s2 + 12,
      y - 46,
      bold,
      TYPE.lg,
      statusColor
    )

    text(
      page,
      `Paid: ${inr(paid)}`,
      s2 + 12,
      y - 72,
      regular,
      TYPE.sm
    )

    text(
      page,
      `Balance: ${inr(
        balance
      )}`,
      s2 + 12,
      y - 92,
      regular,
      TYPE.sm,
      balance > 0
        ? RED
        : GRAY
    )

    // ==================================================
    // TOTALS
    // ==================================================

    const totalX = s3
    const totalW = col4W

    const row1 = y - 38
    const row2 = y - 74
    const row3 = y - 120

    // SUBTOTAL

    box(
      page,
      totalX,
      row1,
      totalW,
      36,
      1,
      LIGHT
    )

    text(
      page,
      'SUB TOTAL',
      totalX + 10,
      row1 + 13,
      regular,
      TYPE.sm
    )

    rightText(
      page,
      inr(subtotal),
      totalX +
        totalW -
        10,
      row1 + 12,
      bold,
      TYPE.md
    )

    // GST

    box(
      page,
      totalX,
      row2,
      totalW,
      36,
      1,
      LIGHT
    )

    text(
      page,
      'GST',
      totalX + 10,
      row2 + 13,
      regular,
      TYPE.sm
    )

    rightText(
      page,
      inr(gstAmt),
      totalX +
        totalW -
        10,
      row2 + 12,
      bold,
      TYPE.md
    )

    // GRAND TOTAL

    box(
      page,
      totalX,
      row3,
      totalW,
      46,
      2,
      BLACK
    )

    page.drawRectangle({
      x: totalX,
      y: row3,
      width: totalW,
      height: 46,
      color: BLACK,
    })

    text(
      page,
      'GRAND TOTAL',
      totalX + 10,
      row3 + 17,
      bold,
      TYPE.md,
      WHITE
    )

    rightText(
      page,
      inr(total),
      totalX +
        totalW -
        10,
      row3 + 15,
      bold,
      TYPE.xl,
      WHITE
    )

    // ==================================================
    // FOOTER NOTE
    // ==================================================

    const footer =
      firmData.footer_note ||
      'Thank you for your business.'

    const fw =
      regular.widthOfTextAtSize(
        footer,
        TYPE.xs
      )

    text(
      page,
      footer,
      (width - fw) / 2,
      28,
      regular,
      TYPE.xs,
      GRAY
    )

    // ==================================================
    // SAVE
    // ==================================================

    const pdfBytes =
      await doc.save({
        useObjectStreams: true,
      })

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
    console.error(
      'PDF ERROR:',
      err
    )

    return Response.json(
      {
        error:
          err?.message ||
          'PDF generation failed',
      },
      {
        status: 500,
      }
    )
  }
    }
