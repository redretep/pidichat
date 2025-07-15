import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PidiChat - Minimal P2P Web Chat",
  description: "Lightweight, peer-to-peer chat app with no login, no server, no tracking",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700&display=swap" rel="stylesheet" />
        <script src="https://cdn.jsdelivr.net/npm/yjs@13.6.9/dist/yjs.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/y-webrtc@10.3.6/dist/y-webrtc.js"></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
