import { isSupabaseConfigured } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import {
  mockRecordTransaction,
  mockGetTransactionByTxHash,
  mockGetUserTransactions,
} from '@/lib/mock-db';
import type { Transaction, TxType, TxStatus } from '@/types/database';

export interface CreateTransactionInput {
  userId: string;
  agentId?: string;
  type: TxType;
  status?: TxStatus;
  amount: number;
  token?: string;
  chain?: string;
  txHash?: string;
  description?: string;
  balanceBefore?: number;
  balanceAfter?: number;
}

export async function recordTransaction(input: CreateTransactionInput): Promise<Transaction> {
  if (!isSupabaseConfigured()) return mockRecordTransaction(input);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: input.userId,
      agent_id: input.agentId ?? null,
      type: input.type,
      status: input.status ?? 'confirmed',
      amount: input.amount,
      token: input.token ?? 'USDC',
      chain: input.chain ?? null,
      tx_hash: input.txHash ?? null,
      description: input.description ?? null,
      balance_before: input.balanceBefore ?? null,
      balance_after: input.balanceAfter ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to record transaction: ${error.message}`);
  return data as Transaction;
}

export async function getUserTransactions(
  userId: string,
  limit = 20,
  offset = 0
): Promise<Transaction[]> {
  if (!isSupabaseConfigured()) return mockGetUserTransactions(userId, limit, offset);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`);
  return (data ?? []) as Transaction[];
}

export async function getTransactionByTxHash(txHash: string): Promise<Transaction | null> {
  if (!isSupabaseConfigured()) return mockGetTransactionByTxHash(txHash);

  const supabase = createServerClient();
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('tx_hash', txHash)
    .single();
  return data as Transaction | null;
}
