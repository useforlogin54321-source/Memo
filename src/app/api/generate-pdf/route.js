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
const DARK = rgb(0.12, 0.12, 0.12)
const LIGHT = rgb(0.96, 0.96, 0.96)
const MID = rgb(0.7, 0.7, 0.7)

// ======================================================
// TYPOGRAPHY
// ======================================================

const TYPE = {
  xs: 7,
  sm: 8,
  md: 9,
  lg: 12,
  xl: 18,
}

// ======================================================
// SPACING
// ======================================================

const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
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
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!res.ok) return null

    const contentType =
      res.headers.get('content-type') || ''

    const bytes = await res.arrayBuffer()

    return {
      bytes,
      contentType,
    }
  } catch {
    return null
  }
}

function drawLine(
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

function drawText(
  page,
  text,
  x,
  y,
  {
    size = TYPE.sm,
    font,
    color = BLACK,
  }
) {
  page.drawText(String(text || ''), {
    x,
    y,
    size,
    font,
    color,
  })
}

function drawRightText(
  page,
  text,
  rightX,
  y,
  {
    size = TYPE.sm,
    font,
    color = BLACK,
  }
) {
  const width =
    font.widthOfTextAtSize(
      String(text),
      size
    )

  page.drawText(String(text), {
    x: rightX - width,
    y,
    size,
    font,
    color,
  })
}

function wrapText(
  text,
  font,
  size,
  maxWidth
) {
  const words = String(text).split(' ')
  const lines = []

  let current = ''

  for (const word of words) {
    const test = current
      ? `${current} ${word}`
      : word

    const width =
      font.widthOfTextAtSize(
        test,
        size
      )

    if (width <= maxWidth) {
      current = test
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)

  return lines
}

function chunk(array, size) {
  const out = []

  for (
    let i = 0;
    i < array.length;
    i += size
  ) {
    out.push(array.slice(i, i + size))
  }

  return out
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
    } = await req.json()

    const doc =
      await PDFDocument.create()

    // ==================================================
    // FONTS
    // ==================================================

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

    // ==================================================
    // PAGE CONFIG
    // ==================================================

    const PAGE_W = 595
    const PAGE_H = 420

    const M = 28

    const TABLE_ROW_H = 28

    const TABLE_TOP = 220

    const MAX_ROWS = 6

    const pages = chunk(
      items,
      MAX_ROWS
    )

    if (pages.length === 0) {
      pages.push([])
    }

    // ==================================================
    // RENDER EACH PAGE
    // ==================================================

    for (const pageItems of pages) {
      const page =
        doc.addPage([
          PAGE_W,
          PAGE_H,
        ])

      // ================================================
      // OUTER FRAME
      // ================================================

      page.drawRectangle({
        x: M,
        y: M,
        width: PAGE_W - M * 2,
        height: PAGE_H - M * 2,
        borderWidth: 1.2,
        borderColor: BLACK,
      })

      // ================================================
      // LEFT ACCENT BAR
      // ================================================

      page.drawRectangle({
        x: M,
        y: M,
        width: 5,
        height: PAGE_H - M * 2,
        color: BLACK,
      })

      // ================================================
      // HEADER
      // ================================================

      const headerY =
        PAGE_H - M - 40

      // LOGO
      if (firmData.logo_url) {
        const img =
          await fetchImage(
            firmData.logo_url
          )

        if (img) {
          try {
            const embedded =
              img.contentType.includes(
                'png'
              )
                ? await doc.embedPng(
                    img.bytes
                  )
                : await doc.embedJpg(
                    img.bytes
                  )

            const h = 38

            const w =
              (embedded.width /
                embedded.height) *
              h

            page.drawImage(embedded, {
              x: M + 16,
              y: headerY - 2,
              width: w,
              height: h,
            })
          } catch {}
        }
      }

      // COMPANY
      drawText(
        page,
        (
          firmData.name ||
          'BOMBAY HOSIERY'
        ).toUpperCase(),
        M + 80,
        headerY + 12,
        {
          size: TYPE.lg,
          font: bold,
        }
      )

      drawText(
        page,
        firmData.address ||
          'Premium Uniform Supplier',
        M + 80,
        headerY - 2,
        {
          size: TYPE.xs,
          font: regular,
          color: DARK,
        }
      )

      drawText(
        page,
        `GSTIN: ${
          firmData.gstin ||
          'XXXXXXXXXXXX'
        }`,
        M + 80,
        headerY - 14,
        {
          size: TYPE.xs,
          font: mono,
          color: DARK,
        }
      )

      // ================================================
      // INVOICE META
      // ================================================

      drawRightText(
        page,
        'TAX INVOICE',
        PAGE_W - M - 20,
        headerY + 12,
        {
          size: TYPE.xl,
          font: bold,
        }
      )

      drawRightText(
        page,
        `# ${
          memo?.id || 'DRAFT'
        }`,
        PAGE_W - M - 20,
        headerY - 2,
        {
          size: TYPE.sm,
          font: mono,
        }
      )

      drawRightText(
        page,
        parseDate(
          memo?.created_at
        ),
        PAGE_W - M - 20,
        headerY - 16,
        {
          size: TYPE.sm,
          font: mono,
        }
      )

      // ================================================
      // SEPARATOR
      // ================================================

      drawLine(
        page,
        M + 16,
        PAGE_H - 105,
        PAGE_W - M - 16,
        PAGE_H - 105,
        0.8,
        MID
      )

      // ================================================
      // CUSTOMER
      // ================================================

      drawText(
        page,
        'BILL TO',
        M + 16,
        PAGE_H - 128,
        {
          size: TYPE.xs,
          font: bold,
          color: DARK,
        }
      )

      drawText(
        page,
        (
          customer.name ||
          'Walk-in Customer'
        ).toUpperCase(),
        M + 16,
        PAGE_H - 146,
        {
          size: TYPE.md,
          font: bold,
        }
      )

      if (customer.phone) {
        drawText(
          page,
          customer.phone,
          M + 16,
          PAGE_H - 160,
          {
            size: TYPE.sm,
            font: regular,
            color: DARK,
          }
        )
      }

      // ================================================
      // TABLE HEADER
      // ================================================

      const tableY = TABLE_TOP

      drawLine(
        page,
        M + 16,
        tableY + 22,
        PAGE_W - M - 16,
        tableY + 22,
        1.2,
        BLACK
      )

      drawText(
        page,
        'QTY',
        M + 16,
        tableY + 8,
        {
          size: TYPE.sm,
          font: bold,
        }
      )

      drawText(
        page,
        'DESCRIPTION',
        M + 70,
        tableY + 8,
        {
          size: TYPE.sm,
          font: bold,
        }
      )

      drawText(
        page,
        'HSN',
        PAGE_W - 220,
        tableY + 8,
        {
          size: TYPE.sm,
          font: bold,
        }
      )

      drawText(
        page,
        'RATE',
        PAGE_W - 150,
        tableY + 8,
        {
          size: TYPE.sm,
          font: bold,
        }
      )

      drawRightText(
        page,
        'AMOUNT',
        PAGE_W - M - 16,
        tableY + 8,
        {
          size: TYPE.sm,
          font: bold,
        }
      )

      // ================================================
      // ROWS
      // ================================================

      let y = tableY - 8

      pageItems.forEach(
        (item, index) => {
          y -= TABLE_ROW_H

          // zebra stripe
          if (index % 2 === 0) {
            page.drawRectangle({
              x: M + 10,
              y: y - 4,
              width:
                PAGE_W -
                (M + 10) * 2,
              height:
                TABLE_ROW_H - 2,
              color: LIGHT,
            })
          }

          drawText(
            page,
            item.quantity || 0,
            M + 16,
            y + 6,
            {
              font: regular,
            }
          )

          const desc =
            (
              item.name || '-'
            ).toUpperCase()

          const descLines =
            wrapText(
              desc,
              regular,
              TYPE.sm,
              240
            )

          drawText(
            page,
            descLines[0] || '',
            M + 70,
            y + 6,
            {
              font: regular,
            }
          )

          if (descLines[1]) {
            drawText(
              page,
              descLines[1],
              M + 70,
              y - 4,
              {
                size: TYPE.xs,
                font: regular,
                color: DARK,
              }
            )
          }

          drawText(
            page,
            item.hsn_code ||
              '6101',
            PAGE_W - 220,
            y + 6,
            {
              font: mono,
            }
          )

          drawText(
            page,
            inr(
              item.unit_price ||
                0
            ),
            PAGE_W - 150,
            y + 6,
            {
              font: mono,
            }
          )

          drawRightText(
            page,
            inr(
              (item.quantity ||
                0) *
                (item.unit_price ||
                  0)
            ),
            PAGE_W - M - 16,
            y + 6,
            {
              font: mono,
            }
          )

          drawLine(
            page,
            M + 16,
            y - 8,
            PAGE_W - M - 16,
            y - 8,
            0.35,
            MID
          )
        }
      )

      // ================================================
      // TOTAL SECTION
      // ================================================

      const totalsY = 82

      drawLine(
        page,
        PAGE_W - 220,
        totalsY + 58,
        PAGE_W - M - 16,
        totalsY + 58,
        1,
        BLACK
      )

      drawText(
        page,
        'SUBTOTAL',
        PAGE_W - 220,
        totalsY + 42,
        {
          font: regular,
          size: TYPE.sm,
        }
      )

      drawRightText(
        page,
        inr(subtotal),
        PAGE_W - M - 16,
        totalsY + 42,
        {
          font: mono,
          size: TYPE.sm,
        }
      )

      drawText(
        page,
        'GST',
        PAGE_W - 220,
        totalsY + 24,
        {
          font: regular,
          size: TYPE.sm,
        }
      )

      drawRightText(
        page,
        inr(gstAmt),
        PAGE_W - M - 16,
        totalsY + 24,
        {
          font: mono,
          size: TYPE.sm,
        }
      )

      // GRAND TOTAL BOX

      page.drawRectangle({
        x: PAGE_W - 240,
        y: totalsY - 12,
        width: 200,
        height: 42,
        borderWidth: 1.4,
        borderColor: BLACK,
      })

      drawText(
        page,
        'GRAND TOTAL',
        PAGE_W - 220,
        totalsY + 4,
        {
          font: bold,
          size: TYPE.sm,
        }
      )

      drawRightText(
        page,
        inr(total),
        PAGE_W - 56,
        totalsY + 2,
        {
          font: mono,
          size: TYPE.lg,
        }
      )

      // ================================================
      // BANK DETAILS
      // ================================================

      drawText(
        page,
        'BANK DETAILS',
        M + 16,
        92,
        {
          font: bold,
          size: TYPE.xs,
        }
      )

      drawText(
        page,
        'A/C: 050020110000230',
        M + 16,
        76,
        {
          font: mono,
          size: TYPE.xs,
        }
      )

      drawText(
        page,
        'IFSC: BKID0000500',
        M + 170,
        76,
        {
          font: mono,
          size: TYPE.xs,
        }
      )

      // ================================================
      // FOOTER
      // ================================================

      drawLine(
        page,
        M + 16,
        58,
        PAGE_W - M - 16,
        58,
        0.8,
        MID
      )

      drawText(
        page,
        'THANK YOU FOR YOUR BUSINESS',
        M + 16,
        42,
        {
          font: bold,
          size: TYPE.xs,
          color: DARK,
        }
      )

      drawRightText(
        page,
        'Generated digitally',
        PAGE_W - M - 16,
        42,
        {
          font: regular,
          size: TYPE.xs,
          color: DARK,
        }
      )
    }

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
