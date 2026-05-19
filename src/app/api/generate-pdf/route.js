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
size = 9
) {
page.drawText(String(text || ''), {
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
size = 9
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
color: BLACK,
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
paymentStatus = 'Cash Paid',
qrCodeUrl,
} = await req.json()

// ==================================================
// PDF
// ==================================================

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
headerH,
1
)

// SPLIT INTO 2 HALVES

const midX = width / 2

line(
page,
midX,
headerY,
midX,
headerY + headerH,
1
)

// ==================================================
// LOGO SECTION
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

page.drawImage(img, {
x: M + 2,
y: headerY + 2,
width:
midX - M - 4,
height: headerH - 4,
})
} catch {}
}
}

// ==================================================
// CUSTOMER DETAILS
// ==================================================

drawText(
page,
'CUSTOMER DETAILS',
midX + 20,
headerY + 65,
bold,
14
)

drawText(
page,
'Customer Name',
midX + 20,
headerY + 40,
bold,
10
)

drawText(
page,
':',
midX + 150,
headerY + 40,
bold,
10
)

drawText(
page,
customer.name ||
'Walk-in Customer',
midX + 170,
headerY + 40,
regular,
10
)

drawText(
page,
'Mobile No',
midX + 20,
headerY + 15,
bold,
10
)

drawText(
page,
':',
midX + 150,
headerY + 15,
bold,
10
)

drawText(
page,
customer.phone || '-',
midX + 170,
headerY + 15,
regular,
10
)

// ==================================================
// TITLE ROW
// ==================================================

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
width / 2 - 70,
titleY + 10,
bold,
24
)

// ==================================================
// INVOICE META ROW
// ==================================================

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
M + 120,
metaY + 10,
bold,
10
)

drawText(
page,
memo?.id || 'DRAFT',
M + 140,
metaY + 10,
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
width - 110,
metaY + 10,
bold,
10
)

drawText(
page,
parseDate(
memo?.created_at
),
width - 90,
metaY + 10,
mono,
10
)

// ==================================================
// PRODUCT TABLE
// ==================================================

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

// HEADER ROW

const th = 30

line(
page,
M,
metaY - th,
width - M,
metaY - th,
1
)

// COLUMNS

const c1 = M + 60
const c2 = M + 360
const c3 = M + 450
const c4 = M + 530

// VERTICAL LINES ONLY

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

// TABLE HEADERS

drawText(
page,
'QTY',
M + 18,
metaY - 20,
bold,
10
)

drawText(
page,
'DESCRIPTION',
c1 + 70,
metaY - 20,
bold,
10
)

drawText(
page,
'HSN',
c2 + 25,
metaY - 20,
bold,
10
)

drawText(
page,
'RATE',
c3 + 15,
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

// ==================================================
// ITEMS
// ==================================================

let y = metaY - 55

items
.slice(0, 7)
.forEach((item) => {
drawText(
page,
item.quantity || 0,
M + 20,
y,
regular,
10
)

drawText(
page,
(
item.name || '-'
).toUpperCase(),
c1 + 10,
y,
regular,
10
)

drawText(
page,
item.hsn_code ||
'6101',
c2 + 15,
y,
mono,
10
)

drawText(
page,
inr(
item.unit_price || 0
),
c3 + 10,
y,
mono,
10
)

drawRightText(
page,
inr(
(item.quantity ||
0) *
(item.unit_price ||
0)
),
width - 20,
y,
mono,
10
)

y -= 28
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
footerH,
1
)

// 4 COLUMNS

const f1 = M + 140
const f2 = M + 290
const f3 = M + 410

;[f1, f2, f3].forEach((x) => {
line(
page,
x,
footerY,
x,
footerY + footerH,
1
)
})

// ==================================================
// COLUMN 1 - QR
// ==================================================

drawText(
page,
'PAYMENT QR',
M + 30,
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
} catch {}
}
}

// ==================================================
// COLUMN 2 - GST BREAKDOWN
// ==================================================

drawText(
page,
'GST BREAKDOWN',
f1 + 20,
footerY + 95,
bold,
10
)

drawText(
page,
'CGST (9%)',
f1 + 20,
footerY + 70,
regular,
10
)

drawRightText(
page,
inr(gstAmt / 2),
f2 - 20,
footerY + 70,
mono,
10
)

drawText(
page,
'SGST (9%)',
f1 + 20,
footerY + 45,
regular,
10
)

drawRightText(
page,
inr(gstAmt / 2),
f2 - 20,
footerY + 45,
mono,
10
)

drawText(
page,
'IGST',
f1 + 20,
footerY + 20,
regular,
10
)

drawRightText(
page,
'Rs. 0.00',
f2 - 20,
footerY + 20,
mono,
10
)

// ==================================================
// COLUMN 3 - STATUS
// ==================================================

drawText(
page,
'PAYMENT STATUS',
f2 + 20,
footerY + 95,
bold,
10
)

drawText(
page,
'Cash Paid',
f2 + 20,
footerY + 65,
regular,
10
)

drawText(
page,
'UPI Paid',
f2 + 20,
footerY + 40,
regular,
10
)

drawText(
page,
'Bill Balance',
f2 + 20,
footerY + 15,
regular,
10
)

// ==================================================
// COLUMN 4 - TOTALS TABLE
// ==================================================

const totalX = f3
const totalW = width - M - f3

// ROWS

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

// VERTICAL SPLIT

line(
page,
totalX + 120,
footerY,
totalX + 120,
footerY + footerH,
1
)

// SUBTOTAL

drawText(
page,
'SUB TOTAL',
totalX + 18,
footerY + 90,
bold,
11
)

drawRightText(
page,
inr(subtotal),
width - 20,
footerY + 90,
mono,
11
)

// GST

drawText(
page,
'GST TOTAL',
totalX + 18,
footerY + 50,
bold,
11
)

drawRightText(
page,
inr(gstAmt),
width - 20,
footerY + 50,
mono,
11
)

// GRAND TOTAL

drawText(
page,
'GRAND TOTAL',
totalX + 18,
footerY + 12,
bold,
13
)

drawRightText(
page,
inr(total),
width - 20,
footerY + 12,
mono,
13
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
