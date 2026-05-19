import {
  PDFDocument,
  rgb,
  StandardFonts,
  PageSizes,
} from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89

const MARGIN = 30
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const COLORS = {
  border: rgb(0, 0, 0),
  gray: rgb(0.92, 0.92, 0.92),
  muted: rgb(0.4, 0.4, 0.4),
  text: rgb(0, 0, 0),
}

const ROW_HEIGHT = 18
const FOOTER_HEIGHT = 150

const inr = (n = 0) =>
  `Rs. ${Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function parseDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
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

    const bytes = await res.arrayBuffer()

    return {
      bytes,
      contentType: res.headers.get('content-type') || '',
    }
  } catch {
    return null
  }
}

function drawBox(page, x, y, width, height, opts = {}) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderWidth: opts.borderWidth ?? 0.75,
    borderColor: opts.borderColor || COLORS.border,
    color: opts.fillColor,
  })
}

function drawText(page, text, x, y, opts = {}) {
  page.drawText(String(text || ''), {
    x,
    y,
    size: opts.size || 9,
    font: opts.font,
    color: opts.color || COLORS.text,
  })
}

function drawLine(page, x1, y1, x2, y2, thickness = 0.75) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: COLORS.border,
  })
}

function truncateText(font, text, size, maxWidth) {
  if (!text) return ''

  let result = text

  while (
    result.length > 0 &&
    font.widthOfTextAtSize(result, size) > maxWidth
  ) {
    result = result.slice(0, -1)
  }

  return result !== text ? `${result}…` : result
}

function drawCell(
  page,
  text,
  x,
  y,
  width,
  height,
  font,
  size = 9,
  opts = {}
) {
  drawBox(page, x, y, width, height, opts)

  const safeText = String(text || '')
  const textWidth = font.widthOfTextAtSize(safeText, size)

  let textX = x + 4

  if (opts.align === 'right') {
    textX = x + width - textWidth - 4
  } else if (opts.align === 'center') {
    textX = x + (width - textWidth) / 2
  }

  const textY = y + (height - size) / 2 + 2

  drawText(page, safeText, textX, textY, {
    font,
    size,
    color: opts.color,
  })
}

function numberToWords(num) {
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]

  const b = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  function convert(n) {
    if (n < 20) return a[n]

    if (n < 100)
      return (
        b[Math.floor(n / 10)] +
        (n % 10 ? ' ' + a[n % 10] : '')
      )

    if (n < 1000)
      return (
        a[Math.floor(n / 100)] +
        ' Hundred ' +
        convert(n % 100)
      )

    if (n < 100000)
      return (
        convert(Math.floor(n / 1000)) +
        ' Thousand ' +
        convert(n % 1000)
      )

    if (n < 10000000)
      return (
        convert(Math.floor(n / 100000)) +
        ' Lakh ' +
        convert(n % 100000)
      )

    return (
      convert(Math.floor(n / 10000000)) +
      ' Crore ' +
      convert(n % 10000000)
    )
  }

  return `Rupees ${convert(Math.round(num))} Only`
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

    const doc = await PDFDocument.create()

    const font = await doc.embedFont(StandardFonts.Helvetica)
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

    let page = doc.addPage(PageSizes.A4)
    let y = PAGE_HEIGHT - 40
    let currentPage = 1

    const pages = [page]

    const createNewPage = () => {
      page = doc.addPage(PageSizes.A4)
      pages.push(page)
      currentPage++
      y = PAGE_HEIGHT - 40

      drawTableHeader()
    }

    const cols = [
      { label: 'Sr', x: MARGIN, w: 30 },
      { label: 'Qty', x: MARGIN + 30, w: 40 },
      { label: 'Description', x: MARGIN + 70, w: 190 },
      { label: 'HSN', x: MARGIN + 260, w: 60 },
      { label: 'Rate', x: MARGIN + 320, w: 70 },
      { label: 'GST %', x: MARGIN + 390, w: 50 },
      { label: 'Amount', x: MARGIN + 440, w: 125 },
    ]

    async function drawHeader() {
      if (firmData.logo_url) {
        const logoData = await fetchImage(firmData.logo_url)

        if (logoData) {
          try {
            const isPng =
              logoData.contentType.includes('png')

            const img = isPng
              ? await doc.embedPng(logoData.bytes)
              : await doc.embedJpg(logoData.bytes)

            const h = 55
            const w = (img.width / img.height) * h

            page.drawImage(img, {
              x: MARGIN,
              y: y - h,
              width: w,
              height: h,
            })
          } catch {}
        }
      }

      y -= 70

      drawBox(page, MARGIN, y - 60, CONTENT_WIDTH, 60)

      drawText(
        page,
        firmData.address ||
          '289, M.G. Road, Pune 411001',
        MARGIN + 8,
        y - 15,
        {
          font,
          size: 8,
        }
      )

      drawText(
        page,
        `Phone: ${
          firmData.phone_number || '7385299464'
        }`,
        MARGIN + 8,
        y - 28,
        {
          font,
          size: 8,
        }
      )

      drawText(
        page,
        `GSTIN: ${
          firmData.gst_number ||
          '27AAAFY0749C2ZB'
        }`,
        MARGIN + 8,
        y - 41,
        {
          font,
          size: 8,
        }
      )

      drawText(
        page,
        `Email: ${
          firmData.email ||
          'info@example.com'
        }`,
        MARGIN + 8,
        y - 54,
        {
          font,
          size: 8,
        }
      )

      drawText(
        page,
        'TAX INVOICE',
        PAGE_WIDTH - 160,
        y - 20,
        {
          font: fontBold,
          size: 16,
        }
      )

      drawText(
        page,
        memoType === 'order'
          ? 'ORDER INVOICE'
          : 'CASH INVOICE',
        PAGE_WIDTH - 160,
        y - 38,
        {
          font,
          size: 9,
        }
      )

      y -= 75

      const detailHeight = 55

      drawBox(
        page,
        MARGIN,
        y - detailHeight,
        CONTENT_WIDTH,
        detailHeight
      )

      const midX = MARGIN + CONTENT_WIDTH / 2
      const thirdX = MARGIN + CONTENT_WIDTH * 0.75

      drawLine(
        page,
        midX,
        y - detailHeight,
        midX,
        y
      )

      drawLine(
        page,
        thirdX,
        y - detailHeight,
        thirdX,
        y
      )

      drawText(
        page,
        'Customer:',
        MARGIN + 8,
        y - 15,
        {
          font: fontBold,
          size: 9,
        }
      )

      drawText(
        page,
        customer.name || 'Walk-in Customer',
        MARGIN + 8,
        y - 30,
        {
          font,
          size: 10,
        }
      )

      drawText(
        page,
        `Mob: ${customer.phone || '-'}`,
        MARGIN + 8,
        y - 45,
        {
          font,
          size: 8,
          color: COLORS.muted,
        }
      )

      drawText(
        page,
        'Invoice No:',
        midX + 8,
        y - 15,
        {
          font: fontBold,
          size: 9,
        }
      )

      drawText(
        page,
        String(memo?.id || 'DRAFT'),
        midX + 8,
        y - 30,
        {
          font,
          size: 10,
        }
      )

      drawText(
        page,
        'Invoice Date:',
        thirdX + 8,
        y - 15,
        {
          font: fontBold,
          size: 9,
        }
      )

      drawText(
        page,
        parseDate(memo?.created_at),
        thirdX + 8,
        y - 30,
        {
          font,
          size: 10,
        }
      )

      drawText(
        page,
        'State Code: 27',
        thirdX + 8,
        y - 45,
        {
          font,
          size: 8,
          color: COLORS.muted,
        }
      )

      y -= 70
    }

    function drawTableHeader() {
      cols.forEach((col) => {
        drawCell(
          page,
          col.label,
          col.x,
          y - ROW_HEIGHT,
          col.w,
          ROW_HEIGHT,
          fontBold,
          8,
          {
            fillColor: COLORS.gray,
            align: 'center',
          }
        )
      })

      y -= ROW_HEIGHT
    }

    await drawHeader()
    drawTableHeader()

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (y < FOOTER_HEIGHT + 60) {
        createNewPage()
      }

      const gstPercent = Number(
        item.gst_percent || 5
      )

      const amount =
        Number(item.quantity || 0) *
        Number(item.unit_price || 0)

      const description = truncateText(
        font,
        `${item.name || '-'} ${
          item.size
            ? `(Size: ${item.size})`
            : ''
        }`,
        9,
        cols[2].w - 10
      )

      drawCell(
        page,
        i + 1,
        cols[0].x,
        y - ROW_HEIGHT,
        cols[0].w,
        ROW_HEIGHT,
        font,
        9,
        { align: 'center' }
      )

      drawCell(
        page,
        item.quantity || 0,
        cols[1].x,
        y - ROW_HEIGHT,
        cols[1].w,
        ROW_HEIGHT,
        font,
        9,
        { align: 'center' }
      )

      drawCell(
        page,
        description,
        cols[2].x,
        y - ROW_HEIGHT,
        cols[2].w,
        ROW_HEIGHT,
        font,
        9
      )

      drawCell(
        page,
        item.hsn_code || '6101',
        cols[3].x,
        y - ROW_HEIGHT,
        cols[3].w,
        ROW_HEIGHT,
        font,
        9,
        { align: 'center' }
      )

      drawCell(
        page,
        inr(item.unit_price || 0),
        cols[4].x,
        y - ROW_HEIGHT,
        cols[4].w,
        ROW_HEIGHT,
        font,
        9,
        { align: 'right' }
      )

      drawCell(
        page,
        `${gstPercent}%`,
        cols[5].x,
        y - ROW_HEIGHT,
        cols[5].w,
        ROW_HEIGHT,
        font,
        9,
        { align: 'center' }
      )

      drawCell(
        page,
        inr(amount),
        cols[6].x,
        y - ROW_HEIGHT,
        cols[6].w,
        ROW_HEIGHT,
        font,
        9,
        { align: 'right' }
      )

      y -= ROW_HEIGHT
    }

    const emptyRows = Math.max(0, 8 - items.length)

    for (let i = 0; i < emptyRows; i++) {
      cols.forEach((col) => {
        drawBox(
          page,
          col.x,
          y - ROW_HEIGHT,
          col.w,
          ROW_HEIGHT
        )
      })

      y -= ROW_HEIGHT
    }

    y -= 10

    if (gstAmt > 0) {
      drawText(
        page,
        `Total GST: ${inr(gstAmt)}`,
        MARGIN,
        y,
        {
          font: fontBold,
          size: 10,
        }
      )

      y -= 18
    }

    drawText(
      page,
      numberToWords(total),
      MARGIN,
      y,
      {
        font,
        size: 9,
      }
    )

    y -= 35

    const netBoxX = PAGE_WIDTH - 220

    drawBox(page, netBoxX, y - 40, 190, 40, {
      borderWidth: 1.2,
    })

    drawText(
      page,
      'Net Amount',
      netBoxX + 10,
      y - 15,
      {
        font: fontBold,
        size: 11,
      }
    )

    drawText(
      page,
      inr(total),
      netBoxX + 10,
      y - 32,
      {
        font: fontBold,
        size: 15,
      }
    )

    // FOOTER

    const footerY = 45

    if (firmData.qr_code_url) {
      drawBox(page, MARGIN, footerY, 90, 90)

      const qrData = await fetchImage(
        firmData.qr_code_url
      )

      if (qrData) {
        try {
          const isPng =
            qrData.contentType.includes('png')

          const img = isPng
            ? await doc.embedPng(qrData.bytes)
            : await doc.embedJpg(qrData.bytes)

          page.drawImage(img, {
            x: MARGIN + 5,
            y: footerY + 5,
            width: 80,
            height: 80,
          })
        } catch {}
      }
    }

    drawBox(page, 130, footerY, 220, 90)

    drawText(
      page,
      'Bank Details',
      140,
      footerY + 70,
      {
        font: fontBold,
        size: 9,
      }
    )

    drawText(
      page,
      `Bank: ${
        firmData.bank_name ||
        'Bank of India'
      }`,
      140,
      footerY + 54,
      {
        font,
        size: 8,
      }
    )

    drawText(
      page,
      `A/C No: ${
        firmData.bank_account ||
        '050020110000230'
      }`,
      140,
      footerY + 40,
      {
        font,
        size: 8,
      }
    )

    drawText(
      page,
      `IFSC: ${
        firmData.ifsc || 'BKID0000500'
      }`,
      140,
      footerY + 26,
      {
        font,
        size: 8,
      }
    )

    drawText(
      page,
      firmData.footer_note ||
        'Thank you for your business!',
      140,
      footerY + 10,
      {
        font,
        size: 8,
        color: COLORS.muted,
      }
    )

    const signBoxX = 370
    const signBoxW =
      PAGE_WIDTH - signBoxX - MARGIN

    drawBox(
      page,
      signBoxX,
      footerY,
      signBoxW,
      90
    )

    drawText(
      page,
      `For ${(firmData.name || firm || '')
        .toUpperCase()}`,
      signBoxX + 10,
      footerY + 70,
      {
        font: fontBold,
        size: 9,
      }
    )

    drawText(
      page,
      'Authorised Signatory',
      signBoxX + 10,
      footerY + 10,
      {
        font,
        size: 8,
        color: COLORS.muted,
      }
    )

    pages.forEach((p, index) => {
      drawText(
        p,
        `"Original for Recipient / Duplicate for Supplier"`,
        PAGE_WIDTH / 2 - 110,
        25,
        {
          font,
          size: 7,
          color: COLORS.muted,
        }
      )

      drawText(
        p,
        `Page ${index + 1} of ${
          pages.length
        }`,
        PAGE_WIDTH - 90,
        25,
        {
          font,
          size: 7,
          color: COLORS.muted,
        }
      )

      drawText(
        p,
        `Generated on ${new Date().toLocaleDateString(
          'en-IN'
        )}`,
        MARGIN,
        25,
        {
          font,
          size: 7,
          color: COLORS.muted,
        }
      )
    })

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
    console.error('PDF generation error:', err)

    return Response.json(
      {
        error: err.message || 'PDF generation failed',
      },
      {
        status: 500,
      }
    )
  }
}
