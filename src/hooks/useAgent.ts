'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Agent, Trade, EnergyLog } from '@/types/database';

interface EnergyData {
  energy_balance: number;
  burn_rate_per_hour: number;
  estimated_lifespan_hours: number;
  is_critical: boolean;
  logs: EnergyLog[];
}

export function useAgent(agentId: string) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [energyData, setEnergyData] = useState<EnergyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAgent = useCallback(async () => {
    setIsLoading(true);
    try {
      const [agentRes, tradesRes, energyRes] = await Promise.all([
        fetch(`/api/agent/${agentId}`),
        fetch(`/api/agent/${agentId}/trades`),
        fetch(`/api/agent/${agentId}/energy`),
      ]);
      const agentData = await agentRes.json();
      const tradesData = await tradesRes.json();
      const energyDataRes = await energyRes.json();

      if (agentData.success) setAgent(agentData.data);
      if (tradesData.success) setTrades(tradesData.data);
      if (energyDataRes.success) setEnergyData(energyDataRes.data);
    } catch (err) {
      console.error('Failed to fetch agent:', err);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/agent/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) setAgent(data.data);
      return data.success;
    } catch {
      return false;
    }
  };

  const resurrectAgent = async (mintAmount: number, txHash: string) => {
    try {
      const res = await fetch(`/api/agent/${agentId}/resurrect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: mintAmount, txHash }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAgent();
      }
      return data;
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  return { agent, trades, energyData, isLoading, refetchAgent: fetchAgent, updateStatus, resurrectAgent };
}
