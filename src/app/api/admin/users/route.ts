import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { mockGetAllUsers, mockGetAllAgents } from '@/lib/mock-db';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    if (!isSupabaseConfigured()) {
      const users = mockGetAllUsers();
      const agents = mockGetAllAgents();
      const enriched = users.map((u) => ({
        ...u,
        agents_count: agents.filter((a) => a.user_id === u.id).length,
        active_agents: agents.filter(
          (a) => a.user_id === u.id && a.status === 'active'
        ).length,
        total_pnl: agents
          .filter((a) => a.user_id === u.id)
          .reduce((s, a) => s + Number(a.total_pnl), 0),
      }));
      return NextResponse.json({ success: true, data: enriched });
    }

    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = createServerClient();

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: agentAggs } = await supabase
      .from('agents')
      .select('user_id, total_pnl, status');

    const aggMap = new Map<
      string,
      { count: number; active: number; pnl: number }
    >();
    for (const a of agentAggs ?? []) {
      const existing = aggMap.get(a.user_id) ?? {
        count: 0,
        active: 0,
        pnl: 0,
      };
      existing.count++;
      if (a.status === 'active') existing.active++;
      existing.pnl += Number(a.total_pnl);
      aggMap.set(a.user_id, existing);
    }

    const enriched = (users ?? []).map((u) => ({
      ...u,
      agents_count: aggMap.get(u.id)?.count ?? 0,
      active_agents: aggMap.get(u.id)?.active ?? 0,
      total_pnl: aggMap.get(u.id)?.pnl ?? 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
