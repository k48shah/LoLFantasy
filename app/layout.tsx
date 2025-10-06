import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '../components/AuthProvider'
import { Navbar } from '../components/Navbar'

export const metadata: Metadata = {
  title: 'LoL Fantasy MVP - Worlds 2025',
  description: 'Fantasy League for League of Legends Worlds 2025',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-dark-900 text-white">
        <AuthProvider>
          <Navbar />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  )
}