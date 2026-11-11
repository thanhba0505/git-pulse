import type { Metadata } from "next";
import "./globals.css";
import { StarfieldCanvas } from "../components/cosmic/StarfieldCanvas";

export const metadata: Metadata = {
  title: "Git-Pulse | Celestial Git Radar & Standup Intelligence",
  description:
    "Developer Intelligence & Git Workspace with Dual-Core AI and Central Gateway SSO.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="min-h-screen bg-void text-slate-100 antialiased selection:bg-cyan-500 selection:text-void relative">
        <StarfieldCanvas />
        <div className="relative z-10 flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
