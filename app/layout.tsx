import type { Metadata } from 'next'
import './globals.css'
import AuthWidget from "@/components/AuthWidget";

export const metadata: Metadata = {
  title: 'TrailTrace - Running Route Generator',
  description: 'GPS map foundation for running route generation in Southern California',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: 16, display: "flex", justifyContent: "flex-end" }}>
          <AuthWidget />
        </header>
        {children}
      </body>
    </html>
  );
}

