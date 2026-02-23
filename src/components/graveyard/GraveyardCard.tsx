'use client';

import { Badge } from '@/components/ui/Badge';

interface DeadAgent {
  id: string;
  name: string;
  avatar_seed: string;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
  created_at: string;
  died_at: string | null;
  allocated_funds: number;
  tier: string;
}

function getLifespan(createdAt: string, diedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = diedAt ? new Date(diedAt).getTime() : Date.now();
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours < 1) return `${(hours * 60).toFixed(0)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function makeTicker(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/);
  if (words.length === 1) return '$' + words[0].slice(0, 5).toUpperCase();
  return '$' + words.map(w => w[0]).join('').slice(0, 5).toUpperCase();
}

interface GraveyardCardProps {
  agent: DeadAgent;
  onLoot: (agentId: string) => void;
  onResurrect?: (agentId: string) => void;
  isCreator?: boolean;
  hasLooted?: boolean;
}

export function GraveyardCard({ agent, onLoot, onResurrect, isCreator, hasLooted }: GraveyardCardProps) {
  const pnlSign = agent.total_pnl >= 0 ? '+' : '';
  const ticker = makeTicker(agent.name);
  const lifespan = getLifespan(agent.created_at, agent.died_at);

  return (
    <div className="border border-gray-800 bg-cyber-dark/50 rounded-lg p-5 relative overflow-hidden opacity-70 hover:opacity-100 transition-all duration-200 group">
      {/* Death overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyber-red/[0.03] pointer-events-none" />

      {/* K.I.A. badge */}
      <div className="absolute top-2 right-2">
        <Badge variant="red" className="text-[8px] px-1 py-0">K.I.A.</Badge>
      </div>

      {/* Identity */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="w-9 h-9 rounded bg-gray-800 flex items-center justify-center shrink-0">
          <span className="text-sm font-mono text-gray-600">x_x</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-mono font-bold text-xs text-gray-400 line-through truncate">
              {agent.name}
            </h3>
            <span className="text-[10px] font-mono text-gray-600 shrink-0">{ticker}</span>
          </div>
          <div className="text-[9px] font-mono text-gray-600 mt-0.5">
            {agent.tier.toUpperCase()} — Lived {lifespan}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px] font-mono mb-2 text-gray-600">
        <span className={agent.total_pnl >= 0 ? 'text-cyber-green/60' : 'text-cyber-red/60'}>
          {pnlSign}${agent.total_pnl.toFixed(0)}
        </span>
        <span>{agent.total_trades} trades</span>
        <span>{agent.win_rate.toFixed(0)}%W</span>
      </div>

      {/* Empty fuel bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[9px] font-mono mb-1">
          <span className="text-gray-700">FUEL</span>
          <span className="text-cyber-red/50">EMPTY</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full w-0 rounded-full" />
        </div>
      </div>

      {/* CTA */}
      <div className="flex gap-2">
        <button
          onClick={() => onLoot(agent.id)}
          disabled={hasLooted}
          className="flex-1 px-4 py-2 min-h-[40px] bg-cyber-gold/10 border border-cyber-gold/40 text-cyber-gold text-xs font-mono font-bold uppercase tracking-wider hover:bg-cyber-gold/20 hover:shadow-[0_0_10px_rgba(255,215,0,0.15)] transition-all rounded disabled:opacity-30 disabled:hover:shadow-none"
        >
          {hasLooted ? 'Looted' : 'Loot Strategy — $10'}
        </button>
        {isCreator && onResurrect && (
          <button
            onClick={() => onResurrect(agent.id)}
            className="px-4 py-2 min-h-[40px] border border-cyber-green/40 text-cyber-green text-xs font-mono font-bold uppercase tracking-wider hover:bg-cyber-green/10 transition-all rounded"
          >
            Revive
          </button>
        )}
      </div>
    </div>
  );
}
