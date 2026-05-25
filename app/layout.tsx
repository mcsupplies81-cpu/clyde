import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clyde v1',
  description: 'AI copilot demo for freight brokerages'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
