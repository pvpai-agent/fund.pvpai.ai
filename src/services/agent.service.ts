import { isSupabaseConfigured } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  mockCreateAgent,
  mockGetUserAgents,
  mockGetAgentById,
  mockUpdateAgentStatus,
  mockGetActiveAgents,
  mockGetDeadAgents,
  mockUpdateAgent,
} from '@/lib/mock-db';
import type { Agent, AgentStatus, ParsedRules } from '@/types/database';
import type { AgentTier } from '@/constants/trading';
import { AGENT_TIERS } from '@/constants/trading';
import { addLobbyEvent } from './lobby.service';

export interface CreateAgentInput {
  userId: string;
  name: string;
  prompt: string;
  parsedRules: ParsedRules;
  avatarSeed: string;
  avatarUrl?: string;
  allocatedFunds: number;
  energyBalance: number;
  capitalBalance: number;
  burnRatePerHour: number;
  cloneParentId?: string;
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  let agent: Agent;

  // Generate a unique wallet address for the AI agent
  const walletHex = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const aiWallet = '0x' + walletHex.slice(0, 40);

  if (!isSupabaseConfigured()) {
    agent = mockCreateAgent(input);
  } else {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('agents')
      .insert({
        user_id: input.userId,
        name: input.name,
        prompt: input.prompt,
        parsed_rules: input.parsedRules,
        avatar_seed: input.avatarSeed,
        avatar_url: input.avatarUrl ?? null,
        ai_wallet: aiWallet,
        allocated_funds: input.allocatedFunds,
        energy_balance: input.energyBalance,
        capital_balance: input.capitalBalance,
        burn_rate_per_hour: input.burnRatePerHour,
        clone_parent_id: input.cloneParentId ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create agent: ${error.message}`);
    agent = data as Agent;
  }

  // Emit lobby event
  await addLobbyEvent({
    type: 'agent_born',
    agentId: agent.id,
    agentName: agent.name,
    data: { tier: input.parsedRules.tier ?? 'scout' },
  }).catch(() => {}); // Non-critical

  return agent;
}

export async function getUserAgents(userId: string): Promise<Agent[]> {
  if (!isSupabaseConfigured()) return mockGetUserAgents(userId);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch agents: ${error.message}`);
  return (data ?? []) as Agent[];
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
  if (!isSupabaseConfigured()) return mockGetAgentById(agentId);

  const supabase = createServerClient();

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  // Fallback to mock-db for seed/demo agents shown in lobby
  if (!data) return mockGetAgentById(agentId);

  return data as Agent | null;
}

export async function updateAgentStatus(agentId: string, status: AgentStatus): Promise<Agent> {
  if (!isSupabaseConfigured()) return mockUpdateAgentStatus(agentId, status);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update agent status: ${error.message}`);
  return data as Agent;
}

export async function getActiveAgents(): Promise<Agent[]> {
  if (!isSupabaseConfigured()) return mockGetActiveAgents();

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'active');

  if (error) throw new Error(`Failed to fetch active agents: ${error.message}`);
  return (data ?? []) as Agent[];
}

export async function getDeadAgents(userId: string): Promise<Agent[]> {
  if (!isSupabaseConfigured()) return mockGetDeadAgents(userId);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'dead')
    .order('died_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch dead agents: ${error.message}`);
  return (data ?? []) as Agent[];
}

export async function resurrectAgent(
  agentId: string,
  energyBalance: number,
  capitalBalance: number,
  burnRatePerHour: number
): Promise<Agent> {
  if (!isSupabaseConfigured()) {
    return mockUpdateAgent(agentId, {
      status: 'active',
      energy_balance: energyBalance,
      capital_balance: capitalBalance,
      burn_rate_per_hour: burnRatePerHour,
      died_at: null,
    });
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('agents')
    .update({
      status: 'active',
      energy_balance: energyBalance,
      capital_balance: capitalBalance,
      burn_rate_per_hour: burnRatePerHour,
      died_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to resurrect agent: ${error.message}`);
  return data as Agent;
}

export async function upgradeAgentTier(
  agentId: string,
  newTier: AgentTier
): Promise<Agent> {
  const newBurnRate = AGENT_TIERS[newTier].burn_per_hour;

  if (!isSupabaseConfigured()) {
    return mockUpdateAgent(agentId, {
      parsed_rules: {
        ...mockGetAgentById(agentId)!.parsed_rules,
        tier: newTier,
      },
      burn_rate_per_hour: newBurnRate,
    });
  }

  const supabase = createServerClient();

  const { data: agent } = await supabase
    .from('agents')
    .select('parsed_rules')
    .eq('id', agentId)
    .single();

  if (!agent) throw new Error('Agent not found');

  const updatedRules = { ...(agent.parsed_rules as ParsedRules), tier: newTier };

  const { data, error } = await supabase
    .from('agents')
    .update({
      parsed_rules: updatedRules,
      burn_rate_per_hour: newBurnRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw new Error(`Failed to upgrade agent: ${error.message}`);
  return data as Agent;
}

export async function updateAgentMetrics(agentId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createServerClient();

  const { data: trades } = await supabase
    .from('trades')
    .select('realized_pnl, status')
    .eq('agent_id', agentId)
    .eq('status', 'closed');

  if (!trades || trades.length === 0) return;

  const totalTrades = trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + Number(t.realized_pnl ?? 0), 0);
  const wins = trades.filter((t) => Number(t.realized_pnl ?? 0) > 0).length;
  const winRate = (wins / totalTrades) * 100;

  await supabase
    .from('agents')
    .update({
      total_trades: totalTrades,
      total_pnl: totalPnl,
      win_rate: winRate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);
}
