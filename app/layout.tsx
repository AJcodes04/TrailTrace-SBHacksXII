import type { Metadata } from 'next'
import './globals.css'
import AuthWidget from "@/components/AuthWidget";
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'TrailTrace - Running Route Generator',
  description: 'GPS map foundation for running route generation in Southern California',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
      <header style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Link href="/">Trail Trace</Link>
        <AuthWidget />
      </header>

      <p>Go to <Link href="/settings">Settings</Link> to connect Strava and upload GPX.</p>
        {children}
      </body>
    </html>
  );
}

