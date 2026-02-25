'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useUser } from '@/hooks/useUser';
import { useT } from '@/hooks/useTranslation';
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
  const t = useT();

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
        {'>'} {t.settings.title}
      </h1>

      {/* Account Info */}
      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          {t.settings.account}
        </h3>
        <div className="space-y-3 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500">{t.settings.wallet}</span>
            <span className="text-cyber-blue">{shortenAddress(address ?? '', 6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.settings.userId}</span>
            <span className="text-gray-400">{user?.id?.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t.settings.joined}</span>
            <span className="text-gray-400">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '--'}
            </span>
          </div>
        </div>
      </Card>

      {/* Your Referral Code */}
      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          {t.settings.yourReferralCode}
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
            {t.common.copy}
          </Button>
        </div>
        <p className="text-[10px] font-mono text-gray-600 mt-2">
          {t.settings.referralDesc}
        </p>
      </Card>

      {/* Apply Referral Code */}
      {!user?.referred_by && (
        <Card>
          <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
            {t.settings.gotReferralCode}
          </h3>
          <div className="flex gap-3">
            <Input
              value={referralInput}
              onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
              placeholder={t.settings.referralPlaceholder}
              error={referralError}
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyReferral}
              loading={referralStatus === 'loading'}
              disabled={!referralInput}
            >
              {t.settings.apply}
            </Button>
          </div>
          {referralStatus === 'success' && (
            <p className="text-cyber-green font-mono text-xs mt-2">{t.settings.referralApplied}</p>
          )}
        </Card>
      )}

      {/* Platform Info */}
      <Card>
        <h3 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-wider mb-4">
          {t.settings.platform}
        </h3>
        <div className="space-y-2 text-xs font-mono text-gray-500">
          <p>{t.settings.version}</p>
          <p>{t.settings.trading}</p>
          <p>{t.settings.chain}</p>
          <p>{t.settings.perfFee}</p>
          <p>{t.settings.referralCommission}</p>
          <p>{t.settings.aiEngine}</p>
        </div>
      </Card>
    </div>
  );
}
