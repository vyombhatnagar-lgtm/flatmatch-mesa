import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: { default: "FlatMatch: see the trade-off before you fall in love", template: "%s · FlatMatch" },
  description:
    "FlatMatch helps three flatmates set their constraints independently, then shows which listings work for everyone and what each person gives up. It never picks the flat for you.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-3 sm:px-6">
            FlatMatch MVP · Listings are mock data for Pune · Commute times are estimates, not live traffic.
          </div>
        </footer>
      </body>
    </html>
  );
}
