import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { AppProviders } from '@/components/providers/AppProviders';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PVP AI - The Agent Lab',
  description: 'AI-powered autonomous trading agents on Hyperliquid. Trade stocks, crypto, commodities & more.',
  keywords: ['AI', 'trading', 'Hyperliquid', 'DeFi', 'hedge fund', 'autonomous agents', 'TradeFi'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} font-mono antialiased bg-cyber-black text-gray-200`}>
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
