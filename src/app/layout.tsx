import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clyde — Freight AI Inbox",
  description: "AI-powered email operations for freight brokerages",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
