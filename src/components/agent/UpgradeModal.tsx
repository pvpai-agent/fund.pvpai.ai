'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useT } from '@/hooks/useTranslation';
import { AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { getNextTier, getUpgradeCost } from '@/constants/upgrades';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  currentTier: AgentTier;
  userBalance: number;
  onUpgrade: () => Promise<void>;
}

export function UpgradeModal({ isOpen, onClose, agentName, currentTier, userBalance, onUpgrade }: UpgradeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const t = useT();

  const nextTier = getNextTier(currentTier);
  if (!nextTier) return null;

  const cost = getUpgradeCost(currentTier, nextTier) ?? 0;
  const current = AGENT_TIERS[currentTier];
  const next = AGENT_TIERS[nextTier];
  const canAfford = cost === 0 || userBalance >= cost;

  const handleUpgrade = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await onUpgrade();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const comparisons: { label: string; before: string; after: string }[] = [
    { label: t.upgradeModal.aiModel, before: current.ai_label, after: next.ai_label },
    { label: t.upgradeModal.compute, before: current.compute, after: next.compute },
    { label: t.upgradeModal.dataFeeds, before: current.data_feeds.length.toString(), after: next.data_feeds.length.toString() },
    { label: t.upgradeModal.frequency, before: current.frequency_label, after: next.frequency_label },
    { label: t.upgradeModal.burnRate, before: `${current.pvp_per_day} PVP/day`, after: `${next.pvp_per_day} PVP/day` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.upgradeModal.title}>
      <div className="space-y-4">
        <div className="font-mono text-xs text-gray-400">
          {t.upgradeModal.upgrading} <span className="text-cyber-green">{agentName}</span> {t.upgradeModal.from}{' '}
          <span className="text-gray-200 uppercase">{currentTier}</span> {t.upgradeModal.to}{' '}
          <span className="text-cyber-gold uppercase">{nextTier}</span>
        </div>

        <div className="bg-cyber-darker rounded border border-terminal-border divide-y divide-terminal-border/50">
          {comparisons.map((c) => (
            <div key={c.label} className="flex items-center px-3 py-2 text-xs font-mono">
              <span className="w-24 text-gray-500">{c.label}</span>
              <span className="text-gray-400">{c.before}</span>
              <span className="mx-2 text-gray-700">{'->'}</span>
              <span className="text-cyber-green">{c.after}</span>
            </div>
          ))}
        </div>

        <div className="bg-cyber-darker rounded border border-terminal-border px-3 py-2 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500">{t.upgradeModal.upgradeCost}</span>
            <span className="text-sm font-mono font-bold text-cyber-green">FREE</span>
          </div>
          <p className="text-[10px] font-mono text-cyber-gold">
            ⚡ {t.upgradeModal.burnRate}: {current.pvp_per_day} → {next.pvp_per_day} PVP/day
          </p>
        </div>

        {error && (
          <div className="text-xs font-mono text-cyber-red">{error}</div>
        )}

        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={handleUpgrade}
          loading={isSubmitting}
          disabled={!canAfford}
        >
          {`${t.upgradeModal.upgradeBtn} ${next.name}`}
        </Button>
      </div>
    </Modal>
  );
}
