import './globals.css'
import { ThemeProvider } from '@/contexts/ThemeContext'

export const metadata = { 
  title: 'Memo App', 
  description: 'Fast memo & billing' 
}

export const viewport = { 
  width: 'device-width', 
  initialScale: 1, 
  themeColor: '#09090b' 
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
