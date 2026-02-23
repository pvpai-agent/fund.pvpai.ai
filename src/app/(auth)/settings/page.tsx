'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useUser } from '@/hooks/useUser';
import { shortenAddress } from '@/lib/utils/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function SettingsPage() {
  const { address } = useAccount();
  const { user, refetchUser } = useUser();
  const [referralInput, setReferralInput] = useState('');
  const [referralStatus, setReferralStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [referralError, setReferralError] = useState('');

  const handleApplyReferral = async () => {
    if (!referralInput || !address) return;
    setReferralStatus('loading');
    setReferralError('');

    try {
      const res = await fetch('/api/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: referralInput }),
      });
      const data = await res.json();
      if (data.success) {
        setReferralStatus('success');
        refetchUser();
      } else {
        setReferralStatus('error');
        setReferralError(data.error);
      }
    } catch {
      setReferralStatus('error');
      setReferralError('Network error');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-mono font-bold text-cyber-green uppercase tracking-wider">
        {'>'} Settings
      </h1>

      {/* Account Info */}
      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          Account
        </h3>
        <div className="space-y-3 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500">Wallet</span>
            <span className="text-cyber-blue">{shortenAddress(address ?? '', 6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">User ID</span>
            <span className="text-gray-400">{user?.id?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Joined</span>
            <span className="text-gray-400">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '--'}
            </span>
          </div>
        </div>
      </Card>

      {/* Your Referral Code */}
      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          Your Referral Code
        </h3>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-4 py-2 bg-cyber-dark border border-terminal-border rounded text-cyber-purple font-mono font-bold text-lg">
            {user?.referral_code ?? '---'}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (user?.referral_code) {
                navigator.clipboard.writeText(user.referral_code);
              }
            }}
          >
            Copy
          </Button>
        </div>
        <p className="text-[10px] font-mono text-gray-600 mt-2">
          Earn a 20% perpetual commission on all USDC fuel burned by your clones and referred traders.
        </p>
      </Card>

      {/* Apply Referral Code */}
      {!user?.referred_by && (
        <Card>
          <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
            Got a Referral Code?
          </h3>
          <div className="flex gap-3">
            <Input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              placeholder="PVP-XXXXXX"
              error={referralError}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyReferral}
              loading={referralStatus === 'loading'}
              disabled={!referralInput}
            >
              Apply
            </Button>
          </div>
          {referralStatus === 'success' && (
            <p className="text-cyber-green font-mono text-xs mt-2">Referral code applied!</p>
          )}
        </Card>
      )}

      {/* Platform Info */}
      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          Platform
        </h3>
        <div className="space-y-2 text-xs font-mono text-gray-500">
          <p>PVP AI v1.0.0-beta</p>
          <p>Trading: Multi-Asset Perps on Hyperliquid</p>
          <p>Chain: BNB Chain (BSC)</p>
          <p>Performance Fee: 20%</p>
          <p>Referral: 20% perpetual commission on fuel burned by clones</p>
          <p>AI Engine: Claude by Anthropic</p>
        </div>
      </Card>
    </div>
  );
}
