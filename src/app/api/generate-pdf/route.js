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
const GRAY = rgb(0.45, 0.45, 0.45)
const LIGHT = rgb(0.96, 0.96, 0.96)

// ======================================================
// TYPOGRAPHY
// ======================================================

const FONT = {
  xs: 7,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  hero: 24,
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

function parseDate(iso) {
  try {
    return new Date(iso)
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
    const res = await fetch(url)

    if (!res.ok) return null

    return {
      bytes: await res.arrayBuffer(),
      type:
        res.headers.get(
          'content-type'
        ) || '',
    }
  } catch {
    return null
  }
}

// ======================================================
// DRAW HELPERS
// ======================================================

function line(
  page,
  x1,
  y1,
  x2,
  y2,
  thickness = 1
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: BLACK,
  })
}

function box(
  page,
  x,
  y,
  w,
  h,
  borderWidth = 1,
  fill = null
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderWidth,
    borderColor: BLACK,
    color: fill || undefined,
  })
}

function text(
  page,
  value,
  x,
  y,
  font,
  size = FONT.md,
  color = BLACK
) {
  page.drawText(
    String(value || ''),
    {
      x,
      y,
      size,
      font,
      color,
    }
  )
}

function rightText(
  page,
  value,
  rightX,
  y,
  font,
  size = FONT.md,
  color = BLACK
) {
  const w =
    font.widthOfTextAtSize(
      String(value),
      size
    )

  page.drawText(String(value), {
    x: rightX - w,
    y,
    size,
    font,
    color,
  })
}

function labelValue(
  page,
  label,
  value,
  x,
  y,
  labelFont,
  valueFont
) {
  text(
    page,
    label,
    x,
    y,
    labelFont,
    FONT.md,
    GRAY
  )

  text(
    page,
    ':',
    x + 110,
    y,
    labelFont,
    FONT.md,
    GRAY
  )

  text(
    page,
    value,
    x + 125,
    y,
    valueFont,
    FONT.md
  )
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
      qrCodeUrl,
    } = await req.json()

    // ==================================================
    // PDF
    // ==================================================

    const doc =
      await PDFDocument.create()

    const page =
      doc.addPage([595, 420])

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

    const M = 10

    // ==================================================
    // MASTER BORDER
    // ==================================================

    box(
      page,
      M,
      M,
      width - M * 2,
      height - M * 2,
      1.5
    )

    // ==================================================
    // HEADER
    // ==================================================

    const headerH = 100
    const headerY =
      height - M - headerH

    box(
      page,
      M,
      headerY,
      width - M * 2,
      headerH
    )

    const half =
      (width - M * 2) / 2

    line(
      page,
      M + half,
      headerY,
      M + half,
      headerY + headerH
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
            logo.type.includes(
              'png'
            )
              ? await doc.embedPng(
                  logo.bytes
                )
              : await doc.embedJpg(
                  logo.bytes
                )

          page.drawImage(img, {
            x: M + 2,
            y: headerY + 2,
            width: half - 4,
            height: headerH - 4,
          })
        } catch {}
      }
    }

    // ==================================================
    // CUSTOMER
    // ==================================================

    text(
      page,
      'CUSTOMER DETAILS',
      M + half + 20,
      headerY + 70,
      bold,
      FONT.lg
    )

    labelValue(
      page,
      'Customer Name',
      customer.name ||
        'Walk-in Customer',
      M + half + 20,
      headerY + 42,
      regular,
      bold
    )

    labelValue(
      page,
      'Mobile No',
      customer.phone || '-',
      M + half + 20,
      headerY + 18,
      regular,
      regular
    )

    // ==================================================
    // TITLE ROW
    // ==================================================

    const titleH = 38
    const titleY =
      headerY - titleH

    box(
      page,
      M,
      titleY,
      width - M * 2,
      titleH
    )

    const title =
      'TAX INVOICE'

    const tw =
      bold.widthOfTextAtSize(
        title,
        FONT.hero
      )

    text(
      page,
      title,
      (width - tw) / 2,
      titleY + 8,
      bold,
      FONT.hero
    )

    // ==================================================
    // META ROW
    // ==================================================

    const metaH = 32
    const metaY = titleY - metaH

    box(
      page,
      M,
      metaY,
      width - M * 2,
      metaH
    )

    labelValue(
      page,
      'Invoice No',
      memo?.id || 'DRAFT',
      M + 15,
      metaY + 10,
      regular,
      mono
    )

    labelValue(
      page,
      'Date',
      parseDate(
        memo?.created_at
      ),
      width - 240,
      metaY + 10,
      regular,
      mono
    )

    // ==================================================
    // PRODUCT TABLE
    // ==================================================

    const tableY = 130
    const tableTop = metaY

    box(
      page,
      M,
      tableY,
      width - M * 2,
      tableTop - tableY
    )

    const th = 28

    line(
      page,
      M,
      tableTop - th,
      width - M,
      tableTop - th
    )

    const cols = {
      qty: M + 60,
      desc: M + 360,
      hsn: M + 450,
      rate: M + 530,
    }

    ;[
      cols.qty,
      cols.desc,
      cols.hsn,
      cols.rate,
    ].forEach((x) => {
      line(
        page,
        x,
        tableY,
        x,
        tableTop
      )
    })

    text(
      page,
      'QTY',
      M + 18,
      tableTop - 18,
      bold
    )

    text(
      page,
      'DESCRIPTION',
      cols.qty + 80,
      tableTop - 18,
      bold
    )

    text(
      page,
      'HSN',
      cols.desc + 20,
      tableTop - 18,
      bold
    )

    text(
      page,
      'RATE',
      cols.hsn + 15,
      tableTop - 18,
      bold
    )

    text(
      page,
      'AMOUNT',
      cols.rate + 10,
      tableTop - 18,
      bold
    )

    // ==================================================
    // ITEMS
    // ==================================================

    let y = tableTop - 52

    items
      .slice(0, 7)
      .forEach((item) => {
        text(
          page,
          item.quantity || 0,
          M + 20,
          y,
          regular
        )

        text(
          page,
          (
            item.name || '-'
          )
            .toUpperCase()
            .slice(0, 42),
          cols.qty + 10,
          y,
          regular
        )

        text(
          page,
          item.hsn_code ||
            '6101',
          cols.desc + 12,
          y,
          mono
        )

        text(
          page,
          inr(
            item.unit_price || 0
          ),
          cols.hsn + 8,
          y,
          mono
        )

        rightText(
          page,
          inr(
            (item.quantity ||
              0) *
              (item.unit_price ||
                0)
          ),
          width - 20,
          y,
          mono
        )

        y -= 26
      })

    // ==================================================
    // FOOTER
    // ==================================================

    const footerH = 120
    const footerY = 10

    box(
      page,
      M,
      footerY,
      width - M * 2,
      footerH
    )

    const f1 = M + 140
    const f2 = M + 290
    const f3 = M + 410

    ;[f1, f2, f3].forEach((x) =>
      line(
        page,
        x,
        footerY,
        x,
        footerY + footerH
      )
    )

    // ==================================================
    // QR
    // ==================================================

    text(
      page,
      'PAYMENT QR',
      M + 24,
      footerY + 95,
      bold
    )

    if (qrCodeUrl) {
      const qr =
        await fetchImage(
          qrCodeUrl
        )

      if (qr) {
        try {
          const img =
            qr.type.includes(
              'png'
            )
              ? await doc.embedPng(
                  qr.bytes
                )
              : await doc.embedJpg(
                  qr.bytes
                )

          page.drawImage(img, {
            x: M + 20,
            y: footerY + 15,
            width: 90,
            height: 90,
          })
        } catch {}
      }
    }

    // ==================================================
    // GST
    // ==================================================

    text(
      page,
      'GST BREAKDOWN',
      f1 + 18,
      footerY + 95,
      bold
    )

    const gstRows = [
      [
        'CGST (9%)',
        inr(gstAmt / 2),
      ],
      [
        'SGST (9%)',
        inr(gstAmt / 2),
      ],
      ['IGST', 'Rs. 0.00'],
    ]

    let gy = footerY + 70

    gstRows.forEach(([k, v]) => {
      text(
        page,
        k,
        f1 + 18,
        gy,
        regular
      )

      rightText(
        page,
        v,
        f2 - 18,
        gy,
        mono
      )

      gy -= 25
    })

    // ==================================================
    // PAYMENT STATUS
    // ==================================================

    text(
      page,
      'PAYMENT STATUS',
      f2 + 18,
      footerY + 95,
      bold
    )

    const statusRows = [
      'Cash Paid',
      'UPI Paid',
      'Bill Balance',
    ]

    let py = footerY + 70

    statusRows.forEach((s) => {
      text(
        page,
        s,
        f2 + 18,
        py,
        regular
      )

      py -= 25
    })

    // ==================================================
    // TOTALS
    // ==================================================

    const tx = f3
    const split = tx + 120

    line(
      page,
      tx,
      footerY + 80,
      width - M,
      footerY + 80
    )

    line(
      page,
      tx,
      footerY + 40,
      width - M,
      footerY + 40
    )

    line(
      page,
      split,
      footerY,
      split,
      footerY + footerH
    )

    const totalRows = [
      [
        'SUB TOTAL',
        inr(subtotal),
        footerY + 90,
        FONT.lg,
      ],
      [
        'GST TOTAL',
        inr(gstAmt),
        footerY + 50,
        FONT.lg,
      ],
      [
        'GRAND TOTAL',
        inr(total),
        footerY + 12,
        13,
      ],
    ]

    totalRows.forEach(
      ([label, value, ty, size]) => {
        text(
          page,
          label,
          tx + 18,
          ty,
          bold,
          size
        )

        rightText(
          page,
          value,
          width - 20,
          ty,
          mono,
          size
        )
      }
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
    console.error(err)

    return Response.json(
      {
        error:
          err.message ||
          'PDF generation failed',
      },
      {
        status: 500,
      }
    )
  }
      }
