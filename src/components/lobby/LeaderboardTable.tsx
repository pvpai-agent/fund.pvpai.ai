'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { Agent } from '@/types/database';

type SortTab = 'roi' | 'tvl' | 'lifespan';

function getLifespanStr(createdAt: string, diedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end = diedAt ? new Date(diedAt).getTime() : Date.now();
  const hours = (end - start) / (1000 * 60 * 60);
  if (hours < 24) return `${hours.toFixed(0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function LeaderboardTable({ initialData }: { initialData: Agent[] }) {
  const [tab, setTab] = useState<SortTab>('roi');
  const [data, setData] = useState<Agent[]>(initialData);

  const fetchLeaderboard = useCallback(async (sortBy: SortTab) => {
    try {
      const res = await fetch(`/api/public/lobby?sort=${sortBy}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data.leaderboard);
      }
    } catch {
      // Keep current data on error
    }
  }, []);

  useEffect(() => {
    if (tab !== 'roi') {
      fetchLeaderboard(tab);
    } else {
      setData(initialData);
    }
  }, [tab, initialData, fetchLeaderboard]);

  const tabs: { id: SortTab; label: string }[] = [
    { id: 'roi', label: 'ROI' },
    { id: 'tvl', label: 'TVL' },
    { id: 'lifespan', label: 'LIFESPAN' },
  ];

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex border-b border-terminal-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
              tab === t.id
                ? 'text-cyber-green border-b-2 border-cyber-green bg-cyber-green/5'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-terminal-border/50">
        {data.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs font-mono text-gray-600">
            No agents ranked yet.
          </div>
        ) : (
          data.slice(0, 10).map((agent, idx) => {
            const roi = agent.allocated_funds > 0
              ? ((agent.total_pnl / agent.allocated_funds) * 100)
              : 0;
            const pnlSign = agent.total_pnl >= 0 ? '+' : '';

            return (
              <Link
                key={agent.id}
                href={`/agent/${agent.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-cyber-green/5 transition-colors"
              >
                <span className={`w-6 text-center text-xs font-mono font-bold ${
                  idx < 3 ? 'text-cyber-gold' : 'text-gray-600'
                }`}>
                  {idx + 1}.
                </span>
                <span className="flex-1 font-mono text-xs text-gray-200 truncate">
                  {agent.name}
                </span>
                {tab === 'roi' && (
                  <span className={`font-mono text-xs font-bold ${roi >= 0 ? 'text-cyber-green' : 'text-cyber-red'}`}>
                    {pnlSign}{roi.toFixed(1)}%
                  </span>
                )}
                {tab === 'tvl' && (
                  <span className="font-mono text-xs text-cyber-blue">
                    ${agent.capital_balance.toFixed(0)}
                  </span>
                )}
                {tab === 'lifespan' && (
                  <span className="font-mono text-xs text-cyber-gold">
                    {getLifespanStr(agent.created_at, agent.died_at)}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}
