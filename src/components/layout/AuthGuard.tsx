'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Button } from '@/components/ui/Button';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, chainId } = useAccount();
  const { open } = useAppKit();
  const { switchChain } = useSwitchChain();

  // Auto-switch to BSC when connected on wrong chain
  useEffect(() => {
    if (isConnected && chainId && chainId !== 56) {
      switchChain({ chainId: 56 });
    }
  }, [isConnected, chainId, switchChain]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="text-center space-y-3">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-mono font-bold text-cyber-green uppercase tracking-wider">
            Access Required
          </h2>
          <p className="text-gray-500 font-mono text-sm max-w-md">
            Connect your wallet to access the PVP AI Agent Lab.
            <br />
            Supported: MetaMask, WalletConnect, Coinbase Wallet
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => open()}
          className="pulse-glow"
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
