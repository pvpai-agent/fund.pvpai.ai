import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { mockGetAllAgents, mockGetAllUsers } from '@/lib/mock-db';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const status = req.nextUrl.searchParams.get('status');

  try {
    if (!isSupabaseConfigured()) {
      let agents = mockGetAllAgents();
      if (status) agents = agents.filter((a) => a.status === status);
      const users = mockGetAllUsers();
      const userMap = new Map(users.map((u) => [u.id, u.wallet_address]));
      const enriched = agents.map((a) => ({
        ...a,
        owner_wallet: userMap.get(a.user_id) ?? 'unknown',
      }));
      return NextResponse.json({ success: true, data: enriched });
    }

    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = createServerClient();

    let query = supabase
      .from('agents')
      .select('*, users!inner(wallet_address)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const enriched = (data ?? []).map((a: Record<string, unknown>) => ({
      ...a,
      owner_wallet:
        (a.users as Record<string, string> | null)?.wallet_address ?? 'unknown',
      users: undefined,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Admin agents error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
