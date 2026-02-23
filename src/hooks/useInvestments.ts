'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import type { Agent, Investment } from '@/types/database';

type InvestmentWithAgent = Investment & { agent: Agent | null };

export function useInvestments() {
  const { address } = useAccount();
  const [investments, setInvestments] = useState<InvestmentWithAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInvestments = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/investments');
      const json = await res.json();
      if (json.success) {
        setInvestments(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch investments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const invest = useCallback(async (agentId: string, amount: number) => {
    const res = await fetch(`/api/agent/${agentId}/invest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    await fetchInvestments();
    return json.data;
  }, [fetchInvestments]);

  const withdraw = useCallback(async (agentId: string, investmentId: string) => {
    const res = await fetch(`/api/agent/${agentId}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investmentId }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    await fetchInvestments();
    return json.data;
  }, [fetchInvestments]);

  return { investments, isLoading, invest, withdraw, refetch: fetchInvestments };
}
