import { NextResponse } from 'next/server';
import { getAllDeadAgents } from '@/services/graveyard.service';

export async function GET() {
  try {
    const deadAgents = await getAllDeadAgents();

    // Strip sensitive data (prompt, parsed_rules) from public response
    const stripped = deadAgents.map((a) => ({
      id: a.id,
      name: a.name,
      avatar_seed: a.avatar_seed,
      status: a.status,
      total_trades: a.total_trades,
      total_pnl: a.total_pnl,
      win_rate: a.win_rate,
      created_at: a.created_at,
      died_at: a.died_at,
      allocated_funds: a.allocated_funds,
      tier: a.parsed_rules?.tier ?? 'scout',
    }));

    return NextResponse.json({ success: true, data: stripped });
  } catch (error) {
    console.error('Graveyard fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch graveyard' }, { status: 500 });
  }
}
