import type { Metadata } from 'next'
import './globals.css'
import { DataProvider } from '@/components/DataContext'

export const metadata: Metadata = {
  title: 'IVC-EVENTRA | Central Hackathon Portal',
  description: 'Enterprise Event Management & Realtime Jury Evaluation Portal',
  manifest: '/manifest.json',
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
    <html lang="en">
      <body className="antialiased">
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  )
}
