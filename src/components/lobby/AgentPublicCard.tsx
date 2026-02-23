'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import type { Agent } from '@/types/database';

function getTierBadge(tier: string): { variant: 'green' | 'blue' | 'red'; label: string } {
  switch (tier) {
    case 'predator': return { variant: 'red', label: 'PRED' };
    case 'sniper': return { variant: 'blue', label: 'SNPR' };
    default: return { variant: 'green', label: 'SCOT' };
  }
}

function makeTicker(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/);
  if (words.length === 1) return '$' + words[0].slice(0, 5).toUpperCase();
  return '$' + words.map(w => w[0]).join('').slice(0, 5).toUpperCase();
}

function fakeWallet(userId: string): string {
  const hash = userId.replace(/-/g, '').slice(0, 8);
  return `0x${hash.slice(0, 4)}...${hash.slice(-4)}`;
}

function avatarColor(seed: string): string {
  const colors = [
    'bg-cyber-green', 'bg-cyber-blue', 'bg-cyber-purple',
    'bg-cyber-gold', 'bg-cyber-red', 'bg-cyber-orange',
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  return colors[h % colors.length];
}

function avatarGlyph(tier: string): string {
  switch (tier) {
    case 'predator': return '>>>';
    case 'sniper': return '>>';
    default: return '>';
  }
}

interface FuelInfo {
  daysLeft: number;
  pct: number;
  isStarving: boolean;
  label: string;
}

function getFuelInfo(agent: Agent): FuelInfo {
  const burnPerDay = agent.burn_rate_per_hour * 24;
  const daysLeft = burnPerDay > 0 ? agent.energy_balance / burnPerDay : 999;
  const maxEnergy = Math.max(agent.allocated_funds * 2, 2000);
  const pct = Math.min(100, Math.max(0, (agent.energy_balance / maxEnergy) * 100));
  const isStarving = daysLeft < 1;

  let label: string;
  if (daysLeft > 30) label = '30+ days';
  else if (daysLeft >= 1) label = `~${daysLeft.toFixed(1)}d left`;
  else if (daysLeft > 0) label = `~${(daysLeft * 24).toFixed(0)}h left`;
  else label = 'EMPTY';

  return { daysLeft, pct, isStarving, label };
}

export function AgentPublicCard({ agent }: { agent: Agent }) {
  const tier = agent.parsed_rules?.tier ?? 'scout';
  const { variant, label: tierLabel } = getTierBadge(tier);
  const pnlSign = agent.total_pnl >= 0 ? '+' : '';
  const roi = agent.allocated_funds > 0
    ? ((agent.total_pnl / agent.allocated_funds) * 100).toFixed(1)
    : '0.0';
  const ticker = makeTicker(agent.name);
  const wallet = fakeWallet(agent.user_id);
  const fuel = getFuelInfo(agent);
  const asset = (agent.parsed_rules?.asset ?? 'BTC').replace('xyz:', '');

  return (
    <div className="border border-terminal-border bg-cyber-dark rounded-lg p-5 hover:border-cyber-green/40 transition-all duration-200 group relative overflow-hidden">
      {/* Top row: avatar + identity */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className={`w-9 h-9 rounded ${avatarColor(agent.avatar_seed)} flex items-center justify-center shrink-0`}>
          <span className="text-[10px] font-mono font-bold text-black">{avatarGlyph(tier)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-mono font-bold text-xs text-cyber-green truncate">
              {agent.name}
            </h3>
            <span className="text-[10px] font-mono text-gray-500 shrink-0">{ticker}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono text-gray-600">by {wallet}</span>
            <Badge variant={variant} className="text-[8px] px-1 py-0">{tierLabel}</Badge>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[10px] font-mono mb-2">
        <span className="text-gray-600">{asset}</span>
        <span className={`font-bold ${agent.total_pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
          {pnlSign}${agent.total_pnl.toFixed(0)}
        </span>
        <span className={agent.total_pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>
          {pnlSign}{roi}%
        </span>
        <span className="text-gray-500">{agent.win_rate.toFixed(0)}%W</span>
      </div>

      {/* Fuel bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[9px] font-mono mb-1">
          <span className={fuel.isStarving ? 'text-cyber-red' : 'text-gray-500'}>
            FUEL
          </span>
          <span className={fuel.isStarving ? 'text-cyber-red font-bold' : 'text-gray-500'}>
            {fuel.label}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              fuel.isStarving
                ? 'bg-cyber-red animate-pulse'
                : fuel.daysLeft < 3
                  ? 'bg-cyber-orange'
                  : 'bg-cyber-green'
            }`}
            style={{ width: `${Math.max(2, fuel.pct)}%` }}
          />
        </div>
      </div>

      {/* CTA buttons */}
      <div className="flex gap-2">
        <Link
          href={`/agent/${agent.id}`}
          className="flex-1 text-center px-4 py-2 min-h-[40px] flex items-center justify-center bg-cyber-gold/10 border border-cyber-gold/40 text-cyber-gold text-xs font-mono font-bold uppercase tracking-wider hover:bg-cyber-gold/20 hover:shadow-[0_0_10px_rgba(255,215,0,0.15)] transition-all rounded"
        >
          Invest
        </Link>
        <Link
          href={`/agent/${agent.id}`}
          className={`flex-1 text-center px-4 py-2 min-h-[40px] flex items-center justify-center border text-xs font-mono font-bold uppercase tracking-wider transition-all rounded ${
            fuel.isStarving
              ? 'border-cyber-red/60 text-cyber-red bg-cyber-red/10 hover:bg-cyber-red/20 animate-pulse'
              : 'border-terminal-border text-gray-500 hover:text-cyber-orange hover:border-cyber-orange/40 hover:bg-cyber-orange/5'
          }`}
        >
          {fuel.isStarving ? 'SOS FEED' : 'Feed'}
        </Link>
      </div>
    </div>
  );
}
