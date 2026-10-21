import type { Metadata } from 'next'
import { Fredoka } from 'next/font/google'
import './globals.css'
import { DataProvider } from '@/components/DataContext'

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vice Verse Admin',
  description: 'Central command center for Vice Verse 1.0 2026',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png' },
      { url: '/ivc-logo-transparent.png', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={fredoka.variable}>
      <body className={`${fredoka.className} antialiased`}>
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  )
}
