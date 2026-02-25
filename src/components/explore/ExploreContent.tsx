'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Agent } from '@/types/database';
import { useT } from '@/hooks/useTranslation';

/* ─── Helpers (shared with lobby) ─── */
const AVATAR_COLORS = ['bg-cyber-green', 'bg-cyber-blue', 'bg-cyber-purple', 'bg-cyber-gold', 'bg-cyber-red', 'bg-cyber-orange'];

function getAvatarBg(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function makeTicker(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/);
  if (words.length === 1) return '$' + words[0].slice(0, 5).toUpperCase();
  return '$' + words.map(w => w[0]).join('').slice(0, 5).toUpperCase();
}

function tierGlyph(tier: string) {
  return tier === 'predator' ? '>>>' : tier === 'sniper' ? '>>' : '>';
}

function tierBadgeClass(tier: string) {
  return tier === 'predator'
    ? 'bg-cyber-red/10 text-cyber-red border-cyber-red/30'
    : tier === 'sniper'
      ? 'bg-cyber-blue/10 text-cyber-blue border-cyber-blue/30'
      : 'bg-cyber-green/10 text-cyber-green border-cyber-green/30';
}

function getFuelInfo(agent: Agent) {
  const burnPerDay = agent.burn_rate_per_hour * 24;
  const daysLeft = burnPerDay > 0 ? agent.energy_balance / burnPerDay : 999;
  const maxEnergy = Math.max(agent.allocated_funds * 2, 2000);
  const pct = Math.min(100, Math.max(0, (agent.energy_balance / maxEnergy) * 100));
  const isStarving = daysLeft < 1;
  let label: string;
  if (daysLeft > 30) label = '30+ days';
  else if (daysLeft >= 1) label = `~${daysLeft.toFixed(1)}d`;
  else if (daysLeft > 0) label = `~${(daysLeft * 24).toFixed(0)}h`;
  else label = 'EMPTY';
  return { pct, isStarving, label, daysLeft };
}

/* ─── Preference types ─── */
type Preference = 'highRoi' | 'stable' | 'aggressive' | 'tech' | 'new' | 'dip';

/* ─── Props ─── */
interface ExploreContentProps {
  agents: Agent[];
}

/* ─── Component ─── */
export function ExploreContent({ agents }: ExploreContentProps) {
  const t = useT();
  const [selectedPref, setSelectedPref] = useState<Preference | null>(null);

  const activeAgents = useMemo(() => agents.filter(a => a.status === 'active'), [agents]);

  const prefTags: { key: Preference; label: string; icon: string }[] = [
    { key: 'highRoi', label: t.lobby.prefHighRoi, icon: '\u{1F4C8}' },
    { key: 'stable', label: t.lobby.prefStable, icon: '\u{1F6E1}\uFE0F' },
    { key: 'aggressive', label: t.lobby.prefAggressive, icon: '\u26A1' },
    { key: 'tech', label: t.lobby.prefTech, icon: '\u{1F916}' },
    { key: 'new', label: t.lobby.prefNew, icon: '\u{1F31F}' },
    { key: 'dip', label: t.lobby.prefDip, icon: '\u{1F4C9}' },
  ];

  const recommended = useMemo(() => {
    if (!selectedPref) return activeAgents.slice(0, 12);
    const scored = activeAgents.map((a) => {
      let score = 0;
      const roi = a.allocated_funds > 0 ? a.total_pnl / a.allocated_funds : 0;
      const assetStr = (a.parsed_rules?.assets ?? []).join(',').toLowerCase();
      const dir = (a.parsed_rules?.direction_bias ?? '').toLowerCase();
      const tier = (a.parsed_rules?.tier ?? '').toLowerCase();
      const lev = a.parsed_rules?.risk_management?.max_leverage ?? 3;

      switch (selectedPref) {
        case 'highRoi':
          score = roi * 100 + a.total_pnl;
          break;
        case 'stable':
          score = a.win_rate * 2 + (roi > 0 ? 20 : 0) - lev * 3;
          break;
        case 'aggressive':
          score = lev * 15 + Math.abs(roi * 50) + (tier === 'predator' ? 30 : 0);
          break;
        case 'tech':
          if (['nvda', 'aapl', 'msft', 'meta', 'goog', 'amzn', 'pltr', 'tsla'].some(s => assetStr.includes(s))) score += 50;
          score += roi * 20 + a.win_rate;
          break;
        case 'new':
          score = new Date(a.created_at).getTime() / 1e9;
          break;
        case 'dip':
          if (dir === 'short' || dir === 'both') score += 30;
          score += a.win_rate + roi * 10;
          break;
      }
      return { agent: a, score };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, 12).map(s => s.agent);
  }, [activeAgents, selectedPref]);

  return (
    <div className="px-4 lg:px-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-cyber-green font-mono text-sm">{'>'}</span>
        <h1 className="font-mono font-bold text-lg text-cyber-green uppercase tracking-wider">{t.lobby.forYou}</h1>
      </div>
      <p className="text-xs font-mono text-gray-600 mb-6">{t.lobby.forYouSubtitle}</p>

      {/* Preference tags */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-3 mb-6">
        {prefTags.map((tag) => (
          <button
            key={tag.key}
            onClick={() => setSelectedPref(selectedPref === tag.key ? null : tag.key)}
            className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-mono text-xs transition-all ${
              selectedPref === tag.key
                ? 'bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/50 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                : 'bg-cyber-darker text-gray-400 border border-terminal-border hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            <span>{tag.icon}</span>
            <span>{tag.label}</span>
          </button>
        ))}
      </div>

      {/* Agent count */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono text-gray-600">
          {recommended.length} agents {selectedPref ? `matching "${prefTags.find(p => p.key === selectedPref)?.label}"` : ''}
        </span>
        <Link
          href="/agent/new"
          className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-green/10 border border-cyber-green/40 text-cyber-green hover:bg-cyber-green/20 transition-all shrink-0"
        >
          + Deploy
        </Link>
      </div>

      {/* Recommendation cards — vertical feed style */}
      {recommended.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-terminal-border rounded-lg">
          <p className="text-gray-600 font-mono text-xs mb-4">{t.lobby.noAgentsYet}</p>
          <Link href="/agent/new" className="text-cyber-green underline text-sm font-mono">{t.common.deployAgent}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {recommended.map((agent) => {
            const tier = agent.parsed_rules?.tier ?? 'scout';
            const asset = (agent.parsed_rules?.assets ?? ['BTC']).map(a => a.replace('xyz:', '')).join(', ');
            const roi = agent.allocated_funds > 0 ? ((agent.total_pnl / agent.allocated_funds) * 100) : 0;
            const pnlSign = agent.total_pnl >= 0 ? '+' : '';
            const direction = agent.parsed_rules?.direction_bias ?? 'both';
            const lev = agent.parsed_rules?.risk_management?.max_leverage ?? 3;
            const desc = agent.parsed_rules?.description ?? '';
            const ticker = makeTicker(agent.name);
            const avatarBg = getAvatarBg(agent.avatar_seed);
            const fuel = getFuelInfo(agent);
            const fuelColor = fuel.isStarving ? 'bg-cyber-red' : fuel.daysLeft < 3 ? 'bg-cyber-orange' : 'bg-cyber-green';

            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="flex items-start gap-4 p-4 bg-cyber-dark border border-terminal-border rounded-lg hover:border-cyber-purple/40 transition-all group"
              >
                {/* Avatar */}
                {agent.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agent.avatar_url} alt="" className="w-12 h-12 rounded-lg shrink-0 object-cover" />
                ) : (
                  <div className={`w-12 h-12 rounded-lg ${avatarBg} flex items-center justify-center shrink-0`}>
                    <span className="text-sm font-mono font-bold text-black">{tierGlyph(tier)}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-mono font-bold text-sm text-cyber-green truncate group-hover:neon-glow">{agent.name}</h3>
                    <span className="text-[9px] font-mono text-gray-600">{ticker}</span>
                    <span className={`px-1 py-0 rounded text-[7px] font-mono uppercase border ${tierBadgeClass(tier)}`}>{tier}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 mb-2">
                    <span>{asset}</span>
                    <span>{direction.toUpperCase()}</span>
                    <span>{lev}x</span>
                  </div>
                  {desc && (
                    <p className="text-[10px] font-mono text-gray-500 mb-2 line-clamp-2">{desc.length > 100 ? desc.slice(0, 100) + '...' : desc}</p>
                  )}
                  {/* Metrics + Fuel */}
                  <div className="flex items-center gap-4 text-[10px] font-mono">
                    <span className={roi >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>{pnlSign}{roi.toFixed(1)}% ROI</span>
                    <span className={agent.total_pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>{pnlSign}${agent.total_pnl.toFixed(0)}</span>
                    <span className="text-gray-500">{agent.win_rate.toFixed(0)}% Win</span>
                    <span className="text-cyber-blue">${agent.capital_balance.toFixed(0)} TVL</span>
                  </div>
                  {/* Fuel bar */}
                  <div className="mt-2 w-48 max-w-full">
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fuelColor}`} style={{ width: `${Math.max(2, fuel.pct)}%` }} />
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="shrink-0 self-center">
                  <span className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded bg-cyber-purple/10 border border-cyber-purple/30 text-cyber-purple group-hover:bg-cyber-purple/20 transition-colors">
                    {t.lobby.viewAgent}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
