'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useT } from '@/hooks/useTranslation';
import { AGENT_TIERS, DATA_SOURCES, METABOLISM } from '@/constants/trading';
import type { AgentTier, DataSourceId } from '@/constants/trading';
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
  const [selectedFeeds, setSelectedFeeds] = useState<Set<DataSourceId>>(() => {
    const initial = new Set<DataSourceId>();
    for (const ds of DATA_SOURCES) {
      if (ds.included) initial.add(ds.id);
    }
    return initial;
  });
  const t = useT();

  const nextTier = getNextTier(currentTier);
  if (!nextTier) return null;

  const cost = getUpgradeCost(currentTier, nextTier) ?? 0;
  const current = AGENT_TIERS[currentTier];
  const next = AGENT_TIERS[nextTier];
  const canAfford = cost === 0 || userBalance >= cost;

  // Convert PVP/day to USDC/day
  const currentUsdPerDay = current.pvp_per_day / METABOLISM.PVP_PER_USD;
  const nextUsdPerDay = next.pvp_per_day / METABOLISM.PVP_PER_USD;

  // Calculate data feed add-on cost (exclude Orbit presale from daily burn)
  const dataFeedCostPerDay = DATA_SOURCES
    .filter((ds) => selectedFeeds.has(ds.id) && ds.cost_per_day > 0 && !(ds.id === 'orbit_space' && ds.presale?.enabled))
    .reduce((sum, ds) => sum + ds.cost_per_day, 0);

  // Orbit presale one-time cost
  const orbitDs = DATA_SOURCES.find((ds) => ds.id === 'orbit_space');
  const orbitIsPresale = orbitDs?.presale?.enabled ?? false;
  const orbitPresaleCost = selectedFeeds.has('orbit_space') && orbitIsPresale ? (orbitDs?.presale?.price_usdc ?? 0) : 0;

  const totalBurnPerDay = nextUsdPerDay + dataFeedCostPerDay;

  const toggleFeed = (id: DataSourceId) => {
    setSelectedFeeds((prev) => {
      const next = new Set(prev);
      // Don't allow unchecking free/included sources
      const ds = DATA_SOURCES.find((d) => d.id === id);
      if (ds?.included) return prev;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  // Comparison table: AI Model, Compute, Frequency only (no data source)
  const comparisons: { label: string; before: string; after: string }[] = [
    { label: t.upgradeModal.aiModel, before: current.ai_label, after: next.ai_label },
    { label: t.upgradeModal.compute, before: current.compute, after: next.compute },
    { label: t.upgradeModal.frequency, before: current.frequency_label, after: next.frequency_label },
    { label: t.upgradeModal.burnRate, before: `$${currentUsdPerDay.toFixed(2)} USDC${t.upgradeModal.perDay}`, after: `$${nextUsdPerDay.toFixed(2)} USDC${t.upgradeModal.perDay}` },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.upgradeModal.title}>
      <div className="space-y-4">
        <div className="font-mono text-xs text-gray-400">
          {t.upgradeModal.upgrading} <span className="text-cyber-green">{agentName}</span> {t.upgradeModal.from}{' '}
          <span className="text-gray-200 uppercase">{currentTier}</span> {t.upgradeModal.to}{' '}
          <span className="text-cyber-gold uppercase">{nextTier}</span>
        </div>

        {/* Comparison table */}
        <div className="bg-cyber-darker rounded border border-terminal-border divide-y divide-terminal-border/50">
          {comparisons.map((c) => (
            <div key={c.label} className="flex items-center px-3 py-2 text-xs font-mono">
              <span className="w-20 shrink-0 text-gray-500">{c.label}</span>
              <span className="text-gray-400">{c.before}</span>
              <span className="mx-2 text-gray-700">{'\u2192'}</span>
              <span className="text-cyber-green">{c.after}</span>
            </div>
          ))}
        </div>

        {/* Data Feed Add-ons */}
        <div>
          <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-2">
            + {t.upgradeModal.dataFeedAddons}
          </p>
          <div className="space-y-1.5">
            {DATA_SOURCES.map((ds) => {
              const isChecked = selectedFeeds.has(ds.id);
              const isBaseIncluded = ds.included;
              const isPromo = !isBaseIncluded && ds.original_cost_per_day > ds.cost_per_day;
              const isFree = ds.cost_per_day === 0;
              const isOrbit = ds.id === 'orbit_space';
              return (
                <label
                  key={ds.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${
                    isOrbit
                      ? isChecked
                        ? 'border-fuchsia-500/50 bg-gradient-to-r from-fuchsia-500/10 to-cyber-purple/10'
                        : 'border-fuchsia-500/20 hover:border-fuchsia-500/40'
                      : isChecked
                        ? 'border-cyber-purple/40 bg-cyber-purple/5'
                        : 'border-terminal-border hover:border-gray-500'
                  } ${isBaseIncluded ? 'opacity-80' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFeed(ds.id)}
                    disabled={isBaseIncluded}
                    className="sr-only"
                  />
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isChecked
                      ? isOrbit
                        ? 'border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-400'
                        : 'border-cyber-purple bg-cyber-purple/20 text-cyber-purple'
                      : 'border-gray-600'
                  }`}>
                    {isChecked && <span className="text-[10px]">{'\u2714'}</span>}
                  </span>
                  <span className="text-sm">{ds.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-mono ${isOrbit ? 'text-fuchsia-400' : 'text-gray-300'}`}>{ds.name}</p>
                    <p className="text-[9px] font-mono text-gray-600 truncate">{ds.description}</p>
                  </div>
                  <span className={`text-[10px] font-mono font-bold shrink-0 ${isFree ? 'text-cyber-green' : isOrbit ? 'text-fuchsia-400' : 'text-cyber-gold'}`}>
                    {isBaseIncluded ? t.upgradeModal.free : (isOrbit && ds.presale?.enabled) ? (
                      <span className="text-fuchsia-400">${ds.presale!.price_usdc} USDC <span className="text-[8px] text-gray-500">({t.createAgent.orbitPresale})</span></span>
                    ) : isPromo ? (
                      <><span className="line-through text-gray-600 mr-1">${ds.original_cost_per_day}{t.upgradeModal.perDay}</span><span className="text-cyber-green">${ds.cost_per_day}{t.upgradeModal.perDay}</span></>
                    ) : `+$${ds.cost_per_day.toFixed(2)} USDC${t.upgradeModal.perDay}`}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Cost summary */}
        <div className="bg-cyber-darker rounded border border-terminal-border px-3 py-2.5 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500">{t.upgradeModal.upgradeCost}</span>
            <span className="text-sm font-mono font-bold text-cyber-green">FREE</span>
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500">
            <span>{t.upgradeModal.baseTier}: ${nextUsdPerDay.toFixed(2)}{t.upgradeModal.perDay}</span>
            {dataFeedCostPerDay > 0 && (
              <span>+ {t.upgradeModal.dataFeedCost}: ${dataFeedCostPerDay.toFixed(2)}{t.upgradeModal.perDay}</span>
            )}
          </div>
          {orbitPresaleCost > 0 && (
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="text-fuchsia-400">{'\uD83D\uDEF0\uFE0F'} {t.createAgent.orbitPresale}</span>
              <span className="text-fuchsia-400 font-bold">${orbitPresaleCost} USDC</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1.5 border-t border-terminal-border">
            <span className="text-xs font-mono text-gray-400">{'\u26A1'} {t.upgradeModal.totalBurnRate}</span>
            <span className="text-sm font-mono font-bold text-cyber-gold">${totalBurnPerDay.toFixed(2)} USDC{t.upgradeModal.perDay}</span>
          </div>
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
