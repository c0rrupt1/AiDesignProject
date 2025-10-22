import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Home Stylist Workspace",
  description:
    "Stage AI-powered interior makeovers, mask edits, and shoppable keyword searches in one streamlined workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-950 text-slate-100`}
      >
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-lg">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-5 md:px-10">
              <Link href="/" className="flex items-center gap-3 text-slate-100">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-300/60 bg-amber-400/20 text-sm font-semibold tracking-[0.35em] text-amber-200">
                  HS
                </span>
                <span className="hidden text-sm font-medium uppercase tracking-[0.4em] text-amber-100 sm:block">
                  Home Stylist
                </span>
              </Link>
              <nav className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-300">
                <Link
                  href="/"
                  className="rounded-full border border-transparent px-4 py-2 transition hover:border-white/20 hover:bg-white/10 hover:text-slate-100"
                >
                  Home
                </Link>
                <Link
                  href="/workspace"
                  className="rounded-full border border-transparent px-4 py-2 transition hover:border-white/20 hover:bg-white/10 hover:text-slate-100"
                >
                  Workspace
                </Link>
                <Link
                  href="/workspace#shopping"
                  className="rounded-full border border-transparent px-4 py-2 transition hover:border-white/20 hover:bg-white/10 hover:text-slate-100"
                >
                  Shopping
                </Link>
                <Link
                  href="/request"
                  className="rounded-full border border-transparent px-4 py-2 transition hover:border-white/20 hover:bg-white/10 hover:text-slate-100"
                >
                  Requests
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/10 bg-slate-950/80">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between md:px-10">
              <p className="uppercase tracking-[0.35em] text-slate-500">
                Interior Makeover Studio
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/workspace"
                  className="rounded-full border border-white/10 px-3 py-1 text-[0.7rem] text-slate-200 transition hover:bg-white/10"
                >
                  Launch workspace
                </Link>
                <Link
                  href="/request"
                  className="rounded-full border border-white/10 px-3 py-1 text-[0.7rem] text-slate-200 transition hover:bg-white/10"
                >
                  Start a request
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
