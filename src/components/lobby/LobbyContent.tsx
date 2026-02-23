'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Agent } from '@/types/database';
import { useT } from '@/hooks/useTranslation';
import { AgentSearch } from './AgentSearch';

/* ─── Ticker mock items ─── */
const TICKER_ITEMS = [
  { icon: '\u{1F525}', text: '0x4B2...8f1a invested $500 in $JSEN', color: 'text-cyber-gold', agentId: '' },
  { icon: '\u26A1', text: '$BTCHUNTER printed +45% ROI!', color: 'text-cyber-green', agentId: '' },
  { icon: '\u{1F480}', text: '$PEPE short just starved to death...', color: 'text-cyber-red', agentId: '' },
  { icon: '\u{1F680}', text: '0xdEaD...b33f deployed $TSLAQ [PREDATOR]', color: 'text-cyber-blue', agentId: '' },
  { icon: '\u{1F4B0}', text: '$AWSC just closed +$3,200 on AMZN long', color: 'text-cyber-green', agentId: '' },
  { icon: '\u{1F198}', text: '$BEARISH has < 6 hours of fuel left!', color: 'text-cyber-orange', agentId: '' },
  { icon: '\u{1F525}', text: '0xc0FF...ee01 invested $1,200 in $PLTR', color: 'text-cyber-gold', agentId: '' },
  { icon: '\u26A1', text: '$ELONT flipped +$4,120 trading TSLA', color: 'text-cyber-green', agentId: '' },
  { icon: '\u{1F480}', text: '$INTCOPE ran out of fuel. K.I.A.', color: 'text-cyber-red', agentId: '' },
  { icon: '\u{1F680}', text: '0xBEEF...0123 looted $SNAPYOLO strategy for $10', color: 'text-cyber-purple', agentId: '' },
  { icon: '\u{1F4B0}', text: '$METABULL riding META +$1,780 PnL', color: 'text-cyber-green', agentId: '' },
  { icon: '\u{1F525}', text: '0xFACE...0456 SOS-fed $COINPRX with $50 USDC', color: 'text-cyber-orange', agentId: '' },
];

/* ─── Helpers ─── */
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

function fakeWallet(userId: string): string {
  const hash = userId.replace(/-/g, '').slice(0, 8);
  return `0x${hash.slice(0, 4)}...${hash.slice(-4)}`;
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

function getLifespan(createdAt: string, diedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = diedAt ? new Date(diedAt).getTime() : Date.now();
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours < 1) return `${(hours * 60).toFixed(0)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

/* ─── Sort types ─── */
type SortKey = 'hot' | 'roi' | 'pnl' | 'tvl' | 'winRate' | 'newest';

/* ─── Props ─── */
interface LobbyContentProps {
  agents: Agent[];
  deadAgents: Agent[];
}

/* ─── Agent Card (shared between promoted & grid) ─── */
function AgentCard({ agent, isPromoted }: { agent: Agent; isPromoted?: boolean }) {
  const t = useT();
  const tier = agent.parsed_rules?.tier ?? 'scout';
  const asset = (agent.parsed_rules?.asset ?? 'BTC').replace('xyz:', '');
  const roi = agent.allocated_funds > 0 ? ((agent.total_pnl / agent.allocated_funds) * 100) : 0;
  const pnlSign = agent.total_pnl >= 0 ? '+' : '';
  const ticker = makeTicker(agent.name);
  const wallet = fakeWallet(agent.user_id);
  const avatarBg = getAvatarBg(agent.avatar_seed);
  const fuel = getFuelInfo(agent);
  const fuelColor = fuel.isStarving ? 'bg-cyber-red' : fuel.daysLeft < 3 ? 'bg-cyber-orange' : 'bg-cyber-green';

  return (
    <Link
      href={`/agent/${agent.id}`}
      className={`block border rounded-lg p-4 bg-cyber-dark transition-all duration-200 relative overflow-hidden group ${
        isPromoted
          ? 'border-cyber-gold/50 shadow-[0_0_15px_rgba(255,215,0,0.1)] hover:shadow-[0_0_25px_rgba(255,215,0,0.2)]'
          : 'border-terminal-border hover:border-cyber-green/40'
      }`}
    >
      {/* Promoted badge */}
      {isPromoted && (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-gold/20 text-cyber-gold border border-cyber-gold/40">
          {t.lobby.promoted}
        </span>
      )}

      {/* Header: avatar + name */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-9 h-9 rounded ${avatarBg} flex items-center justify-center shrink-0`}>
          <span className="text-[10px] font-mono font-bold text-black">{tierGlyph(tier)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="font-mono font-bold text-xs text-cyber-green truncate group-hover:neon-glow transition-all">{agent.name}</h3>
            <span className="text-[9px] font-mono text-gray-600 shrink-0">{ticker}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] font-mono text-gray-600">by {wallet}</span>
            <span className={`inline-flex items-center px-1 py-0 rounded text-[7px] font-mono uppercase tracking-wider border ${tierBadgeClass(tier)}`}>
              {tier.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-1 text-[10px] font-mono mb-2.5">
        <div>
          <span className="block text-gray-600">{t.lobby.roi}</span>
          <span className={`text-sm font-bold ${roi >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>{pnlSign}{roi.toFixed(1)}%</span>
        </div>
        <div>
          <span className="block text-gray-600">{t.lobby.pnl}</span>
          <span className={`text-sm font-bold ${agent.total_pnl >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>{pnlSign}${agent.total_pnl.toFixed(0)}</span>
        </div>
        <div>
          <span className="block text-gray-600">{t.lobby.tvl}</span>
          <span className="text-sm font-bold text-cyber-blue">${agent.capital_balance.toFixed(0)}</span>
        </div>
        <div>
          <span className="block text-gray-600">{asset}</span>
          <span className="text-sm font-bold text-gray-300">{agent.win_rate.toFixed(0)}%W</span>
        </div>
      </div>

      {/* Fuel bar */}
      <div>
        <div className="flex items-center justify-between text-[9px] font-mono mb-1">
          <span className={fuel.isStarving ? 'text-cyber-red' : 'text-gray-500'}>{t.lobby.fuel}</span>
          <span className={fuel.isStarving ? 'text-cyber-red font-bold' : 'text-gray-500'}>{fuel.label}</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${fuelColor}`} style={{ width: `${Math.max(2, fuel.pct)}%` }} />
        </div>
      </div>
    </Link>
  );
}

/* ─── Main Component ─── */
export function LobbyContent({ agents, deadAgents }: LobbyContentProps) {
  const t = useT();
  const [sortBy, setSortBy] = useState<SortKey>('hot');
  const [showSearch, setShowSearch] = useState(false);
  const tickerDoubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  // Assign real agent IDs to mock ticker items for navigation
  const tickerWithIds = useMemo(() => {
    return tickerDoubled.map((item, idx) => ({
      ...item,
      agentId: agents[idx % agents.length]?.id ?? '',
    }));
  }, [tickerDoubled, agents]);

  // Promoted agents: top 2 by energy balance (they "paid fuel" for visibility)
  const promotedAgents = useMemo(() => {
    return [...agents]
      .filter(a => a.status === 'active')
      .sort((a, b) => b.energy_balance - a.energy_balance)
      .slice(0, 2);
  }, [agents]);

  const promotedIds = useMemo(() => new Set(promotedAgents.map(a => a.id)), [promotedAgents]);

  // Sort remaining agents
  const sortedAgents = useMemo(() => {
    const remaining = agents.filter(a => a.status === 'active' && !promotedIds.has(a.id));
    const sorted = [...remaining];

    switch (sortBy) {
      case 'hot': {
        sorted.sort((a, b) => {
          const roiA = a.allocated_funds > 0 ? a.total_pnl / a.allocated_funds : 0;
          const roiB = b.allocated_funds > 0 ? b.total_pnl / b.allocated_funds : 0;
          const scoreA = roiA * Math.sqrt(Math.max(1, a.capital_balance)) * (1 + a.win_rate / 100);
          const scoreB = roiB * Math.sqrt(Math.max(1, b.capital_balance)) * (1 + b.win_rate / 100);
          return scoreB - scoreA;
        });
        break;
      }
      case 'roi':
        sorted.sort((a, b) => {
          const roiA = a.allocated_funds > 0 ? a.total_pnl / a.allocated_funds : 0;
          const roiB = b.allocated_funds > 0 ? b.total_pnl / b.allocated_funds : 0;
          return roiB - roiA;
        });
        break;
      case 'pnl':
        sorted.sort((a, b) => b.total_pnl - a.total_pnl);
        break;
      case 'tvl':
        sorted.sort((a, b) => b.capital_balance - a.capital_balance);
        break;
      case 'winRate':
        sorted.sort((a, b) => b.win_rate - a.win_rate);
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return sorted;
  }, [agents, sortBy, promotedIds]);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'hot', label: `\u{1F525} ${t.lobby.sortHot}` },
    { key: 'roi', label: t.lobby.sortRoi },
    { key: 'pnl', label: t.lobby.sortPnl },
    { key: 'tvl', label: t.lobby.sortTvl },
    { key: 'winRate', label: t.lobby.sortWinRate },
    { key: 'newest', label: t.lobby.sortNewest },
  ];

  const totalActive = agents.filter(a => a.status === 'active').length;

  return (
    <div>
      {/* ── Ticker Tape (clickable) ── */}
      <div className="w-full bg-cyber-darker/90 border-y border-terminal-border overflow-hidden">
        <div className="animate-marquee flex items-center whitespace-nowrap py-2">
          {tickerWithIds.map((item, idx) => (
            item.agentId ? (
              <Link
                key={idx}
                href={`/agent/${item.agentId}`}
                className="flex items-center gap-1.5 mx-4 text-xs font-mono shrink-0 hover:opacity-80 transition-opacity"
              >
                <span className="text-sm">{item.icon}</span>
                <span className={item.color}>{item.text}</span>
                <span className="text-gray-700 ml-2">|</span>
              </Link>
            ) : (
              <span key={idx} className="flex items-center gap-1.5 mx-4 text-xs font-mono shrink-0">
                <span className="text-sm">{item.icon}</span>
                <span className={item.color}>{item.text}</span>
                <span className="text-gray-700 ml-2">|</span>
              </span>
            )
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="px-4 lg:px-6">
        {/* Search Bar */}
        <div className="py-4">
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-cyber-darker border border-terminal-border rounded-lg hover:border-cyber-green/40 transition-all group"
          >
            <span className="text-cyber-green/60 text-sm group-hover:text-cyber-green transition-colors">{'>'}_</span>
            <span className="font-mono text-xs text-gray-600 group-hover:text-gray-400 transition-colors">{t.lobby.searchPlaceholder}</span>
            <span className="ml-auto text-[9px] font-mono text-gray-700 border border-terminal-border rounded px-1.5 py-0.5">AI</span>
          </button>
        </div>

        {/* Promoted Agents (Ad Slots) */}
        {promotedAgents.length > 0 && (
          <div className="pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promotedAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} isPromoted />
              ))}
            </div>
          </div>
        )}

        {/* Sort Tabs + Agent Count */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`shrink-0 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded transition-all ${
                  sortBy === opt.key
                    ? 'bg-cyber-green/15 text-cyber-green border border-cyber-green/40'
                    : 'text-gray-600 hover:text-gray-400 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className="text-[10px] font-mono text-gray-600">
              {totalActive} {t.lobby.agentsCount}
            </span>
            <Link
              href="/agent/new"
              className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-green/10 border border-cyber-green/40 text-cyber-green hover:bg-cyber-green/20 transition-all shrink-0"
            >
              {t.lobby.deploy}
            </Link>
          </div>
        </div>

        {/* Agent Grid */}
        {sortedAgents.length === 0 && promotedAgents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-terminal-border rounded-lg">
            <p className="text-gray-600 font-mono text-xs mb-4">{t.lobby.noAgentsYet}</p>
            <Link href="/agent/new" className="text-cyber-green underline text-sm font-mono">{t.common.deployAgent}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
            {sortedAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* ── Fallen Agents (Graveyard) ── */}
        {deadAgents.length > 0 && (
          <div className="pb-10">
            <h2 className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider mb-4">
              <span className="text-gray-600">{'>'}</span>
              <span className="text-cyber-red">{t.lobby.fallenAgents}</span>
              <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono uppercase tracking-wider border bg-cyber-red/10 text-cyber-red border-cyber-red/30">
                {deadAgents.length} {t.lobby.kia}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {deadAgents.map((agent) => {
                const tier = agent.parsed_rules?.tier ?? 'scout';
                const ticker = makeTicker(agent.name);
                const lifespan = getLifespan(agent.created_at, agent.died_at);
                const pnlSign = agent.total_pnl >= 0 ? '+' : '';

                return (
                  <Link
                    key={agent.id}
                    href={`/agent/${agent.id}`}
                    className="block border border-gray-800 bg-cyber-dark/50 rounded-lg p-4 relative overflow-hidden opacity-70 hover:opacity-100 transition-all duration-200 group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyber-red/[0.03] pointer-events-none" />
                    <div className="absolute top-2 right-2">
                      <span className="inline-flex items-center px-1 py-0 rounded text-[8px] font-mono uppercase tracking-wider border bg-cyber-red/10 text-cyber-red border-cyber-red/30">{t.lobby.kia}</span>
                    </div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center shrink-0">
                        <span className="text-xs font-mono text-gray-600">x_x</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-mono font-bold text-xs text-gray-400 line-through truncate">{agent.name}</h3>
                          <span className="text-[9px] font-mono text-gray-600 shrink-0">{ticker}</span>
                        </div>
                        <div className="text-[9px] font-mono text-gray-600 mt-0.5">
                          {tier.toUpperCase()} — {t.lobby.lived} {lifespan}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-600 mb-2">
                      <span className={agent.total_pnl >= 0 ? 'text-cyber-green/60' : 'text-cyber-red/60'}>
                        {pnlSign}${agent.total_pnl.toFixed(0)}
                      </span>
                      <span>{agent.total_trades} trades</span>
                      <span>{agent.win_rate.toFixed(0)}%W</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full w-0 rounded-full" />
                    </div>
                    <div className="mt-2.5 text-center py-1.5 bg-cyber-gold/10 border border-cyber-gold/30 rounded text-[10px] font-mono font-bold uppercase tracking-wider text-cyber-gold group-hover:bg-cyber-gold/20 transition-colors">
                      {t.lobby.lootStrategy}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4 border-t border-terminal-border">
          <p className="text-gray-700 font-mono text-[10px] tracking-wider">{t.lobby.footer}</p>
        </div>
      </div>

      {/* AI Search Modal */}
      {showSearch && (
        <AgentSearch agents={agents} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
