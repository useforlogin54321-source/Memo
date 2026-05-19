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
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0',
      },
    })

    if (!res.ok) return null

    return {
      bytes:
        await res.arrayBuffer(),
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
    x + 105,
    y,
    labelFont,
    FONT.md,
    GRAY
  )

  text(
    page,
    value,
    x + 120,
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
    // PDF INIT
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
      try {
        const logo =
          await fetchImage(
            firmData.logo_url
          )

        if (logo?.bytes) {
          let img

          try {
            img =
              await doc.embedPng(
                logo.bytes
              )
          } catch {
            img =
              await doc.embedJpg(
                logo.bytes
              )
          }

          const logoBoxW =
            half - 4

          const logoBoxH =
            headerH - 4

          const imgRatio =
            img.width / img.height

          let drawW =
            logoBoxW

          let drawH =
            drawW / imgRatio

          if (
            drawH > logoBoxH
          ) {
            drawH = logoBoxH
            drawW =
              drawH * imgRatio
          }

          const lx =
            M +
            (logoBoxW -
              drawW) /
              2 +
            2

          const ly =
            headerY +
            (logoBoxH -
              drawH) /
              2 +
            2

          page.drawImage(img, {
            x: lx,
            y: ly,
            width: drawW,
            height: drawH,
          })
        }
      } catch (err) {
        console.error(
          'LOGO ERROR:',
          err
        )
      }
    }

    // ==================================================
    // CUSTOMER DETAILS
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
    // TITLE
    // ==================================================

    const titleH = 38
    const titleY =
      headerY - titleH

    box(
      page,
      M,
      titleY,
      width - M * 2,
      titleH,
      1,
      BLACK
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
      FONT.hero,
      WHITE
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

    // HEADER ROW

    const th = 28

    box(
      page,
      M,
      tableTop - th,
      width - M * 2,
      th,
      1,
      LIGHT
    )

    // BETTER COLUMN WIDTHS

    const c1 = M + 55
    const c2 = M + 320
    const c3 = M + 395
    const c4 = M + 475

    ;[c1, c2, c3, c4].forEach(
      (x) => {
        line(
          page,
          x,
          tableY,
          x,
          tableTop
        )
      }
    )

    // HEADERS

    text(
      page,
      'QTY',
      M + 12,
      tableTop - 18,
      bold
    )

    text(
      page,
      'DESCRIPTION',
      c1 + 70,
      tableTop - 18,
      bold
    )

    text(
      page,
      'HSN',
      c2 + 15,
      tableTop - 18,
      bold
    )

    text(
      page,
      'RATE',
      c3 + 12,
      tableTop - 18,
      bold
    )

    text(
      page,
      'AMOUNT',
      c4 + 12,
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
          M + 16,
          y,
          regular,
          9
        )

        let desc = (
          item.name || '-'
        ).toUpperCase()

        if (item.size) {
          desc += ` (${item.size})`
        }

        desc = desc.slice(0, 40)

        text(
          page,
          desc,
          c1 + 8,
          y,
          regular,
          9
        )

        text(
          page,
          item.hsn_code ||
            '6101',
          c2 + 10,
          y,
          mono,
          9,
          GRAY
        )

        text(
          page,
          inr(
            item.unit_price || 0
          ),
          c3 + 8,
          y,
          mono,
          9
        )

        // FIXED AMOUNT ALIGNMENT

        const amount = inr(
          (item.quantity || 0) *
            (item.unit_price ||
              0)
        )

        rightText(
          page,
          amount,
          width - 28,
          y,
          mono,
          9
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
    // QR SECTION
    // ==================================================

    text(
      page,
      'PAYMENT QR',
      M + 24,
      footerY + 95,
      bold
    )

    if (qrCodeUrl) {
      try {
        const qr =
          await fetchImage(
            qrCodeUrl
          )

        if (qr?.bytes) {
          let img

          try {
            img =
              await doc.embedPng(
                qr.bytes
              )
          } catch {
            img =
              await doc.embedJpg(
                qr.bytes
              )
          }

          const qrSize = 82

          page.drawImage(img, {
            x: M + 24,
            y: footerY + 18,
            width: qrSize,
            height: qrSize,
          })
        } else {
          text(
            page,
            'QR NOT FOUND',
            M + 24,
            footerY + 50,
            regular,
            8,
            GRAY
          )
        }
      } catch (err) {
        console.error(
          'QR ERROR:',
          err
        )

        text(
          page,
          'QR ERROR',
          M + 24,
          footerY + 50,
          regular,
          8,
          GRAY
        )
      }
    }

    // ==================================================
    // GST BREAKDOWN
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
        regular,
        9
      )

      rightText(
        page,
        v,
        f2 - 18,
        gy,
        mono,
        9
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
        regular,
        9
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
    // FOOTER NOTE
    // ==================================================

    const footerText =
      firmData.footer_note ||
      'Thank you for your business'

    const fw =
      regular.widthOfTextAtSize(
        footerText,
        8
      )

    text(
      page,
      footerText,
      (width - fw) / 2,
      4,
      regular,
      8,
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
