import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TrailTrace - Running Route Generator',
  description: 'GPS map foundation for running route generation in Southern California',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

