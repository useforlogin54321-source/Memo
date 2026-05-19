import {
PDFDocument,
rgb,
StandardFonts,
} from 'pdf-lib'

export const runtime = 'nodejs'
export const maxDuration = 30

// =====================================================
// COLORS
// =====================================================

const BLACK = rgb(0, 0, 0)
const WHITE = rgb(1, 1, 1)

// =====================================================
// HELPERS
// =====================================================

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
const res = await fetch(url)

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

function line(
page,
x1,
y1,
x2,
y2,
t = 1
) {
page.drawLine({
start: { x: x1, y: y1 },
end: { x: x2, y: y2 },
thickness: t,
color: BLACK,
})
}

function box(
page,
x,
y,
w,
h,
bw = 1
) {
page.drawRectangle({
x,
y,
width: w,
height: h,
borderWidth: bw,
borderColor: BLACK,
})
}

function text(
page,
value,
x,
y,
{
size = 9,
font,
color = BLACK,
}
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
{
size = 9,
font,
color = BLACK,
}
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

// =====================================================
// MAIN
// =====================================================

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
paymentStatus = 'Cash Paid',
gstBreakdown = {
cgst: 0,
sgst: 0,
igst: 0,
},
} = await req.json()

// =================================================
// PDF
// =================================================

const doc =
await PDFDocument.create()

const page = doc.addPage([
842,
595,
])

const font =
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

const M = 16

// =================================================
// OUTER BORDER
// =================================================

box(
page,
M,
M,
width - M * 2,
height - M * 2,
1.5
)

// =================================================
// HEADER
// =================================================

const headerH = 120

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

// CENTER DIVIDER

const halfX = width / 2

line(
page,
halfX,
headerY,
halfX,
headerY + headerH,
1
)

// =================================================
// LOGO AREA
// =================================================

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

page.drawImage(embedded, {
x: M,
y: headerY,
width:
width / 2 - M,
height: headerH,
})
} catch {}
}
}

// =================================================
// CUSTOMER DETAILS
// =================================================

const cx = halfX + 20

text(
page,
'CUSTOMER DETAILS',
cx,
headerY + 82,
{
size: 16,
font: bold,
}
)

text(
page,
'Customer Name',
cx,
headerY + 52,
{
size: 12,
font: bold,
}
)

text(
page,
':',
cx + 150,
headerY + 52,
{
size: 12,
font: bold,
}
)

text(
page,
customer.name ||
'Walk-in Customer',
cx + 170,
headerY + 52,
{
size: 12,
font,
}
)

text(
page,
'Mobile No',
cx,
headerY + 24,
{
size: 12,
font: bold,
}
)

text(
page,
':',
cx + 150,
headerY + 24,
{
size: 12,
font: bold,
}
)

text(
page,
customer.phone ||
'N/A',
cx + 170,
headerY + 24,
{
size: 12,
font,
}
)

// =================================================
// TITLE ROW
// =================================================

const titleH = 44

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

const title =
'TAX INVOICE'

const titleWidth =
bold.widthOfTextAtSize(
title,
24
)

text(
page,
title,
width / 2 -
titleWidth / 2,
titleY + 10,
{
size: 24,
font: bold,
}
)

// =================================================
// INVOICE META
// =================================================

const metaH = 36

const metaY =
titleY - metaH

box(
page,
M,
metaY,
width - M * 2,
metaH,
1
)

line(
page,
width / 2,
metaY,
width / 2,
metaY + metaH
)

text(
page,
'Invoice No',
M + 20,
metaY + 11,
{
size: 11,
font: bold,
}
)

text(
page,
':',
M + 130,
metaY + 11,
{
size: 11,
font: bold,
}
)

text(
page,
memo?.id ||
'INV-0001',
M + 150,
metaY + 11,
{
size: 11,
font: mono,
}
)

text(
page,
'Date',
width / 2 + 40,
metaY + 11,
{
size: 11,
font: bold,
}
)

text(
page,
':',
width / 2 + 110,
metaY + 11,
{
size: 11,
font: bold,
}
)

text(
page,
parseDate(
memo?.created_at
),
width / 2 + 130,
metaY + 11,
{
size: 11,
font: mono,
}
)

// =================================================
// PRODUCT TABLE
// =================================================

const tableH = 290

const tableY =
metaY - tableH

box(
page,
M,
tableY,
width - M * 2,
tableH,
1
)

// COLUMN POSITIONS

const c1 = M + 70
const c2 = M + 460
const c3 = M + 580
const c4 = M + 720

// VERTICAL LINES ONLY

;[c1, c2, c3, c4].forEach(
(x) => {
line(
page,
x,
tableY,
x,
tableY + tableH
)
}
)

// HEADER LINE

const headerLineY =
tableY + tableH - 42

line(
page,
M,
headerLineY,
width - M,
headerLineY,
1
)

// HEADERS

text(
page,
'QTY',
M + 18,
tableY + tableH - 28,
{
size: 12,
font: bold,
}
)

text(
page,
'DESCRIPTION',
c1 + 90,
tableY + tableH - 28,
{
size: 12,
font: bold,
}
)

text(
page,
'HSN',
c2 + 34,
tableY + tableH - 28,
{
size: 12,
font: bold,
}
)

text(
page,
'RATE',
c3 + 40,
tableY + tableH - 28,
{
size: 12,
font: bold,
}
)

text(
page,
'AMOUNT',
c4 + 25,
tableY + tableH - 28,
{
size: 12,
font: bold,
}
)

// =================================================
// ITEMS
// =================================================

let rowY =
tableY + tableH - 80

const rowGap = 34

items
.slice(0, 6)
.forEach((item) => {
text(
page,
item.quantity || 0,
M + 24,
rowY,
{
size: 11,
font,
}
)

text(
page,
(
item.name || '-'
).toUpperCase(),
c1 + 16,
rowY,
{
size: 11,
font,
}
)

text(
page,
item.hsn_code ||
'6101',
c2 + 24,
rowY,
{
size: 11,
font: mono,
}
)

text(
page,
inr(
item.unit_price ||
0
),
c3 + 16,
rowY,
{
size: 11,
font: mono,
}
)

rightText(
page,
inr(
(item.quantity ||
0) *
(item.unit_price ||
0)
),
width - M - 20,
rowY,
{
size: 11,
font: mono,
}
)

rowY -= rowGap
})

// =================================================
// FOOTER
// =================================================

const footerH = 150

const footerY = M

box(
page,
M,
footerY,
width - M * 2,
footerH,
1
)

// 4 COLUMNS

const f1 = M + 180
const f2 = M + 390
const f3 = M + 560

;[f1, f2, f3].forEach(
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

// =================================================
// COLUMN 1 - QR
// =================================================

text(
page,
'PAYMENT QR',
M + 40,
footerY + 118,
{
size: 14,
font: bold,
}
)

if (firmData.qr_url) {
const qr =
await fetchImage(
firmData.qr_url
)

if (qr) {
try {
const qrImg =
qr.contentType.includes(
'png'
)
? await doc.embedPng(
qr.bytes
)
: await doc.embedJpg(
qr.bytes
)

page.drawImage(qrImg, {
x: M + 35,
y: footerY + 20,
width: 100,
height: 100,
})
} catch {}
}
}

// =================================================
// COLUMN 2 - GST BREAKDOWN
// =================================================

text(
page,
'GST BREAKDOWN',
f1 + 36,
footerY + 118,
{
size: 14,
font: bold,
}
)

const gstX = f1 + 20

text(
page,
'CGST (9%)',
gstX,
footerY + 82,
{
size: 11,
font,
}
)

rightText(
page,
inr(
gstBreakdown.cgst
),
f2 - 20,
footerY + 82,
{
size: 11,
font: mono,
}
)

text(
page,
'SGST (9%)',
gstX,
footerY + 54,
{
size: 11,
font,
}
)

rightText(
page,
inr(
gstBreakdown.sgst
),
f2 - 20,
footerY + 54,
{
size: 11,
font: mono,
}
)

text(
page,
'IGST (18%)',
gstX,
footerY + 26,
{
size: 11,
font,
}
)

rightText(
page,
inr(
gstBreakdown.igst
),
f2 - 20,
footerY + 26,
{
size: 11,
font: mono,
}
)

// =================================================
// COLUMN 3 - STATUS
// =================================================

text(
page,
'PAYMENT STATUS',
f2 + 24,
footerY + 118,
{
size: 14,
font: bold,
}
)

text(
page,
'• Cash Paid',
f2 + 28,
footerY + 82,
{
size: 12,
font,
}
)

text(
page,
'• UPI Paid',
f2 + 28,
footerY + 54,
{
size: 12,
font,
}
)

text(
page,
'• Bill Balance',
f2 + 28,
footerY + 26,
{
size: 12,
font,
}
)

text(
page,
`Status : ${paymentStatus}`,
f2 + 20,
footerY + 4,
{
size: 11,
font: bold,
}
)

// =================================================
// COLUMN 4 - TOTAL TABLE
// =================================================

const tX = f3
const tW = width - M - f3

// INNER ROWS

line(
page,
tX,
footerY + 100,
width - M,
footerY + 100
)

line(
page,
tX,
footerY + 50,
width - M,
footerY + 50
)

// INNER DIVIDER

const innerX =
tX + 120

line(
page,
innerX,
footerY,
innerX,
footerY + footerH
)

// ROW 1

text(
page,
'SUB TOTAL',
tX + 24,
footerY + 118,
{
size: 13,
font: bold,
}
)

rightText(
page,
inr(subtotal),
width - M - 20,
footerY + 118,
{
size: 13,
font: mono,
}
)

// ROW 2

text(
page,
'GST TOTAL',
tX + 24,
footerY + 68,
{
size: 13,
font: bold,
}
)

rightText(
page,
inr(gstAmt),
width - M - 20,
footerY + 68,
{
size: 13,
font: mono,
}
)

// ROW 3

text(
page,
'GRAND TOTAL',
tX + 16,
footerY + 18,
{
size: 16,
font: bold,
}
)

rightText(
page,
inr(total),
width - M - 20,
footerY + 18,
{
size: 16,
font: mono,
}
)

// =================================================
// SAVE PDF
// =================================================

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
err?.message ||
'PDF generation failed',
},
{
status: 500,
}
)
}
  }
