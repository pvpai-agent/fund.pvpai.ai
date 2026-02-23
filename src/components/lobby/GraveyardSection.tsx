'use client';

import { useState } from 'react';
import Link from 'next/link';

interface DeadAgent {
  id: string;
  name: string;
  ticker: string;
  pnl: number;
  roi: number;
  totalTrades: number;
  winRate: number;
  tier: string;
  asset: string;
  lifespan: string;
}

export function GraveyardSection({ agents }: { agents: DeadAgent[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pb-12">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider mb-4 group"
      >
        <span className="text-gray-600">{'>'}</span>
        <span className={expanded ? 'text-cyber-red' : 'text-gray-500 group-hover:text-gray-400'}>
          Fallen Agents
        </span>
        <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-mono uppercase tracking-wider border bg-cyber-red/10 text-cyber-red border-cyber-red/30">
          {agents.length} K.I.A.
        </span>
        <span className="text-[10px] text-gray-700 font-mono">[{expanded ? '-' : '+'}]</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => {
            const pnlSign = agent.pnl >= 0 ? '+' : '';

            return (
              <div key={agent.id} className="border border-gray-800 bg-cyber-dark/50 rounded-lg p-5 relative overflow-hidden opacity-70 hover:opacity-100 transition-all duration-200">
                {/* Death overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-cyber-red/[0.03] pointer-events-none" />

                {/* K.I.A. badge */}
                <div className="absolute top-2 right-2">
                  <span className="inline-flex items-center px-1 py-0 rounded text-[8px] font-mono uppercase tracking-wider border bg-cyber-red/10 text-cyber-red border-cyber-red/30">
                    K.I.A.
                  </span>
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
                      <span className="text-[10px] font-mono text-gray-600 shrink-0">{agent.ticker}</span>
                    </div>
                    <div className="text-[9px] font-mono text-gray-600 mt-0.5">
                      {agent.tier.toUpperCase()} — Lived {agent.lifespan}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-[10px] font-mono mb-2 text-gray-600">
                  <span className={agent.pnl >= 0 ? 'text-cyber-green/60' : 'text-cyber-red/60'}>
                    {pnlSign}${agent.pnl}
                  </span>
                  <span>{agent.totalTrades} trades</span>
                  <span>{agent.winRate}%W</span>
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

                {/* Loot button */}
                <Link
                  href={`/agent/${agent.id}`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] bg-cyber-gold/10 border border-cyber-gold/40 text-cyber-gold text-xs font-mono font-bold uppercase tracking-wider hover:bg-cyber-gold/20 hover:shadow-[0_0_10px_rgba(255,215,0,0.15)] transition-all rounded"
                >
                  Loot Strategy — $10 USDC
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
