import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const status = req.nextUrl.searchParams.get('status');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100');

  try {
    if (!isSupabaseConfigured()) {
      // Mock-db has no trades storage — return empty
      return NextResponse.json({
        success: true,
        data: [],
        meta: { note: 'Trade data requires Supabase. Mock-db returns empty.' },
      });
    }

    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = createServerClient();

    let query = supabase
      .from('trades')
      .select('*, agents!inner(name, user_id)')
      .order('opened_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const enriched = (data ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      agent_name:
        (t.agents as Record<string, string> | null)?.name ?? 'Unknown',
      agents: undefined,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Admin trades error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trades' },
      { status: 500 }
    );
  }
}
