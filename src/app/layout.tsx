import type { Metadata } from "next";
import "./globals.css";
import CursorGlow from "@/components/CursorGlow";

export const metadata: Metadata = {
  title: "StayOps Promise Ledger",
  description:
    "A promise verification and recovery layer for hotel operations — audit guest-facing promises before arrival, route verified actions to teams, and trace complaints back to the broken promise.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <CursorGlow />
        <div className="relative z-[1]">{children}</div>
      </body>
    </html>
  );
}
