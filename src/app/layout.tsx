import type { Metadata, Viewport } from 'next'
import { Fredoka } from 'next/font/google'
import './globals.css'
import { DataProvider } from '@/components/DataContext'
import { SITE_CONFIG } from '@/lib/seo-config'
import GoogleAnalytics from '@/components/analytics/GoogleAnalytics'

const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-fredoka',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#050508',
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.canonicalUrl),
  title: {
    default: `${SITE_CONFIG.name} · Central Hackathon & Event Management Portal`,
    template: `%s | ${SITE_CONFIG.shortName}`,
  },
  description: SITE_CONFIG.description,
  keywords: SITE_CONFIG.keywords,
  authors: [{ name: SITE_CONFIG.organization.name }, { name: SITE_CONFIG.organization.college }],
  creator: SITE_CONFIG.organization.name,
  publisher: SITE_CONFIG.organization.name,
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/ivc-logo-transparent.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    shortcut: '/ivc-logo-transparent.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_CONFIG.canonicalUrl,
    siteName: SITE_CONFIG.name,
    title: `${SITE_CONFIG.name} · Central Hackathon & Event Management Portal`,
    description: SITE_CONFIG.description,
    images: [
      {
        url: '/Vice_verse_logo.png',
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.eventName} - ${SITE_CONFIG.organization.name}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_CONFIG.name} · Central Hackathon & Event Management Portal`,
    description: SITE_CONFIG.description,
    images: ['/Vice_verse_logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_CONFIG.canonicalUrl,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${fredoka.variable} ${fredoka.className}`}>
      <head>
        <link rel="icon" href="/ivc-logo-transparent.png" type="image/png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="shortcut icon" href="/ivc-logo-transparent.png" />
      </head>
      <body className={`${fredoka.className} antialiased`}>
        <GoogleAnalytics />
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  )
}
