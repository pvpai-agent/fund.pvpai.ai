'use client';

import { useState, useEffect, useCallback } from 'react';

interface DeadAgent {
  id: string;
  name: string;
  avatar_seed: string;
  status: string;
  total_trades: number;
  total_pnl: number;
  win_rate: number;
  created_at: string;
  died_at: string | null;
  allocated_funds: number;
  tier: string;
}

export function useGraveyard() {
  const [agents, setAgents] = useState<DeadAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGraveyard = useCallback(async () => {
    try {
      const res = await fetch('/api/public/graveyard');
      const json = await res.json();
      if (json.success) {
        setAgents(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch graveyard:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraveyard();
  }, [fetchGraveyard]);

  const lootAgent = useCallback(async (agentId: string) => {
    const res = await fetch(`/api/agent/${agentId}/loot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    return json.data;
  }, []);

  return { agents, isLoading, lootAgent, refetch: fetchGraveyard };
}
