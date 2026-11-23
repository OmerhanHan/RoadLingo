import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import MobileShellInit from '@/components/MobileShellInit'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#FAF6EF',
}

export const metadata: Metadata = {
  title: 'RoadDash — İngilizce Yazı Sınavı Hazırlık',
  description: 'AI destekli İngilizce yazı pratiği ve sınav hazırlık uygulaması. IELTS/TOEFL için akıllı geribildirim alın.',
  keywords: 'IELTS, TOEFL, İngilizce yazı, sınav hazırlık, AI feedback',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'RoadDash',
  },
  icons: {
    icon: '/icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body>
        <MobileShellInit />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
