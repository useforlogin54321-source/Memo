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
const GRAY = rgb(0.38, 0.38, 0.38)
const LIGHT = rgb(0.97, 0.97, 0.97)
const LIGHTER = rgb(0.985, 0.985, 0.985)

// ======================================================
// PAGE
// ======================================================

const PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 24,
}

// ======================================================
// TYPOGRAPHY
// ======================================================

const FONT = {
  xs: 7,
  sm: 8.5,
  md: 10,
  lg: 12,
  xl: 18,
  hero: 24,
}

// ======================================================
// TABLE
// ======================================================

const TABLE = {
  qty: 55,
  desc: 250,
  hsn: 70,
  rate: 90,
  amount: 106,
}

const ROW_MIN_HEIGHT = 42

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

function numberToWords(num) {
  if (!num)
    return 'ZERO RUPEES ONLY'

  const a = [
    '',
    'ONE',
    'TWO',
    'THREE',
    'FOUR',
    'FIVE',
    'SIX',
    'SEVEN',
    'EIGHT',
    'NINE',
    'TEN',
    'ELEVEN',
    'TWELVE',
    'THIRTEEN',
    'FOURTEEN',
    'FIFTEEN',
    'SIXTEEN',
    'SEVENTEEN',
    'EIGHTEEN',
    'NINETEEN',
  ]

  const b = [
    '',
    '',
    'TWENTY',
    'THIRTY',
    'FORTY',
    'FIFTY',
    'SIXTY',
    'SEVENTY',
    'EIGHTY',
    'NINETY',
  ]

  function convert(n) {
    if (n < 20) return a[n]

    if (n < 100) {
      return (
        b[Math.floor(n / 10)] +
        (n % 10
          ? ' ' + a[n % 10]
          : '')
      )
    }

    if (n < 1000) {
      return (
        a[Math.floor(n / 100)] +
        ' HUNDRED ' +
        convert(n % 100)
      )
    }

    if (n < 100000) {
      return (
        convert(
          Math.floor(n / 1000)
        ) +
        ' THOUSAND ' +
        convert(n % 1000)
      )
    }

    if (n < 10000000) {
      return (
        convert(
          Math.floor(n / 100000)
        ) +
        ' LAKH ' +
        convert(n % 100000)
      )
    }

    return (
      convert(
        Math.floor(n / 10000000)
      ) +
      ' CRORE ' +
      convert(n % 10000000)
    )
  }

  return `${convert(
    Math.floor(num)
  )} RUPEES ONLY`
}

async function fetchImage(url) {
  if (!url) return null

  try {
    const res = await fetch(url)

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
    borderColor: BLACK,
    borderWidth,
    color: fill || undefined,
  })
}

function line(
  page,
  x1,
  y1,
  x2,
  y2,
  thickness = 0.5
) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: BLACK,
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

function wrapText(
  value,
  font,
  size,
  maxWidth
) {
  const words = String(
    value || ''
  ).split(' ')

  const lines = []

  let current = ''

  for (const word of words) {
    const test =
      current + word + ' '

    const width =
      font.widthOfTextAtSize(
        test,
        size
      )

    if (
      width > maxWidth &&
      current
    ) {
      lines.push(
        current.trim()
      )

      current = word + ' '
    } else {
      current = test
    }
  }

  if (current) {
    lines.push(current.trim())
  }

  return lines
}

function drawWrappedText(
  page,
  value,
  x,
  y,
  width,
  font,
  size = 9,
  lineGap = 12,
  maxLines = 10,
  color = BLACK
) {
  const lines = wrapText(
    value,
    font,
    size,
    width
  ).slice(0, maxLines)

  lines.forEach((lineText, i) => {
    text(
      page,
      lineText,
      x,
      y - i * lineGap,
      font,
      size,
      color
    )
  })

  return lines.length
}

function drawRight(
  page,
  value,
  x,
  y,
  width,
  font,
  size = 9,
  padding = 12
) {
  const tw =
    font.widthOfTextAtSize(
      String(value),
      size
    )

  text(
    page,
    value,
    x +
      width -
      tw -
      padding,
    y,
    font,
    size
  )
}

function getRowHeight(
  item,
  font
) {
  let desc = (
    item.name || '-'
  ).toUpperCase()

  if (item.size) {
    desc += ` (${item.size})`
  }

  const lines = wrapText(
    desc,
    font,
    8,
    TABLE.desc - 24
  )

  return Math.max(
    ROW_MIN_HEIGHT,
    lines.length * 14 + 18
  )
}

// ======================================================
// PAGE HELPERS
// ======================================================

function createPage(doc) {
  return doc.addPage([
    PAGE.width,
    PAGE.height,
  ])
}

function drawMasterBorder(
  page
) {
  box(
    page,
    PAGE.margin,
    PAGE.margin,
    PAGE.width -
      PAGE.margin * 2,
    PAGE.height -
      PAGE.margin * 2,
    1.2
  )
}

// ======================================================
// TABLE HEADER
// ======================================================

function drawTableHeader(
  page,
  topY,
  bold
) {
  const M = PAGE.margin

  const cols = {
    qty: M,
    desc: M + TABLE.qty,
    hsn:
      M +
      TABLE.qty +
      TABLE.desc,
    rate:
      M +
      TABLE.qty +
      TABLE.desc +
      TABLE.hsn,
    amount:
      M +
      TABLE.qty +
      TABLE.desc +
      TABLE.hsn +
      TABLE.rate,
  }

  box(
    page,
    M,
    topY - 30,
    PAGE.width - M * 2,
    30,
    0.8,
    LIGHT
  )

  ;[
    cols.desc,
    cols.hsn,
    cols.rate,
    cols.amount,
  ].forEach((x) => {
    line(
      page,
      x,
      PAGE.margin + 185,
      x,
      topY,
      0.45
    )
  })

  text(
    page,
    'QTY',
    cols.qty + 12,
    topY - 19,
    bold,
    8.5
  )

  text(
    page,
    'DESCRIPTION',
    cols.desc + 12,
    topY - 19,
    bold,
    8.5
  )

  text(
    page,
    'HSN',
    cols.hsn + 12,
    topY - 19,
    bold,
    8.5
  )

  text(
    page,
    'RATE',
    cols.rate + 12,
    topY - 19,
    bold,
    8.5
  )

  text(
    page,
    'AMOUNT',
    cols.amount + 12,
    topY - 19,
    bold,
    8.5
  )

  return cols
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

    const doc =
      await PDFDocument.create()

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

    let page =
      createPage(doc)

    drawMasterBorder(page)

    const M = PAGE.margin

    // ======================================================
    // HEADER
    // ======================================================

    const headerH = 125

    const headerY =
      PAGE.height -
      M -
      headerH

    box(
      page,
      M,
      headerY,
      PAGE.width - M * 2,
      headerH,
      1
    )

    const leftW = 220

    line(
      page,
      M + leftW,
      headerY,
      M + leftW,
      headerY + headerH
    )

    // ======================================================
    // LOGO
    // ======================================================

    if (firmData.logo_url) {
      try {
        const logo =
          await fetchImage(
            firmData.logo_url
          )

        if (logo?.bytes) {
          let img = null

          if (
            logo.type.includes(
              'png'
            )
          ) {
            img =
              await doc.embedPng(
                logo.bytes
              )
          } else {
            img =
              await doc.embedJpg(
                logo.bytes
              )
          }

          if (img) {
            const ratio =
              img.width /
              img.height

            let drawW = 150

            let drawH =
              drawW / ratio

            if (drawH > 82) {
              drawH = 82
              drawW =
                drawH * ratio
            }

            page.drawImage(img, {
              x:
                M +
                (leftW -
                  drawW) /
                  2,
              y:
                headerY + 20,
              width: drawW,
              height: drawH,
            })
          }
        }
      } catch {}
    }

    // ======================================================
    // COMPANY INFO
    // ======================================================

    const cx = M + leftW + 18

    text(
      page,
      (
        firmData.name ||
        'YOUR COMPANY'
      )
        .toUpperCase()
        .split('')
        .join(' '),
      cx,
      headerY + 92,
      bold,
      20
    )

    drawWrappedText(
      page,
      firmData.address ||
        'Company Address',
      cx,
      headerY + 66,
      300,
      regular,
      9,
      14,
      3,
      GRAY
    )

    text(
      page,
      `GSTIN : ${
        firmData.gstin || '-'
      }`,
      cx,
      headerY + 24,
      regular,
      9
    )

    text(
      page,
      `PHONE : ${
        firmData.phone || '-'
      }`,
      cx + 170,
      headerY + 24,
      regular,
      9
    )

    // ======================================================
    // TITLE
    // ======================================================

    const titleY =
      headerY - 48

    box(
      page,
      M,
      titleY,
      PAGE.width - M * 2,
      38,
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
      (PAGE.width - tw) / 2,
      titleY + 8,
      bold,
      FONT.hero,
      WHITE
    )

    // ======================================================
    // CUSTOMER
    // ======================================================

    const customerY =
      titleY - 78

    box(
      page,
      M,
      customerY,
      PAGE.width - M * 2,
      66,
      1
    )

    line(
      page,
      PAGE.width / 2,
      customerY,
      PAGE.width / 2,
      customerY + 66
    )

    text(
      page,
      'BILL TO',
      M + 12,
      customerY + 45,
      bold,
      10
    )

    drawWrappedText(
      page,
      customer.name ||
        'Walk-in Customer',
      M + 12,
      customerY + 26,
      240,
      bold,
      11,
      14
    )

    text(
      page,
      customer.phone || '-',
      M + 12,
      customerY + 8,
      regular,
      9
    )

    text(
      page,
      `INVOICE NO : ${
        memo?.id || 'DRAFT'
      }`,
      PAGE.width / 2 + 18,
      customerY + 38,
      mono,
      9
    )

    text(
      page,
      `DATE : ${parseDate(
        memo?.created_at
      )}`,
      PAGE.width / 2 + 18,
      customerY + 16,
      mono,
      9
    )

    // ======================================================
    // TABLE
    // ======================================================

    let tableTop =
      customerY - 12

    let cols =
      drawTableHeader(
        page,
        tableTop,
        bold
      )

    let cursorY =
      tableTop - 50

    const footerReserve = 215

    let runningTotal = 0

    for (
      let i = 0;
      i < items.length;
      i++
    ) {
      const item = items[i]

      const rowHeight =
        getRowHeight(
          item,
          regular
        )

      if (
        cursorY - rowHeight <
        footerReserve
      ) {
        text(
          page,
          `Carry Forward : ${inr(
            runningTotal
          )}`,
          PAGE.width - 220,
          60,
          bold,
          9
        )

        page =
          createPage(doc)

        drawMasterBorder(page)

        text(
          page,
          `Brought Forward : ${inr(
            runningTotal
          )}`,
          PAGE.width - 240,
          PAGE.height - 40,
          bold,
          9
        )

        cols =
          drawTableHeader(
            page,
            PAGE.height - 70,
            bold
          )

        cursorY =
          PAGE.height - 120
      }

      if (i % 2 === 0) {
        box(
          page,
          M,
          cursorY -
            rowHeight +
            12,
          PAGE.width -
            M * 2,
          rowHeight,
          0,
          LIGHTER
        )
      }

      line(
        page,
        M,
        cursorY -
          rowHeight +
          12,
        PAGE.width - M,
        cursorY -
          rowHeight +
          12,
        0.35
      )

      text(
        page,
        String(
          item.quantity || 0
        ),
        cols.qty + 12,
        cursorY,
        regular,
        9
      )

      let desc = (
        item.name || '-'
      ).toUpperCase()

      if (item.size) {
        desc += ` (${item.size})`
      }

      drawWrappedText(
        page,
        desc,
        cols.desc + 12,
        cursorY,
        TABLE.desc - 24,
        regular,
        8.5,
        12,
        5
      )

      text(
        page,
        item.hsn_code ||
          '6101',
        cols.hsn + 12,
        cursorY,
        mono,
        8,
        GRAY
      )

      drawRight(
        page,
        inr(
          item.unit_price || 0
        ),
        cols.rate,
        cursorY,
        TABLE.rate,
        mono,
        8.5
      )

      const amount =
        (item.quantity || 0) *
        (item.unit_price || 0)

      runningTotal += amount

      drawRight(
        page,
        inr(amount),
        cols.amount,
        cursorY,
        TABLE.amount,
        mono,
        8.5
      )

      cursorY -= rowHeight
    }

    // ======================================================
    // AMOUNT IN WORDS
    // ======================================================

    box(
      page,
      M,
      192,
      PAGE.width - M * 2,
      34,
      1
    )

    text(
      page,
      'AMOUNT IN WORDS',
      M + 12,
      209,
      bold,
      8.5
    )

    drawWrappedText(
      page,
      numberToWords(total),
      M + 12,
      196,
      520,
      regular,
      8.5,
      12
    )

    // ======================================================
    // FOOTER
    // ======================================================

    box(
      page,
      M,
      M,
      PAGE.width - M * 2,
      165,
      1
    )

    // QR narrower now
    const fx1 = M + 135

    const fx2 =
      PAGE.width - 215

    line(
      page,
      fx1,
      M,
      fx1,
      M + 165
    )

    line(
      page,
      fx2,
      M,
      fx2,
      M + 165
    )

    // ======================================================
    // QR
    // ======================================================

    text(
      page,
      'SCAN & PAY',
      M + 24,
      172,
      bold,
      9
    )

    if (qrCodeUrl) {
      try {
        const qr =
          await fetchImage(
            qrCodeUrl
          )

        if (qr?.bytes) {
          let img = null

          if (
            qr.type.includes(
              'png'
            )
          ) {
            img =
              await doc.embedPng(
                qr.bytes
              )
          } else {
            img =
              await doc.embedJpg(
                qr.bytes
              )
          }

          if (img) {
            page.drawImage(img, {
              x: M + 28,
              y: 62,
              width: 72,
              height: 72,
            })
          }
        }
      } catch {}
    }

    // ======================================================
    // BANK
    // ======================================================

    text(
      page,
      'BANK DETAILS',
      fx1 + 14,
      172,
      bold,
      9
    )

    const terms = [
      `BANK : ${
        firmData.bank_name ||
        '-'
      }`,
      `A/C : ${
        firmData.bank_account ||
        '-'
      }`,
      `IFSC : ${
        firmData.ifsc || '-'
      }`,
      '',
      'Goods once sold will not',
      'be taken back.',
    ]

    let ty = 152

    terms.forEach((t) => {
      text(
        page,
        t,
        fx1 + 14,
        ty,
        regular,
        8.5
      )

      ty -= 17
    })

    // ======================================================
    // TOTALS
    // ======================================================

    box(
      page,
      fx2,
      M,
      PAGE.width -
        M -
        fx2,
      165,
      1
    )

    text(
      page,
      'Subtotal',
      fx2 + 14,
      152,
      regular,
      9
    )

    drawRight(
      page,
      inr(subtotal),
      fx2,
      152,
      PAGE.width -
        M -
        fx2,
      mono,
      9
    )

    text(
      page,
      'GST',
      fx2 + 14,
      124,
      regular,
      9
    )

    drawRight(
      page,
      inr(gstAmt),
      fx2,
      124,
      PAGE.width -
        M -
        fx2,
      mono,
      9
    )

    // ======================================================
    // GRAND TOTAL
    // ======================================================

    box(
      page,
      fx2 + 10,
      48,
      PAGE.width -
        M -
        fx2 -
        20,
      48,
      1,
      BLACK
    )

    text(
      page,
      'GRAND TOTAL',
      fx2 + 20,
      76,
      bold,
      13,
      WHITE
    )

    drawRight(
      page,
      inr(total),
      fx2 + 10,
      58,
      PAGE.width -
        M -
        fx2 -
        20,
      mono,
      13
    )

    // ======================================================
    // SIGNATURE
    // ======================================================

    text(
      page,
      'Authorized Signatory',
      PAGE.width - 175,
      18,
      regular,
      8,
      GRAY
    )

    // ======================================================
    // FOOTER NOTE
    // ======================================================

    if (firmData.footer_note) {
      const note =
        firmData.footer_note

      const nw =
        regular.widthOfTextAtSize(
          note,
          7
        )

      text(
        page,
        note,
        (PAGE.width - nw) / 2,
        5,
        regular,
        7,
        GRAY
      )
    }

    // ======================================================
    // SAVE
    // ======================================================

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
