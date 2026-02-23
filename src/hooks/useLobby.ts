'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent } from '@/types/database';
import type { LobbyEvent } from '@/types/events';

interface LobbyData {
  events: LobbyEvent[];
  newborns: Agent[];
  leaderboard: Agent[];
}

export function useLobby() {
  const [data, setData] = useState<LobbyData>({
    events: [],
    newborns: [],
    leaderboard: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLobby = useCallback(async () => {
    try {
      const res = await fetch('/api/public/lobby');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch lobby:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLobby();
    // Poll every 30 seconds
    intervalRef.current = setInterval(fetchLobby, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLobby]);

  return { ...data, isLoading, refetch: fetchLobby };
}
