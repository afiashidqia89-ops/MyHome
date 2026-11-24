import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RumahLayak — Sistem Pemeriksaan Kelayakan Perumahan & Fasilitas Karyawan",
  description:
    "Aplikasi produksi mobile (auditor & auditee) dan web dashboard untuk pemeriksaan Kelayakan Hunian & Fasilitas Emplasemen Perumahan. Stack: Next.js + PostgreSQL (Neon) + Vercel + Capacitor.",
  keywords: ["RumahLayak", "Kamishibai", "kelayakan hunian", "estate", "audit emplasemen"],
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#14532D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
