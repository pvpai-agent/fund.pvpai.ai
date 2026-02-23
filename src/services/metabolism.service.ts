import { isSupabaseConfigured } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import { METABOLISM, AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { recordTransaction } from './ledger.service';
import { updateUserBalance } from './user.service';
import { mockLogEnergy, mockGetEnergyLogs, mockGetAgentById, mockUpdateAgent } from '@/lib/mock-db';
import type { Agent, EnergyLog, EnergyReason } from '@/types/database';
import { addLobbyEvent } from './lobby.service';

// Import pure function from client-safe module and re-export
import { estimateLifespan } from '@/lib/utils/format';
export { estimateLifespan };

export function calculatePvpFromUsd(usdAmount: number): number {
  return usdAmount * METABOLISM.PVP_PER_USD;
}

export function getTierBurnRate(tier: AgentTier): number {
  return AGENT_TIERS[tier].burn_per_hour;
}

export async function logEnergyChange(
  agentId: string,
  amount: number,
  reason: EnergyReason,
  description?: string
): Promise<{ agent: Agent; log: EnergyLog }> {
  if (!isSupabaseConfigured()) {
    return mockLogEnergy({ agentId, amount, reason, description });
  }

  const supabase = createServerClient();

  const { data: agent } = await supabase
    .from('agents')
    .select('energy_balance')
    .eq('id', agentId)
    .single();

  if (!agent) throw new Error('Agent not found');

  const energyBefore = Number(agent.energy_balance);
  const energyAfter = Math.max(0, energyBefore + amount);

  const { data: updatedAgent, error: agentErr } = await supabase
    .from('agents')
    .update({ energy_balance: energyAfter, updated_at: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single();

  if (agentErr) throw new Error(`Failed to update energy: ${agentErr.message}`);

  const { data: log, error: logErr } = await supabase
    .from('energy_logs')
    .insert({
      agent_id: agentId,
      amount,
      reason,
      description: description ?? null,
      energy_before: energyBefore,
      energy_after: energyAfter,
    })
    .select()
    .single();

  if (logErr) throw new Error(`Failed to log energy: ${logErr.message}`);

  return { agent: updatedAgent as Agent, log: log as EnergyLog };
}

export async function burnEnergy(
  agentId: string,
  reason: EnergyReason = 'heartbeat',
  customAmount?: number
): Promise<{ isDead: boolean; agent: Agent }> {
  const amount = customAmount ?? 1;
  const { agent } = await logEnergyChange(agentId, -amount, reason, `Burn: ${reason}`);

  // Clone fuel referral: 20% of fuel burn cost goes to clone parent creator
  if (agent.clone_parent_id && amount > 0) {
    payCloneFuelReferral(agent.clone_parent_id, amount).catch(() => {});
  }

  const isDead = Number(agent.energy_balance) < METABOLISM.MIN_ENERGY_TO_LIVE;
  return { isDead, agent };
}

const CLONE_FUEL_REFERRAL_PCT = 0.20;

async function payCloneFuelReferral(parentAgentId: string, pvpBurned: number): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createServerClient();
  const { data: parentAgent } = await supabase
    .from('agents')
    .select('user_id')
    .eq('id', parentAgentId)
    .single();

  if (!parentAgent) return;

  const usdAmount = (pvpBurned / METABOLISM.PVP_PER_USD) * CLONE_FUEL_REFERRAL_PCT;
  if (usdAmount < 0.001) return; // Skip dust

  await updateUserBalance(parentAgent.user_id, usdAmount);

  await recordTransaction({
    userId: parentAgent.user_id,
    agentId: parentAgentId,
    type: 'clone_fuel_referral',
    amount: usdAmount,
    description: `Clone fuel referral: +$${usdAmount.toFixed(4)} (20% of ${pvpBurned} PVP burn)`,
  });
}

export async function feedFromProfit(
  agentId: string,
  netProfitUsd: number
): Promise<{ pvpGained: number; hoursExtended: number }> {
  if (netProfitUsd <= 0) return { pvpGained: 0, hoursExtended: 0 };

  const feedUsd = netProfitUsd * (METABOLISM.VAMPIRE_FEED_PCT / 100);
  const pvpGained = calculatePvpFromUsd(feedUsd);

  const { agent } = await logEnergyChange(
    agentId,
    pvpGained,
    'vampire_feed',
    `Vampire feed: $${feedUsd.toFixed(2)} → +$${(pvpGained / 100).toFixed(2)} fuel`
  );

  const hoursExtended = estimateLifespan(pvpGained, Number(agent.burn_rate_per_hour));

  await recordTransaction({
    userId: (agent as Agent).user_id,
    agentId,
    type: 'energy_vampire',
    amount: feedUsd,
    description: `Vampire feed: +$${(pvpGained / 100).toFixed(2)} fuel from $${feedUsd.toFixed(2)} profit`,
  });

  return { pvpGained, hoursExtended };
}

export async function rechargeAgent(
  agentId: string,
  pvpAmount: number
): Promise<{ agent: Agent; log: EnergyLog }> {
  return logEnergyChange(
    agentId,
    pvpAmount,
    'manual_topup',
    `Recharge: +$${(pvpAmount / 100).toFixed(2)} fuel`
  );
}

export async function deathSequence(agentId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const agent = mockGetAgentById(agentId);
    if (!agent || agent.status === 'dead') return;
    if (Number(agent.energy_balance) > 0) {
      mockLogEnergy({ agentId, amount: -Number(agent.energy_balance), reason: 'death_drain', description: 'Agent death: fuel depleted' });
    }
    mockUpdateAgent(agentId, { status: 'dead', energy_balance: 0, capital_balance: 0, died_at: new Date().toISOString() });

    // Emit lobby event
    await addLobbyEvent({
      type: 'agent_died',
      agentId: agent.id,
      agentName: agent.name,
      data: { tier: agent.parsed_rules.tier ?? 'scout' },
    }).catch(() => {});

    return;
  }

  const supabase = createServerClient();

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .single();

  if (!agent) throw new Error('Agent not found');
  if (agent.status === 'dead') return;

  // Log the death drain
  if (Number(agent.energy_balance) > 0) {
    await logEnergyChange(agentId, -Number(agent.energy_balance), 'death_drain', 'Agent death: fuel depleted');
  }

  // Cancel open trades
  await supabase
    .from('trades')
    .update({ status: 'cancelled', closed_at: new Date().toISOString() })
    .eq('agent_id', agentId)
    .eq('status', 'open');

  // Return remaining capital to user balance
  const capitalRemaining = Number(agent.capital_balance);
  if (capitalRemaining > 0) {
    const { data: user } = await supabase
      .from('users')
      .select('balance_usdt')
      .eq('id', agent.user_id)
      .single();

    if (user) {
      const newBalance = Number(user.balance_usdt) + capitalRemaining;
      await supabase
        .from('users')
        .update({ balance_usdt: newBalance, updated_at: new Date().toISOString() })
        .eq('id', agent.user_id);

      await recordTransaction({
        userId: agent.user_id,
        agentId,
        type: 'capital_return',
        amount: capitalRemaining,
        description: `Agent death: $${capitalRemaining.toFixed(2)} capital returned`,
        balanceBefore: Number(user.balance_usdt),
        balanceAfter: newBalance,
      });
    }
  }

  // Set agent to DEAD
  await supabase
    .from('agents')
    .update({
      status: 'dead',
      energy_balance: 0,
      capital_balance: 0,
      died_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  // Emit lobby event
  await addLobbyEvent({
    type: 'agent_died',
    agentId,
    agentName: agent.name,
    data: { tier: (agent.parsed_rules as Agent['parsed_rules']).tier ?? 'scout' },
  }).catch(() => {});
}

export async function checkDeath(agentId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    const agent = mockGetAgentById(agentId);
    if (!agent || agent.status === 'dead') return false;
    if (Number(agent.energy_balance) < METABOLISM.MIN_ENERGY_TO_LIVE) {
      await deathSequence(agentId);
      return true;
    }
    return false;
  }

  const supabase = createServerClient();
  const { data: agent } = await supabase
    .from('agents')
    .select('energy_balance, status')
    .eq('id', agentId)
    .single();

  if (!agent || agent.status === 'dead') return false;

  if (Number(agent.energy_balance) < METABOLISM.MIN_ENERGY_TO_LIVE) {
    await deathSequence(agentId);
    return true;
  }
  return false;
}

export async function getEnergyLogs(agentId: string, limit = 50): Promise<EnergyLog[]> {
  if (!isSupabaseConfigured()) return mockGetEnergyLogs(agentId, limit);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('energy_logs')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch energy logs: ${error.message}`);
  return (data ?? []) as EnergyLog[];
}

export async function applyBloodPack(userId: string, energyAmount: number): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerClient();

  const { data: agents } = await supabase
    .from('agents')
    .select('id, energy_balance')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('energy_balance', { ascending: true })
    .limit(1);

  if (!agents || agents.length === 0) return null;

  const targetAgent = agents[0];
  await logEnergyChange(
    targetAgent.id,
    energyAmount,
    'blood_pack',
    `Referral fuel boost: +$${(energyAmount / 100).toFixed(2)}`
  );

  return targetAgent.id;
}
