import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
  title: {
    default: "Equinox — DeFi Lending & Liquidation Dashboard",
    template: "%s · Equinox",
  },
  description:
    "Keyless cross-chain DeFi portfolio analyzer and interactive liquidation simulator for Kamino (Solana) and Aave V3 (EVM).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark bg-obsidian`}
    >
      <body className="min-h-full flex flex-col text-slate-100">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
