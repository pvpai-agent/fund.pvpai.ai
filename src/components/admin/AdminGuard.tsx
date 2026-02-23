'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { isAdminWallet } from '@/lib/admin';
import { Button } from '@/components/ui/Button';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { isConnected, address, chainId } = useAccount();
  const { open } = useAppKit();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (isConnected && chainId && chainId !== 56) {
      switchChain({ chainId: 56 });
    }
  }, [isConnected, chainId, switchChain]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-cyber-black">
        <div className="text-center space-y-3">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-mono font-bold text-cyber-red uppercase tracking-wider">
            Admin Access Required
          </h2>
          <p className="text-gray-500 font-mono text-sm">
            Connect an authorized admin wallet to continue.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={() => open()}>
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (!isAdminWallet(address)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-cyber-black">
        <div className="text-6xl">⛔</div>
        <h2 className="text-xl font-mono font-bold text-cyber-red uppercase tracking-wider">
          Access Denied
        </h2>
        <p className="text-gray-500 font-mono text-sm">
          Wallet {address?.slice(0, 6)}...{address?.slice(-4)} is not authorized.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
