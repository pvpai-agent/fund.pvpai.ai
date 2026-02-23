import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  mockCreateInvestment,
  mockGetUserInvestments,
  mockGetAgentInvestments,
  mockWithdrawInvestment,
  mockGetUserByWallet,
  mockUpdateUserBalance,
} from '@/lib/mock-db';
import { recordTransaction } from './ledger.service';
import type { Agent, Investment } from '@/types/database';

export async function createInvestment(input: {
  userId: string;
  agentId: string;
  amount: number;
  /** When provided, payment was on-chain — skip platform balance deduction */
  txHash?: string;
}): Promise<Investment> {
  const paidOnChain = !!input.txHash;

  if (!isSupabaseConfigured()) {
    // Only deduct from platform balance if NOT paid on-chain
    if (!paidOnChain) {
      mockUpdateUserBalance(input.userId, -input.amount);
    }

    await recordTransaction({
      userId: input.userId,
      agentId: input.agentId,
      type: 'investment',
      amount: -input.amount,
      txHash: input.txHash,
      description: `Invested $${input.amount.toFixed(2)} into agent pool${paidOnChain ? ' (on-chain)' : ''}`,
    });

    return mockCreateInvestment(input);
  }

  // Supabase path
  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  // Get agent's current capital
  const { data: agent } = await supabase
    .from('agents')
    .select('capital_balance')
    .eq('id', input.agentId)
    .single();

  if (!agent) throw new Error('Agent not found');

  const newPool = Number(agent.capital_balance) + input.amount;
  const sharePct = (input.amount / newPool) * 100;

  // Only deduct from platform balance if NOT paid on-chain
  let balanceBefore: number | undefined;
  if (!paidOnChain) {
    const { data: user } = await supabase
      .from('users')
      .select('balance_usdt')
      .eq('id', input.userId)
      .single();

    if (!user) throw new Error('User not found');
    if (Number(user.balance_usdt) < input.amount) throw new Error('Insufficient balance');

    balanceBefore = Number(user.balance_usdt);
    await supabase
      .from('users')
      .update({
        balance_usdt: balanceBefore - input.amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.userId);
  }

  // Increase agent capital
  await supabase
    .from('agents')
    .update({
      capital_balance: newPool,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.agentId);

  // Create investment record
  const { data: inv, error } = await supabase
    .from('investments')
    .insert({
      user_id: input.userId,
      agent_id: input.agentId,
      amount: input.amount,
      share_pct: sharePct,
      status: 'active',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create investment: ${error.message}`);

  await recordTransaction({
    userId: input.userId,
    agentId: input.agentId,
    type: 'investment',
    amount: -input.amount,
    txHash: input.txHash,
    description: `Invested $${input.amount.toFixed(2)} into agent pool${paidOnChain ? ' (on-chain)' : ''}`,
    balanceBefore,
    balanceAfter: balanceBefore != null ? balanceBefore - input.amount : undefined,
  });

  return inv as Investment;
}

export async function getUserInvestments(
  userId: string
): Promise<(Investment & { agent: Agent | null })[]> {
  if (!isSupabaseConfigured()) return mockGetUserInvestments(userId);

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('investments')
    .select('*, agents(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch investments: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as unknown as Investment),
    agent: (row.agents as Agent) ?? null,
  }));
}

export async function getAgentInvestments(agentId: string): Promise<Investment[]> {
  if (!isSupabaseConfigured()) return mockGetAgentInvestments(agentId);

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch agent investments: ${error.message}`);
  return (data ?? []) as Investment[];
}

export async function withdrawInvestment(
  investmentId: string,
  userId: string,
  options?: { skipBalanceCredit?: boolean; txHash?: string }
): Promise<{ netAmount: number; feeAmount: number }> {
  const skipCredit = options?.skipBalanceCredit ?? false;

  if (!isSupabaseConfigured()) {
    const result = mockWithdrawInvestment(investmentId);

    // Credit user (skip when paying on-chain)
    if (!skipCredit) {
      mockUpdateUserBalance(userId, result.netAmount);
    }

    await recordTransaction({
      userId,
      agentId: result.investment.agent_id,
      type: 'investment_withdrawal',
      amount: result.netAmount,
      txHash: options?.txHash,
      description: `Withdrew investment: $${result.netAmount.toFixed(2)} (5% fee: $${result.feeAmount.toFixed(2)})${options?.txHash ? ' (on-chain)' : ''}`,
    });

    return { netAmount: result.netAmount, feeAmount: result.feeAmount };
  }

  const { createServerClient } = await import('@/lib/supabase/server');
  const supabase = createServerClient();

  // Get investment
  const { data: inv } = await supabase
    .from('investments')
    .select('*')
    .eq('id', investmentId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!inv) throw new Error('Investment not found or already withdrawn');

  // Get agent capital
  const { data: agent } = await supabase
    .from('agents')
    .select('capital_balance')
    .eq('id', inv.agent_id)
    .single();

  if (!agent) throw new Error('Agent not found');

  const currentValue = (Number(inv.share_pct) / 100) * Number(agent.capital_balance);
  const feeAmount = currentValue * 0.05;
  const netAmount = currentValue - feeAmount;

  // Reduce agent capital
  await supabase
    .from('agents')
    .update({
      capital_balance: Math.max(0, Number(agent.capital_balance) - currentValue),
      updated_at: new Date().toISOString(),
    })
    .eq('id', inv.agent_id);

  // Credit user internal balance (skip when paying on-chain)
  let balanceBefore: number | undefined;
  if (!skipCredit) {
    const { data: user } = await supabase
      .from('users')
      .select('balance_usdt')
      .eq('id', userId)
      .single();

    if (user) {
      balanceBefore = Number(user.balance_usdt);
      await supabase
        .from('users')
        .update({
          balance_usdt: balanceBefore + netAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }
  }

  // Mark withdrawn
  await supabase
    .from('investments')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', investmentId);

  await recordTransaction({
    userId,
    agentId: inv.agent_id,
    type: 'investment_withdrawal',
    amount: netAmount,
    txHash: options?.txHash,
    description: `Withdrew investment: $${netAmount.toFixed(2)} (5% fee: $${feeAmount.toFixed(2)})${options?.txHash ? ' (on-chain)' : ''}`,
    balanceBefore,
    balanceAfter: balanceBefore != null ? balanceBefore + netAmount : undefined,
  });

  return { netAmount, feeAmount };
}
