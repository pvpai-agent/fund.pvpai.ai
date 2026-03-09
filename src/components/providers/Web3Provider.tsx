'use client';

import { createAppKit } from '@reown/appkit/react';
import { WagmiProvider, type Config } from 'wagmi';
import { http } from 'wagmi';
import { bsc, monad } from '@reown/appkit/networks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { type ReactNode, useEffect } from 'react';
import { useTheme } from 'next-themes';

const queryClient = new QueryClient();

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '';
const BSC_RPC_URL = process.env.NEXT_PUBLIC_BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org/';
const MONAD_RPC_URL = process.env.NEXT_PUBLIC_MONAD_RPC_URL ?? 'https://rpc.monad.xyz';

const metadata = {
  name: 'PVPAI OS',
  description: 'AI-powered autonomous trading agents on Hyperliquid',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
  icons: ['/images/logo.svg'],
};

const wagmiAdapter = new WagmiAdapter({
  networks: [bsc, monad],
  projectId,
  ssr: true,
  transports: {
    [bsc.id]: http(BSC_RPC_URL),
    [monad.id]: http(MONAD_RPC_URL),
  },
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: [bsc, monad],
  defaultNetwork: bsc,
  projectId,
  metadata,
  allowUnsupportedChain: false,
  features: {
    analytics: false,
    swaps: false,
    onramp: false,
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#00ff41',
    '--w3m-border-radius-master': '1px',
  },
});

function Web3ThemeSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const modal = document.querySelector('w3m-modal');
    if (modal && resolvedTheme) {
      modal.setAttribute('themeMode', resolvedTheme);
    }
  }, [resolvedTheme]);

  return null;
}

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
      <QueryClientProvider client={queryClient}>
        <Web3ThemeSync />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
