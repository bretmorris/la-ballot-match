import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LA Ballot Match — Nov 3, 2026",
  description:
    "A nonpartisan quiz that shows how the contests on your Los Angeles County ballot line up with your own views. Unofficial; not affiliated with LA County.",
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="unofficial">
          Unofficial guide — not a ballot. Not affiliated with the LA County Registrar-Recorder/County Clerk, any
          candidate, campaign, or party.
        </div>
        {children}
      </body>
    </html>
  )
}
