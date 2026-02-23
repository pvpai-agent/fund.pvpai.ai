import { isSupabaseConfigured } from '@/lib/supabase/server';
import { createServerClient } from '@/lib/supabase/server';
import { generateReferralCode } from '@/lib/utils/referral';
import {
  mockFindOrCreateUser,
  mockGetUserByWallet,
  mockGetUserById,
  mockUpdateUserBalance,
} from '@/lib/mock-db';
import type { User } from '@/types/database';

export async function findOrCreateUser(walletAddress: string): Promise<{ user: User; isNew: boolean }> {
  if (!isSupabaseConfigured()) return mockFindOrCreateUser(walletAddress);

  const supabase = createServerClient();
  const normalizedAddress = walletAddress.toLowerCase();

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', normalizedAddress)
    .single();

  if (existing) {
    return { user: existing as User, isNew: false };
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      wallet_address: normalizedAddress,
      referral_code: generateReferralCode(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return { user: newUser as User, isNew: true };
}

export async function getUserByWallet(walletAddress: string): Promise<User | null> {
  if (!isSupabaseConfigured()) return mockGetUserByWallet(walletAddress);

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();
  return data as User | null;
}

export async function getUserById(userId: string): Promise<User | null> {
  if (!isSupabaseConfigured()) return mockGetUserById(userId);

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  return data as User | null;
}

export async function updateUserBalance(userId: string, delta: number): Promise<User> {
  if (!isSupabaseConfigured()) return mockUpdateUserBalance(userId, delta);

  const supabase = createServerClient();

  const { data: user } = await supabase
    .from('users')
    .select('balance_usdt')
    .eq('id', userId)
    .single();

  if (!user) throw new Error('User not found');

  const newBalance = Number(user.balance_usdt) + delta;
  if (newBalance < 0) throw new Error('Insufficient balance');

  const { data: updated, error } = await supabase
    .from('users')
    .update({ balance_usdt: newBalance, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update balance: ${error.message}`);
  return updated as User;
}

export async function getUserByReferralCode(code: string): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = createServerClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('referral_code', code)
    .single();
  return data as User | null;
}

export async function applyReferralCode(userId: string, code: string): Promise<void> {
  const referrer = await getUserByReferralCode(code);
  if (!referrer) throw new Error('Invalid referral code');
  if (referrer.id === userId) throw new Error('Cannot refer yourself');

  if (!isSupabaseConfigured()) return;

  const supabase = createServerClient();
  const { error } = await supabase
    .from('users')
    .update({ referred_by: referrer.id, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Failed to apply referral: ${error.message}`);
}
