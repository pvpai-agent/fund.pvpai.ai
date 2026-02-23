import { NextRequest, NextResponse } from 'next/server';
import { getAgentById } from '@/services/agent.service';
import { getEnergyLogs, estimateLifespan } from '@/services/metabolism.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    let logs: Awaited<ReturnType<typeof getEnergyLogs>> = [];
    try {
      logs = await getEnergyLogs(id, 50);
    } catch {
      // Mock agents may not have energy logs
    }
    const lifespanHours = estimateLifespan(Number(agent.energy_balance), Number(agent.burn_rate_per_hour));

    return NextResponse.json({
      success: true,
      data: {
        energy_balance: Number(agent.energy_balance),
        burn_rate_per_hour: Number(agent.burn_rate_per_hour),
        estimated_lifespan_hours: lifespanHours,
        is_critical: lifespanHours < 24,
        is_dead: agent.status === 'dead',
        died_at: agent.died_at,
        logs,
      },
    });
  } catch (error) {
    console.error('Energy fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch energy data' }, { status: 500 });
  }
}
