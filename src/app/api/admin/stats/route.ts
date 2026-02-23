import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  mockGetAllUsers,
  mockGetAllAgents,
  mockGetAllTransactions,
} from '@/lib/mock-db';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    if (!isSupabaseConfigured()) {
      const users = mockGetAllUsers();
      const agents = mockGetAllAgents();
      const txs = mockGetAllTransactions(10000, 0);

      const activeAgents = agents.filter((a) => a.status === 'active');
      const totalPnl = agents.reduce((s, a) => s + Number(a.total_pnl), 0);
      const totalAum = activeAgents.reduce(
        (s, a) => s + Number(a.capital_balance),
        0
      );
      const totalBurnRate = activeAgents.reduce(
        (s, a) => s + Number(a.burn_rate_per_hour),
        0
      );
      const deposits = txs
        .filter((t) => t.type === 'deposit')
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const perfFees = txs
        .filter((t) => t.type === 'performance_fee')
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const refFees = txs
        .filter((t) => t.type === 'referral_fee')
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

      return NextResponse.json({
        success: true,
        data: {
          totalUsers: users.length,
          totalAgents: agents.length,
          agentsByStatus: {
            active: agents.filter((a) => a.status === 'active').length,
            paused: agents.filter((a) => a.status === 'paused').length,
            dead: agents.filter((a) => a.status === 'dead').length,
            draft: agents.filter((a) => a.status === 'draft').length,
            closed: agents.filter((a) => a.status === 'closed').length,
          },
          totalTrades: agents.reduce((s, a) => s + a.total_trades, 0),
          totalPnl,
          totalDepositVolume: deposits,
          platformRevenue: perfFees + refFees,
          performanceFees: perfFees,
          referralFees: refFees,
          totalAum,
          totalFuel: activeAgents.reduce(
            (s, a) => s + Number(a.energy_balance),
            0
          ),
          activeBurnRatePerHour: totalBurnRate,
        },
      });
    }

    // Supabase aggregation
    const { createServerClient } = await import('@/lib/supabase/server');
    const supabase = createServerClient();

    const [usersRes, agentsRes, tradesRes, depositsRes, feesRes] =
      await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase
          .from('agents')
          .select(
            'status, capital_balance, energy_balance, burn_rate_per_hour, total_trades, total_pnl'
          ),
        supabase.from('trades').select('id', { count: 'exact', head: true }),
        supabase
          .from('transactions')
          .select('amount')
          .eq('type', 'deposit')
          .eq('status', 'confirmed'),
        supabase
          .from('transactions')
          .select('amount, type')
          .in('type', ['performance_fee', 'referral_fee']),
      ]);

    const agents = agentsRes.data ?? [];
    const statusCounts = { active: 0, paused: 0, dead: 0, draft: 0, closed: 0 };
    let totalAum = 0;
    let totalFuel = 0;
    let totalBurnRate = 0;
    let totalAgentTrades = 0;
    let totalPnl = 0;

    for (const a of agents) {
      const st = a.status as keyof typeof statusCounts;
      if (st in statusCounts) statusCounts[st]++;
      if (a.status === 'active') {
        totalAum += Number(a.capital_balance);
        totalFuel += Number(a.energy_balance);
        totalBurnRate += Number(a.burn_rate_per_hour);
      }
      totalAgentTrades += Number(a.total_trades);
      totalPnl += Number(a.total_pnl);
    }

    const deposits = (depositsRes.data ?? []).reduce(
      (s, t) => s + Math.abs(Number(t.amount)),
      0
    );
    const fees = feesRes.data ?? [];
    const perfFees = fees
      .filter((f) => f.type === 'performance_fee')
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const refFees = fees
      .filter((f) => f.type === 'referral_fee')
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: usersRes.count ?? 0,
        totalAgents: agents.length,
        agentsByStatus: statusCounts,
        totalTrades: tradesRes.count ?? totalAgentTrades,
        totalPnl,
        totalDepositVolume: deposits,
        platformRevenue: perfFees + refFees,
        performanceFees: perfFees,
        referralFees: refFees,
        totalAum,
        totalFuel,
        activeBurnRatePerHour: totalBurnRate,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
