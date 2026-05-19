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
hero: 22,
}

// ======================================================
// HELPERS
// ======================================================

const inr = (n) =>
Rs. ${Number(n || 0).toLocaleString(   'en-IN',   {   minimumFractionDigits: 2,   maximumFractionDigits: 2,   }   )}

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

if (!res.ok) {  
  return null  
}  

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
thickness = 1
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

function fitText(
value,
font,
size,
maxWidth
) {
let txt = String(value || '')

while (
txt.length > 0 &&
font.widthOfTextAtSize(
txt,
size
) > maxWidth
) {
txt = txt.slice(0, -1)
}

return txt
}

function drawCellText(
page,
value,
x,
y,
width,
font,
size = 9,
padding = 6,
color = BLACK
) {
const safe = fitText(
value,
font,
size,
width - padding * 2
)

text(
page,
safe,
x + padding,
y,
font,
size,
color
)
}

function drawCellRight(
page,
value,
x,
y,
width,
font,
size = 9,
padding = 6,
color = BLACK
) {
const safe = fitText(
value,
font,
size,
width - padding * 2
)

const tw =
font.widthOfTextAtSize(
safe,
size
)

text(
page,
safe,
x +
width -
tw -
padding,
y,
font,
size,
color
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

const headerH = 95  
const headerY =  
  height - M - headerH  

const halfW =  
  (width - M * 2) / 2  

box(  
  page,  
  M,  
  headerY,  
  width - M * 2,  
  headerH  
)  

line(  
  page,  
  M + halfW,  
  headerY,  
  M + halfW,  
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
      let img = null  

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

      if (img) {  
        const areaW =  
          halfW - 10  

        const areaH =  
          headerH - 10  

        const ratio =  
          img.width /  
          img.height  

        let drawW = areaW  
        let drawH =  
          drawW / ratio  

        if (  
          drawH > areaH  
        ) {  
          drawH = areaH  
          drawW =  
            drawH * ratio  
        }  

        const lx =  
          M +  
          (areaW -  
            drawW) /  
            2 +  
          5  

        const ly =  
          headerY +  
          (areaH -  
            drawH) /  
            2 +  
          5  

        page.drawImage(img, {  
          x: lx,  
          y: ly,  
          width: drawW,  
          height: drawH,  
        })  
      }  
    }  
  } catch {}  
}  

// ==================================================  
// CUSTOMER  
// ==================================================  

drawCellText(  
  page,  
  'Customer Name',  
  M + halfW + 12,  
  headerY + 58,  
  120,  
  regular,  
  10,  
  0,  
  GRAY  
)  

text(  
  page,  
  ':',  
  M + halfW + 130,  
  headerY + 58,  
  bold,  
  10  
)  

drawCellText(  
  page,  
  customer.name ||  
    'Walk-in Customer',  
  M + halfW + 140,  
  headerY + 58,  
  130,  
  bold,  
  10  
)  

drawCellText(  
  page,  
  'Mobile No',  
  M + halfW + 12,  
  headerY + 30,  
  120,  
  regular,  
  10,  
  0,  
  GRAY  
)  

text(  
  page,  
  ':',  
  M + halfW + 130,  
  headerY + 30,  
  bold,  
  10  
)  

drawCellText(  
  page,  
  customer.phone || '-',  
  M + halfW + 140,  
  headerY + 30,  
  130,  
  regular,  
  10  
)  

// ==================================================  
// TITLE BAR  
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

const titleW =  
  bold.widthOfTextAtSize(  
    title,  
    FONT.hero  
  )  

text(  
  page,  
  title,  
  (width - titleW) / 2,  
  titleY + 8,  
  bold,  
  FONT.hero,  
  WHITE  
)  

// ==================================================  
// META ROW  
// ==================================================  

const metaH = 30  
const metaY = titleY - metaH  

box(  
  page,  
  M,  
  metaY,  
  width - M * 2,  
  metaH  
)  

drawCellText(  
  page,  
  'Invoice No',  
  M + 10,  
  metaY + 9,  
  100,  
  regular,  
  9,  
  0,  
  GRAY  
)  

text(  
  page,  
  ':',  
  M + 90,  
  metaY + 9,  
  bold,  
  9  
)  

drawCellText(  
  page,  
  memo?.id || 'DRAFT',  
  M + 100,  
  metaY + 9,  
  180,  
  mono,  
  9  
)  

drawCellText(  
  page,  
  'Date',  
  width - 170,  
  metaY + 9,  
  40,  
  regular,  
  9,  
  0,  
  GRAY  
)  

text(  
  page,  
  ':',  
  width - 120,  
  metaY + 9,  
  bold,  
  9  
)  

drawCellText(  
  page,  
  parseDate(  
    memo?.created_at  
  ),  
  width - 110,  
  metaY + 9,  
  80,  
  mono,  
  9  
)  

// ==================================================  
// TABLE  
// ==================================================  

const tableBottom = 130  
const tableTop = metaY  

box(  
  page,  
  M,  
  tableBottom,  
  width - M * 2,  
  tableTop - tableBottom  
)  

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

// ==================================================  
// COLUMN SYSTEM  
// ==================================================  

const TABLE = {  
  qty: 55,  
  desc: 265,  
  hsn: 75,  
  rate: 85,  
  amount: 95,  
}  

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

// ==================================================  
// VERTICALS  
// ==================================================  

;[  
  cols.desc,  
  cols.hsn,  
  cols.rate,  
  cols.amount,  
].forEach((x) => {  
  line(  
    page,  
    x,  
    tableBottom,  
    x,  
    tableTop  
  )  
})  

// ==================================================  
// TABLE HEADERS  
// ==================================================  

drawCellText(  
  page,  
  'QTY',  
  cols.qty,  
  tableTop - 18,  
  TABLE.qty,  
  bold,  
  9  
)  

drawCellText(  
  page,  
  'DESCRIPTION',  
  cols.desc,  
  tableTop - 18,  
  TABLE.desc,  
  bold,  
  9  
)  

drawCellText(  
  page,  
  'HSN',  
  cols.hsn,  
  tableTop - 18,  
  TABLE.hsn,  
  bold,  
  9  
)  

drawCellText(  
  page,  
  'RATE',  
  cols.rate,  
  tableTop - 18,  
  TABLE.rate,  
  bold,  
  9  
)  

drawCellText(  
  page,  
  'AMOUNT',  
  cols.amount,  
  tableTop - 18,  
  TABLE.amount,  
  bold,  
  9  
)  

// ==================================================  
// ITEMS  
// ==================================================  

let rowY =  
  tableTop - 50  

items  
  .slice(0, 7)  
  .forEach((item) => {  
    drawCellText(  
      page,  
      item.quantity || 0,  
      cols.qty,  
      rowY,  
      TABLE.qty,  
      regular,  
      9  
    )  

    let desc = (  
      item.name || '-'  
    ).toUpperCase()  

    if (item.size) {  
      desc += ` (${item.size})`  
    }  

    drawCellText(  
      page,  
      desc,  
      cols.desc,  
      rowY,  
      TABLE.desc,  
      regular,  
      9  
    )  

    drawCellText(  
      page,  
      item.hsn_code ||  
        '6101',  
      cols.hsn,  
      rowY,  
      TABLE.hsn,  
      mono,  
      8,  
      6,  
      GRAY  
    )  

    drawCellRight(  
      page,  
      inr(  
        item.unit_price || 0  
      ),  
      cols.rate,  
      rowY,  
      TABLE.rate,  
      mono,  
      8  
    )  

    drawCellRight(  
      page,  
      inr(  
        (item.quantity || 0) *  
          (item.unit_price ||  
            0)  
      ),  
      cols.amount,  
      rowY,  
      TABLE.amount,  
      mono,  
      8  
    )  

    rowY -= 25  
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

const footerCols = {  
  qr: 130,  
  gst: 150,  
  status: 120,  
}  

const fx1 =  
  M + footerCols.qr  

const fx2 =  
  fx1 +  
  footerCols.gst  

const fx3 =  
  fx2 +  
  footerCols.status  

;[fx1, fx2, fx3].forEach(  
  (x) => {  
    line(  
      page,  
      x,  
      footerY,  
      x,  
      footerY + footerH  
    )  
  }  
)  

// ==================================================  
// QR  
// ==================================================  

text(  
  page,  
  'PAYMENT QR',  
  M + 22,  
  footerY + 95,  
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

      try {  
        img =  
          await doc.embedPng(  
            qr.bytes  
          )  
      } catch {  
        try {  
          img =  
            await doc.embedJpg(  
              qr.bytes  
            )  
        } catch {}  
      }  

      if (img) {  
        const size = 76  

        page.drawImage(img, {  
          x:  
            M +  
            (footerCols.qr -  
              size) /  
              2,  
          y:  
            footerY + 20,  
          width: size,  
          height: size,  
        })  
      } else {  
        text(  
          page,  
          'INVALID QR',  
          M + 25,  
          footerY + 55,  
          regular,  
          8,  
          GRAY  
        )  
      }  
    }  
  } catch {}  
}  

// ==================================================  
// GST BREAKDOWN  
// ==================================================  

text(  
  page,  
  'GST BREAKDOWN',  
  fx1 + 15,  
  footerY + 95,  
  bold,  
  9  
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

let gy =  
  footerY + 68  

gstRows.forEach(([k, v]) => {  
  drawCellText(  
    page,  
    k,  
    fx1,  
    gy,  
    footerCols.gst,  
    regular,  
    8  
  )  

  drawCellRight(  
    page,  
    v,  
    fx1,  
    gy,  
    footerCols.gst,  
    mono,  
    8  
  )  

  gy -= 24  
})  

// ==================================================  
// PAYMENT STATUS  
// ==================================================  

text(  
  page,  
  'PAYMENT STATUS',  
  fx2 + 15,  
  footerY + 95,  
  bold,  
  9  
)  

const statusRows = [  
  'Cash Paid',  
  'UPI Paid',  
  'Bill Balance',  
]  

let sy =  
  footerY + 68  

statusRows.forEach((s) => {  
  drawCellText(  
    page,  
    s,  
    fx2,  
    sy,  
    footerCols.status,  
    regular,  
    8  
  )  

  sy -= 24  
})  

// ==================================================  
// TOTALS  
// ==================================================  

const totalX = fx3  
const totalW =  
  width - M - totalX  

const split =  
  totalX +  
  totalW * 0.42  

line(  
  page,  
  totalX,  
  footerY + 80,  
  width - M,  
  footerY + 80  
)  

line(  
  page,  
  totalX,  
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

const totals = [  
  [  
    'SUB TOTAL',  
    inr(subtotal),  
    footerY + 90,  
    10,  
  ],  
  [  
    'GST TOTAL',  
    inr(gstAmt),  
    footerY + 50,  
    10,  
  ],  
  [  
    'GRAND TOTAL',  
    inr(total),  
    footerY + 12,  
    11,  
  ],  
]  

totals.forEach(  
  ([label, value, ty, fs]) => {  
    drawCellText(  
      page,  
      label,  
      totalX,  
      ty,  
      split - totalX,  
      bold,  
      fs  
    )  

    drawCellRight(  
      page,  
      value,  
      split,  
      ty,  
      width -  
        M -  
        split,  
      mono,  
      fs - 1  
    )  
  }  
)  

// ==================================================  
// FOOTER NOTE  
// ==================================================  

const note =  
  firmData.footer_note ||  
  'Thank you for your business'  

const nw =  
  regular.widthOfTextAtSize(  
    note,  
    7  
  )  

text(  
  page,  
  note,  
  (width - nw) / 2,  
  4,  
  regular,  
  7,  
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
