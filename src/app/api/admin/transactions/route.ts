import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { mockGetAllTransactions, mockGetAllUsers } from '@/lib/mock-db';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const type = req.nextUrl.searchParams.get('type');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '200');

  try {
    if (!isSupabaseConfigured()) {
      let txs = mockGetAllTransactions(limit, 0);
      if (type) txs = txs.filter((t) => t.type === type);
      const users = mockGetAllUsers();
      const userMap = new Map(users.map((u) => [u.id, u.wallet_address]));
      const enriched = txs.map((t) => ({
        ...t,
        user_wallet: userMap.get(t.user_id) ?? 'unknown',
      }));
      return NextResponse.json({ success: true, data: enriched });
    }

    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = createServerClient();

    let query = supabase
      .from('transactions')
      .select('*, users!inner(wallet_address)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;

    const enriched = (data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      user_wallet:
        (t.users as Record<string, string> | null)?.wallet_address ?? 'unknown',
      users: undefined,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Admin transactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
