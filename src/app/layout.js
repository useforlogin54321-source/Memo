import './globals.css'
export const metadata = { title: 'Memo App', description: 'Fast memo & billing for Bombay Hosiery and Ace Apparel' }
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#09090b' }
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  )
}
