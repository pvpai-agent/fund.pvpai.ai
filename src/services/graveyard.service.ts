import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  mockGetAllDeadAgents,
  mockGetAgentById,
  mockGetEnergyLogs,
  mockRecordLoot,
  mockHasLooted,
  mockUpdateUserBalance,
} from '@/lib/mock-db';
import { recordTransaction } from './ledger.service';
import type { Agent, EnergyLog } from '@/types/database';

const LOOT_FEE_USDC = 10;

export async function getAllDeadAgents(): Promise<Agent[]> {
  // Always include seed demo dead agents from mock-db
  const mockDead = mockGetAllDeadAgents();

  if (!isSupabaseConfigured()) return mockDead;

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  const { data } = await supabase
    .from('agents')
    .select('*')
    .eq('status', 'dead')
    .order('died_at', { ascending: false });

  const supabaseDead = (data ?? []) as Agent[];

  // Merge: Supabase first (real), then mock seed to fill
  const seenIds = new Set(supabaseDead.map((a) => a.id));
  return [
    ...supabaseDead,
    ...mockDead.filter((a) => !seenIds.has(a.id)),
  ];
}

export async function hasUserLooted(agentId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return mockHasLooted(agentId, userId);
  // Supabase path would check a loot_records table
  return false;
}

export interface LootResult {
  prompt: string;
  parsed_rules: Agent['parsed_rules'];
  energy_logs: EnergyLog[];
}

export async function lootAgent(
  agentId: string,
  userId: string
): Promise<LootResult> {
  // Check if already looted
  const alreadyLooted = await hasUserLooted(agentId, userId);
  if (alreadyLooted) throw new Error('Already looted this agent');

  if (!isSupabaseConfigured()) {
    const agent = mockGetAgentById(agentId);
    if (!agent) throw new Error('Agent not found');
    if (agent.status !== 'dead') throw new Error('Agent is not dead');

    // Charge the loot fee
    mockUpdateUserBalance(userId, -LOOT_FEE_USDC);

    await recordTransaction({
      userId,
      agentId,
      type: 'loot_fee',
      amount: -LOOT_FEE_USDC,
      description: `Looted dead agent ${agent.name} strategy logs`,
    });

    // Record loot
    mockRecordLoot(agentId, userId);

    // Return the goods
    const energyLogs = mockGetEnergyLogs(agentId, 100);
    return {
      prompt: agent.prompt,
      parsed_rules: agent.parsed_rules,
      energy_logs: energyLogs,
    };
  }

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('status', 'dead')
    .single();

  if (!agent) throw new Error('Agent not found or not dead');

  // Charge loot fee
  const { data: user } = await supabase
    .from('users')
    .select('balance_usdt')
    .eq('id', userId)
    .single();

  if (!user || Number(user.balance_usdt) < LOOT_FEE_USDC) {
    throw new Error('Insufficient balance for loot fee');
  }

  await supabase
    .from('users')
    .update({
      balance_usdt: Number(user.balance_usdt) - LOOT_FEE_USDC,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  await recordTransaction({
    userId,
    agentId,
    type: 'loot_fee',
    amount: -LOOT_FEE_USDC,
    description: `Looted dead agent ${agent.name} strategy logs`,
    balanceBefore: Number(user.balance_usdt),
    balanceAfter: Number(user.balance_usdt) - LOOT_FEE_USDC,
  });

  // Get energy logs
  const { data: logs } = await supabase
    .from('energy_logs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(100);

  return {
    prompt: agent.prompt,
    parsed_rules: agent.parsed_rules as Agent['parsed_rules'],
    energy_logs: (logs ?? []) as EnergyLog[],
  };
}

export { LOOT_FEE_USDC };
