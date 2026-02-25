import { NextRequest, NextResponse } from 'next/server';
import { getAgentById } from '@/services/agent.service';
import { getUserByWallet } from '@/services/user.service';
import { requireAuth, rateLimit } from '@/lib/auth';
import { METABOLISM } from '@/constants/trading';
import { mockUpdateUserPoints, mockLogEnergy, mockRecordTransaction } from '@/lib/mock-db';

/**
 * POST /api/agent/[id]/recharge-points
 * Burns PVPAI Points to add fuel to an agent.
 * Rate: 100 points = $1 USDC fuel
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { points } = await req.json();

    if (typeof points !== 'number' || points < 100) {
      return NextResponse.json({ success: false, error: 'Minimum 100 points required' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
    }

    if (agent.status === 'dead') {
      return NextResponse.json({ success: false, error: 'Cannot recharge a dead agent' }, { status: 400 });
    }

    // Check user has enough points
    if (user.pvpai_points < points) {
      return NextResponse.json({ success: false, error: 'Insufficient points' }, { status: 400 });
    }

    // Convert: 100 points = $1 USDC fuel
    const fuelUsd = points / 100;
    const pvpToAdd = fuelUsd * METABOLISM.PVP_PER_USD;

    // Deduct points from user
    mockUpdateUserPoints(user.id, -points);

    // Add fuel to agent
    const { agent: updatedAgent } = mockLogEnergy({
      agentId: id,
      amount: pvpToAdd,
      reason: 'manual_topup',
      description: `Points recharge: ${points} pts → $${fuelUsd.toFixed(2)} fuel`,
    });

    // Record transaction
    mockRecordTransaction({
      userId: user.id,
      agentId: id,
      type: 'energy_purchase',
      amount: fuelUsd,
      token: 'PVPAI_POINTS',
      description: `${points} points burned for ${pvpToAdd.toFixed(0)} PVP fuel`,
    });

    return NextResponse.json({
      success: true,
      data: {
        pointsDeducted: points,
        fuelUsdAdded: fuelUsd,
        pvpAdded: pvpToAdd,
        newEnergyBalance: updatedAgent.energy_balance,
        remainingPoints: user.pvpai_points - points,
      },
    });
  } catch (error) {
    console.error('Points recharge error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process points recharge' }, { status: 500 });
  }
}
