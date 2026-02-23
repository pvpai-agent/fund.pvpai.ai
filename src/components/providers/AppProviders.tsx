'use client';

import { type ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { Web3Provider } from './Web3Provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Web3Provider>
        {children}
      </Web3Provider>
    </ThemeProvider>
  );
}
