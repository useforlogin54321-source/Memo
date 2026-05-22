import {
  PDFDocument,
  rgb,
  StandardFonts,
} from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const BLACK = rgb(0, 0, 0)
const GRAY = rgb(0.45, 0.45, 0.45)

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

    const contentType =
      res.headers.get(
        'content-type'
      ) || ''

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
  thickness = 1
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: BLACK,
    borderWidth: thickness,
  })
}

function drawText(
  page,
  text,
  x,
  y,
  font,
  size = 9,
  color = BLACK
) {
  page.drawText(
    String(text || ''),
    {
      x,
      y,
      size,
      font,
      color,
    }
  )
}

function fitText(
  text,
  font,
  size,
  maxWidth
) {
  let safe = String(text || '')

  while (
    font.widthOfTextAtSize(
      safe,
      size
    ) > maxWidth
  ) {
    safe = safe.slice(0, -1)
  }

  return safe
}

function drawSafeText(
  page,
  text,
  x,
  y,
  width,
  font,
  size = 9
) {
  const safe = fitText(
    text,
    font,
    size,
    width
  )

  page.drawText(safe, {
    x,
    y,
    size,
    font,
    color: BLACK,
  })
}

function drawRightText(
  page,
  text,
  rightX,
  y,
  font,
  size = 9,
  maxWidth = 120
) {
  let safe =
    String(text || '')

  while (
    font.widthOfTextAtSize(
      safe,
      size
    ) > maxWidth
  ) {
    safe = safe.slice(0, -1)
  }

  const width =
    font.widthOfTextAtSize(
      safe,
      size
    )

  page.drawText(safe, {
    x: rightX - width,
    y,
    size,
    font,
    color: BLACK,
  })
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
      qrCodeUrl,
    } = await req.json()

    const doc =
      await PDFDocument.create()

    const page = doc.addPage([
      595,
      420,
    ])

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

    box(
      page,
      M,
      M,
      width - M * 2,
      height - M * 2,
      1.5
    )

    const headerH = 100
    const headerY =
      height - M - headerH

    box(
      page,
      M,
      headerY,
      width - M * 2,
      headerH,
      1
    )

    const midX = width / 2

    line(
      page,
      midX,
      headerY,
      midX,
      headerY + headerH,
      1
    )

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

          page.drawImage(img, {
            x: M + 2,
            y: headerY + 2,
            width:
              midX - M - 4,
            height:
              headerH - 4,
          })
        } catch {}
      }
    }

    drawText(
      page,
      'Customer Name',
      midX + 20,
      headerY + 45,
      bold,
      10
    )

    drawText(
      page,
      ':',
      midX + 145,
      headerY + 45,
      bold,
      10
    )

    drawSafeText(
      page,
      customer.name ||
        'Walk-in Customer',
      midX + 160,
      headerY + 45,
      110,
      regular,
      10
    )

    drawText(
      page,
      'Mobile No',
      midX + 20,
      headerY + 18,
      bold,
      10
    )

    drawText(
      page,
      ':',
      midX + 145,
      headerY + 18,
      bold,
      10
    )

    drawSafeText(
      page,
      customer.phone || '-',
      midX + 160,
      headerY + 18,
      110,
      regular,
      10
    )

    const titleH = 40
    const titleY =
      headerY - titleH

    box(
      page,
      M,
      titleY,
      width - M * 2,
      titleH,
      1
    )

    drawText(
      page,
      'TAX INVOICE',
      width / 2 - 72,
      titleY + 10,
      bold,
      24
    )

    const metaH = 32
    const metaY = titleY - metaH

    box(
      page,
      M,
      metaY,
      width - M * 2,
      metaH,
      1
    )

    drawText(
      page,
      'Invoice No',
      M + 20,
      metaY + 10,
      bold,
      10
    )

    drawText(
      page,
      ':',
      M + 110,
      metaY + 10,
      bold,
      10
    )

    drawSafeText(
      page,
      memo?.invoice_number || memo?.id || 'DRAFT',
      M + 125,
      metaY + 10,
      180,
      mono,
      10
    )

    drawText(
      page,
      'Date',
      width - 170,
      metaY + 10,
      bold,
      10
    )

    drawText(
      page,
      ':',
      width - 115,
      metaY + 10,
      bold,
      10
    )

    drawSafeText(
      page,
      parseDate(
        memo?.created_at
      ),
      width - 100,
      metaY + 10,
      75,
      mono,
      10
    )

    const tableY = 130
    const tableH =
      metaY - tableY

    box(
      page,
      M,
      tableY,
      width - M * 2,
      tableH,
      1
    )

    const th = 30

    line(
      page,
      M,
      metaY - th,
      width - M,
      metaY - th,
      1
    )

    const c1 = M + 55
    const c2 = M + 340
    const c3 = M + 420
    const c4 = M + 495

    ;[c1, c2, c3, c4].forEach(
      (x) => {
        line(
          page,
          x,
          tableY,
          x,
          metaY,
          1
        )
      }
    )

    drawText(
      page,
      'QTY',
      M + 15,
      metaY - 20,
      bold,
      10
    )

    drawText(
      page,
      'DESCRIPTION',
      c1 + 10,
      metaY - 20,
      bold,
      10
    )

    drawText(
      page,
      'HSN',
      c2 + 10,
      metaY - 20,
      bold,
      10
    )

    drawText(
      page,
      'RATE',
      c3 + 10,
      metaY - 20,
      bold,
      10
    )

    drawText(
      page,
      'AMOUNT',
      c4 + 10,
      metaY - 20,
      bold,
      10
    )

    let y = metaY - 55

    items
      .slice(0, 7)
      .forEach((item) => {
        drawText(
          page,
          item.quantity || 0,
          M + 18,
          y,
          regular,
          10
        )

        let desc = (
          item.name || '-'
        ).toUpperCase()

        if (item.size) {
          desc += ` (${item.size})`
        }

        if (item.narration) {
          desc += ` - ${item.narration}`
        }

        desc = desc.slice(0, 34)

        drawSafeText(
          page,
          desc,
          c1 + 10,
          y,
          250,
          regular,
          10
        )

        drawSafeText(
          page,
          item.hsn_code ||
            '6101',
          c2 + 10,
          y,
          55,
          mono,
          9
        )

        drawRightText(
          page,
          inr(
            item.unit_price || 0
          ),
          c4 - 12,
          y,
          mono,
          9,
          65
        )

        drawRightText(
          page,
          inr(
            (item.quantity ||
              0) *
              (item.unit_price ||
                0)
          ),
          width - 18,
          y,
          mono,
          9,
          78
        )

        y -= 28
      })

    const footerH = 120
    const footerY = 10

    box(
      page,
      M,
      footerY,
      width - M * 2,
      footerH,
      1
    )

    const f1 = M + 140
    const f2 = M + 290
    const f3 = M + 410

    ;[f1, f2, f3].forEach(
      (x) => {
        line(
          page,
          x,
          footerY,
          x,
          footerY +
            footerH,
          1
        )
      }
    )

    drawText(
      page,
      'PAYMENT QR',
      M + 28,
      footerY + 95,
      bold,
      10
    )

    if (qrCodeUrl) {
      const qr =
        await fetchImage(
          qrCodeUrl
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
            x: M + 20,
            y: footerY + 18,
            width: 90,
            height: 90,
          })
        } catch (err) {
          console.error(
            'QR ERROR',
            err
          )
        }
      }
    }

    drawText(
      page,
      'GST BREAKDOWN',
      f1 + 18,
      footerY + 95,
      bold,
      10
    )

    drawText(
      page,
      'CGST (2.5%)',
      f1 + 18,
      footerY + 70,
      regular,
      9
    )

    drawRightText(
      page,
      inr(gstAmt / 2),
      f2 - 15,
      footerY + 70,
      mono,
      9,
      75
    )

    drawText(
      page,
      'SGST (2.5%)',
      f1 + 18,
      footerY + 45,
      regular,
      9
    )

    drawRightText(
      page,
      inr(gstAmt / 2),
      f2 - 15,
      footerY + 45,
      mono,
      9,
      75
    )

    drawText(
      page,
      'IGST',
      f1 + 18,
      footerY + 20,
      regular,
      9
    )

    drawRightText(
      page,
      'Rs. 0.00',
      f2 - 15,
      footerY + 20,
      mono,
      9,
      75
    )

    drawText(
      page,
      'PAYMENT STATUS',
      f2 + 18,
      footerY + 95,
      bold,
      10
    )

    const paymentStatus = memo?.payment_status || 'pending'
    const statusText = paymentStatus === 'paid' ? 'PAID' : 
                      paymentStatus === 'partial' ? 'PARTIAL' : 
                      paymentStatus === 'unpaid' ? 'UNPAID' : 'PENDING'

    drawSafeText(
      page,
      statusText,
      f2 + 18,
      footerY + 65,
      90,
      regular,
      9
    )

    if (memo?.paid_amount > 0) {
      drawSafeText(
        page,
        `Paid: ${inr(memo.paid_amount)}`,
        f2 + 18,
        footerY + 40,
        90,
        regular,
        8
      )
    }

    if (memo?.payment_method) {
      drawSafeText(
        page,
        `Via: ${memo.payment_method}`,
        f2 + 18,
        footerY + 15,
        90,
        regular,
        8
      )
    }

    const totalX = f3

    line(
      page,
      totalX,
      footerY + 80,
      width - M,
      footerY + 80,
      1
    )

    line(
      page,
      totalX,
      footerY + 40,
      width - M,
      footerY + 40,
      1
    )

    const splitX =
      totalX + 95

    line(
      page,
      splitX,
      footerY,
      splitX,
      footerY + footerH,
      1
    )

    drawSafeText(
      page,
      'SUB TOTAL',
      totalX + 10,
      footerY + 90,
      80,
      bold,
      10
    )

    drawRightText(
      page,
      inr(subtotal),
      width - 18,
      footerY + 90,
      mono,
      10,
      70
    )

    drawSafeText(
      page,
      'GST TOTAL',
      totalX + 10,
      footerY + 50,
      80,
      bold,
      10
    )

    drawRightText(
      page,
      inr(gstAmt),
      width - 18,
      footerY + 50,
      mono,
      10,
      70
    )

    drawSafeText(
      page,
      'GRAND TOTAL',
      totalX + 10,
      footerY + 12,
      80,
      bold,
      11
    )

    drawRightText(
      page,
      inr(total),
      width - 18,
      footerY + 12,
      mono,
      11,
      82
    )

    if (firmData.footer_note) {
      const note =
        fitText(
          firmData.footer_note,
          regular,
          7,
          260
        )

      drawText(
        page,
        note,
        width / 2 - 100,
        4,
        regular,
        7,
        GRAY
      )
    }

    const pdfBytes =
      await doc.save({
        useObjectStreams: true,
      })

    return new Response(
      pdfBytes,
      {
        status: 200,
        headers: {
          'Content-Type':
            'application/pdf',
          'Content-Disposition':
            'inline; filename=invoice.pdf',
        },
      }
    )
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
