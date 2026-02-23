'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import type { Agent } from '@/types/database';

export function useAgents() {
  const { address } = useAccount();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    try {
      // Session cookie provides identity — no wallet param needed
      const res = await fetch('/api/agent');
      const data = await res.json();
      if (data.success) {
        setAgents(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, isLoading, refetchAgents: fetchAgents };
}
