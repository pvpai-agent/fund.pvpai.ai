import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, rateLimit } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { mockRecordTransaction, mockLogEnergy } from '@/lib/mock-db';
import { METABOLISM } from '@/constants/trading';

/**
 * POST /api/agent/[id]/promote
 * Purchase a promotion slot — pays USDC to boost agent in Explore page.
 * The promotion is recorded; fuel bonus is applied to the agent.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 5, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { txHash, amount, hours } = await req.json();

    if (!txHash || typeof txHash !== 'string') {
      return NextResponse.json({ success: false, error: 'Transaction hash required' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }
    if (typeof hours !== 'number' || hours < 1) {
      return NextResponse.json({ success: false, error: 'Minimum 1 hour promotion' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
    }

    if (agent.status === 'dead') {
      return NextResponse.json({ success: false, error: 'Cannot promote a dead agent' }, { status: 400 });
    }

    // Record the promotion payment
    mockRecordTransaction({
      userId: user.id,
      agentId: id,
      type: 'energy_purchase',
      amount,
      token: 'USDC',
      description: `Explore promotion: ${hours}h slot — tx: ${txHash.slice(0, 10)}...`,
    });

    // Bonus: 10% of promotion cost is converted to fuel
    const fuelBonus = amount * 0.1;
    const pvpBonus = fuelBonus * METABOLISM.PVP_PER_USD;
    mockLogEnergy({
      agentId: id,
      amount: pvpBonus,
      reason: 'manual_topup',
      description: `Promotion fuel bonus: $${fuelBonus.toFixed(2)} → ${pvpBonus.toFixed(0)} PVP`,
    });

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      data: {
        promotionId: `promo_${Date.now()}`,
        agentId: id,
        hours,
        amount,
        fuelBonusPvp: pvpBonus,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });
  } catch (error) {
    console.error('Promote error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process promotion' }, { status: 500 });
  }
}
