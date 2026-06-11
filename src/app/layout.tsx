import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./globals.css";
import CursorGlow from "@/components/CursorGlow";
import SkyCanvas from "@/components/SkyCanvas";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StayOps Promise Ledger",
  description:
    "A promise verification and recovery layer for hotel operations — audit guest-facing promises before arrival, route verified actions to teams, and trace complaints back to the broken promise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Photographic sky: weather pools + rotation + manual shuffle */}
        <SkyCanvas />
        {/* Living light — two slow-drifting bloom layers above the sky */}
        <div className="sky-drift" aria-hidden />
        <CursorGlow />
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  );
}
