import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  mockAddLobbyEvent,
  mockGetLobbyEvents,
  mockGetRecentAgents,
  mockGetAllAgentsSorted,
} from '@/lib/mock-db';
import type { LobbyEvent, LobbyEventType } from '@/types/events';
import type { Agent } from '@/types/database';

export async function addLobbyEvent(input: {
  type: LobbyEventType;
  agentId: string;
  agentName: string;
  data?: LobbyEvent['data'];
}): Promise<LobbyEvent> {
  // Always use mock for lobby events (ephemeral, no need to persist to Supabase)
  return mockAddLobbyEvent(input);
}

export async function getLobbyEvents(limit = 50): Promise<LobbyEvent[]> {
  return mockGetLobbyEvents(limit);
}

export async function getRecentAgents(limit = 12): Promise<Agent[]> {
  // Always include seed demo agents from mock-db
  const mockAgents = mockGetRecentAgents(limit);

  if (!isSupabaseConfigured()) return mockAgents;

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  const supabaseAgents = (data ?? []) as Agent[];

  // Merge: Supabase agents first (real), then mock seed agents to fill
  const seenIds = new Set(supabaseAgents.map((a) => a.id));
  const merged = [
    ...supabaseAgents,
    ...mockAgents.filter((a) => !seenIds.has(a.id)),
  ];
  return merged.slice(0, limit);
}

export async function getLeaderboard(
  sortBy: 'roi' | 'tvl' | 'lifespan',
  limit = 20
): Promise<Agent[]> {
  // Always include seed demo agents from mock-db
  const mockAgents = mockGetAllAgentsSorted(sortBy, limit);

  if (!isSupabaseConfigured()) return mockAgents;

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  let query = supabase.from('agents').select('*').neq('status', 'draft');

  switch (sortBy) {
    case 'roi':
      query = query.gt('capital_balance', 0).order('total_pnl', { ascending: false });
      break;
    case 'tvl':
      query = query.order('capital_balance', { ascending: false });
      break;
    case 'lifespan':
      query = query.order('created_at', { ascending: true });
      break;
  }

  const { data } = await query.limit(limit);
  const supabaseAgents = (data ?? []) as Agent[];

  // Merge: Supabase agents first (real), then mock seed agents to fill
  const seenIds = new Set(supabaseAgents.map((a) => a.id));
  const merged = [
    ...supabaseAgents,
    ...mockAgents.filter((a) => !seenIds.has(a.id)),
  ];
  return merged.slice(0, limit);
}
