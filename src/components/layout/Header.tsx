'use client';

import Link from 'next/link';
import { useAppKit } from '@reown/appkit/react';
import { useAccount } from 'wagmi';
import { useUser } from '@/hooks/useUser';
import { useUsdcBalance } from '@/hooks/useUsdcBalance';
import { formatUsd, shortenAddress } from '@/lib/utils/format';
import { GlitchText } from '@/components/effects/GlitchText';
import { useT } from '@/hooks/useTranslation';

export function Header() {
  const { isConnected, address } = useUser();
  const { open } = useAppKit();
  const { chainId } = useAccount();
  const { balance: usdcBalance } = useUsdcBalance();
  const t = useT();

  const isOnBsc = chainId === 56;

  return (
    <header className="sticky top-0 z-40 border-b border-terminal-border bg-cyber-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 border border-cyber-green rounded flex items-center justify-center">
            <span className="text-cyber-green font-bold text-sm">P</span>
          </div>
          <GlitchText
            text="PVP AI"
            className="text-xl font-bold font-mono text-cyber-green tracking-widest"
            glitchInterval={5000}
          />
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              localStorage.removeItem('pvp_has_seen_how_it_works');
              window.dispatchEvent(new Event('open-how-it-works'));
            }}
            className="hidden md:block text-xs font-mono text-gray-500 hover:text-cyber-blue transition-colors uppercase tracking-wider"
          >
            {t.header.howItWorks}
          </button>

          <Link
            href="/agent/new"
            className="hidden md:block px-3 py-1.5 border border-cyber-green/30 rounded font-mono text-xs text-cyber-green hover:bg-cyber-green/10 transition-colors uppercase tracking-wider"
          >
            {t.common.deployAgent}
          </Link>

          {isConnected ? (
            <>
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 border border-terminal-border rounded bg-cyber-dark">
                <span className="text-xs font-mono text-cyber-gold">
                  {formatUsd(usdcBalance)} USDC
                </span>
                <span className="text-xs font-mono text-gray-600">|</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnBsc ? 'bg-cyber-green' : 'bg-cyber-red animate-pulse'}`} />
                  <span className="text-[10px] font-mono text-gray-500">
                    {isOnBsc ? 'BSC' : t.common.wrongChain}
                  </span>
                </div>
              </div>

              <button
                onClick={() => open()}
                className="flex items-center gap-2 px-3 py-1.5 border border-cyber-green/30 rounded bg-cyber-green/5 hover:bg-cyber-green/10 transition-colors group"
              >
                <span className="text-xs font-mono text-cyber-green group-hover:text-cyber-green">
                  {shortenAddress(address ?? '')}
                </span>
              </button>
            </>
          ) : (
            <button
              onClick={() => open()}
              className="px-4 py-1.5 border border-cyber-green rounded font-mono text-sm text-cyber-green hover:bg-cyber-green/10 transition-colors uppercase tracking-wider"
            >
              {t.common.connect}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
