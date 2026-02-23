import { createServerClient } from '@/lib/supabase/server';
import { placeMarketOrder, getMarkPrice } from '@/lib/hyperliquid/trading';
import { calculateFees } from '@/lib/utils/fee';
import { TRADING } from '@/constants/trading';
import type { Trade, TradeDirection } from '@/types/database';

export interface OpenTradeInput {
  agentId: string;
  userId: string;
  direction: TradeDirection;
  sizeUsd: number;
  leverage: number;
  triggerReason: string;
  triggerData?: Record<string, unknown>;
}

export async function openTrade(input: OpenTradeInput): Promise<Trade> {
  const supabase = createServerClient();

  // Get current price
  const currentPrice = await getMarkPrice(TRADING.DEFAULT_SYMBOL);

  // Calculate size in units
  const sizeInUnits = input.sizeUsd / currentPrice;

  // Place order on Hyperliquid
  const orderResult = await placeMarketOrder({
    symbol: TRADING.DEFAULT_SYMBOL,
    isBuy: input.direction === 'long',
    size: sizeInUnits,
    leverage: input.leverage,
  });

  // Record trade in database
  const { data, error } = await supabase
    .from('trades')
    .insert({
      agent_id: input.agentId,
      user_id: input.userId,
      symbol: TRADING.DEFAULT_SYMBOL,
      direction: input.direction,
      size: sizeInUnits,
      leverage: input.leverage,
      entry_price: orderResult.avgPrice || currentPrice,
      hl_order_id: orderResult.orderId,
      trigger_reason: input.triggerReason,
      trigger_data: input.triggerData ?? null,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record trade: ${error.message}`);
  return data as Trade;
}

export async function closeTrade(tradeId: string, exitPrice: number): Promise<Trade> {
  const supabase = createServerClient();

  // Get trade details
  const { data: trade } = await supabase
    .from('trades')
    .select('*')
    .eq('id', tradeId)
    .single();

  if (!trade) throw new Error('Trade not found');
  if (trade.status !== 'open') throw new Error('Trade is not open');

  // Calculate P&L
  const entryPrice = Number(trade.entry_price);
  const size = Number(trade.size);
  const direction = trade.direction as TradeDirection;

  let pnl: number;
  if (direction === 'long') {
    pnl = (exitPrice - entryPrice) * size;
  } else {
    pnl = (entryPrice - exitPrice) * size;
  }

  // Check if user has referrer
  const { data: user } = await supabase
    .from('users')
    .select('referred_by')
    .eq('id', trade.user_id)
    .single();

  const fees = calculateFees(pnl, !!user?.referred_by);

  // Update trade record
  const { data: updated, error } = await supabase
    .from('trades')
    .update({
      exit_price: exitPrice,
      realized_pnl: fees.netPnl,
      fee_amount: fees.performanceFee,
      referrer_fee: fees.referrerFee,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', tradeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to close trade: ${error.message}`);
  return updated as Trade;
}

export async function getTradesByAgent(agentId: string): Promise<Trade[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('agent_id', agentId)
    .order('opened_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch trades: ${error.message}`);
  return (data ?? []) as Trade[];
}

export async function getOpenTrades(): Promise<Trade[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('status', 'open');

  if (error) throw new Error(`Failed to fetch open trades: ${error.message}`);
  return (data ?? []) as Trade[];
}

export async function getUserTrades(userId: string, limit = 20): Promise<Trade[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('opened_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch user trades: ${error.message}`);
  return (data ?? []) as Trade[];
}
