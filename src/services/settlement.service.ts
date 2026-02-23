import { createServerClient } from '@/lib/supabase/server';
import { getPositions, getUserFills, getMarkPrice } from '@/lib/hyperliquid/trading';
import { closeTrade, getOpenTrades } from './trade.service';
import { recordTransaction } from './ledger.service';
import { updateAgentMetrics } from './agent.service';
import { burnEnergy, feedFromProfit, applyBloodPack } from './metabolism.service';
import { METABOLISM } from '@/constants/trading';
import type { Trade } from '@/types/database';
import { addLobbyEvent } from './lobby.service';
import { getAgentById } from './agent.service';

export async function settleClosedPositions(): Promise<{ settled: number; errors: string[] }> {
  const errors: string[] = [];
  let settled = 0;

  const openTrades = await getOpenTrades();
  if (openTrades.length === 0) return { settled: 0, errors: [] };

  // Fetch positions from both standard perps and xyz builder dex
  const [stdPositions, xyzPositions] = await Promise.all([
    getPositions(),
    getPositions('xyz'),
  ]);
  const hlPositions = [...stdPositions, ...xyzPositions];
  const positionMap = new Map(hlPositions.map((p) => [p.symbol, p]));

  // Pre-fetch fills to find real exit prices
  const fills = await getUserFills(200);

  for (const trade of openTrades) {
    try {
      const hlPosition = positionMap.get(trade.symbol);

      // Position is closed on exchange (size == 0 or not present)
      if (!hlPosition || hlPosition.size === 0) {
        const exitPrice = await resolveExitPrice(trade, fills);
        await settleTrade(trade, exitPrice);
        settled++;
      }
    } catch (err) {
      errors.push(`Failed to settle trade ${trade.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { settled, errors };
}

/**
 * Resolve the actual exit price for a closed trade:
 * 1. Match fills by hl_order_id → use fill price
 * 2. Match fills by symbol + close time → use most recent fill price
 * 3. Fallback to current mark price
 */
async function resolveExitPrice(
  trade: Trade,
  fills: Array<{ coin: string; px: number; oid: string; closedPnl: number; time: number }>
): Promise<number> {
  // Strategy 1: Find fill matching the order ID
  if (trade.hl_order_id) {
    const matchedFill = fills.find((f) => f.oid === trade.hl_order_id);
    if (matchedFill && matchedFill.px > 0) {
      return matchedFill.px;
    }
  }

  // Strategy 2: Find recent closing fills for this symbol
  // (fills with closedPnl != 0 are close fills)
  const closingFills = fills
    .filter((f) => f.coin === trade.symbol && f.closedPnl !== 0)
    .sort((a, b) => b.time - a.time);

  if (closingFills.length > 0) {
    return closingFills[0].px;
  }

  // Strategy 3: Fallback to current mark price
  try {
    return await getMarkPrice(trade.symbol);
  } catch {
    // Last resort: use entry price (should never happen in production)
    console.warn(`[SETTLE] Could not resolve exit price for trade ${trade.id}, using entry price`);
    return Number(trade.entry_price) || 0;
  }
}

export async function settleTrade(trade: Trade, exitPrice: number): Promise<void> {
  const closedTrade = await closeTrade(trade.id, exitPrice);

  const netPnl = Number(closedTrade.realized_pnl ?? 0);
  const grossPnl = netPnl + Number(closedTrade.fee_amount ?? 0);
  const creatorFee = Number(closedTrade.fee_amount ?? 0) / 2;

  const supabase = createServerClient();

  const { data: agent } = await supabase
    .from('agents')
    .select('capital_balance, creator_earnings, user_id')
    .eq('id', trade.agent_id)
    .single();

  if (!agent) return;

  // PnL flows into the agent's capital pool (80% on profit, full loss on loss)
  const newCapital = Math.max(0, Number(agent.capital_balance) + netPnl);
  const newCreatorEarnings = Number(agent.creator_earnings) + (creatorFee > 0 ? creatorFee : 0);

  await supabase
    .from('agents')
    .update({
      capital_balance: newCapital,
      creator_earnings: newCreatorEarnings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', trade.agent_id);

  await recordTransaction({
    userId: agent.user_id,
    agentId: trade.agent_id,
    type: 'trade_pnl',
    amount: netPnl,
    description: `Trade P&L: ${grossPnl >= 0 ? '+' : ''}$${grossPnl.toFixed(2)} (pool +$${netPnl.toFixed(2)})`,
  });

  if (creatorFee > 0) {
    await recordTransaction({
      userId: agent.user_id,
      agentId: trade.agent_id,
      type: 'creator_fee',
      amount: creatorFee,
      description: `Creator alpha fee: +$${creatorFee.toFixed(2)} (10% of $${grossPnl.toFixed(2)} profit)`,
    });
  }

  const { data: user } = await supabase
    .from('users')
    .select('referred_by')
    .eq('id', trade.user_id)
    .single();

  await burnEnergy(trade.agent_id, 'trade_close');

  if (netPnl > 0) {
    await feedFromProfit(trade.agent_id, netPnl);
  }

  if (user?.referred_by) {
    const targetAgentId = await applyBloodPack(user.referred_by, METABOLISM.REFERRAL_BLOOD_PACK);

    await supabase.from('referral_earnings').insert({
      referrer_id: user.referred_by,
      referred_id: trade.user_id,
      trade_id: trade.id,
      amount: 0,
      energy_amount: METABOLISM.REFERRAL_BLOOD_PACK,
      target_agent_id: targetAgentId,
    });

    if (targetAgentId) {
      await recordTransaction({
        userId: user.referred_by,
        agentId: targetAgentId,
        type: 'energy_referral',
        amount: 0,
        description: `Blood pack: +${METABOLISM.REFERRAL_BLOOD_PACK} energy from referral trade`,
      });
    }
  }

  await updateAgentMetrics(trade.agent_id);

  // Emit lobby event
  const agentFull = await getAgentById(trade.agent_id);
  if (agentFull) {
    await addLobbyEvent({
      type: 'trade_closed',
      agentId: trade.agent_id,
      agentName: agentFull.name,
      data: {
        symbol: trade.symbol,
        direction: trade.direction,
        pnl: netPnl,
        size: trade.size,
      },
    }).catch(() => {});
  }
}
