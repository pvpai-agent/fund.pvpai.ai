import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById, upgradeAgentTier } from '@/services/agent.service';
import { recordTransaction } from '@/services/ledger.service';
import { canUpgrade, getNextTier, getUpgradeCost } from '@/constants/upgrades';
import { mockUpdateUserBalance } from '@/lib/mock-db';
import type { AgentTier } from '@/constants/trading';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Only the creator can upgrade' }, { status: 403 });
    }

    const currentTier = (agent.parsed_rules.tier ?? 'scout') as AgentTier;
    if (!canUpgrade(currentTier)) {
      return NextResponse.json({ success: false, error: 'Already at max tier' }, { status: 400 });
    }

    const nextTier = getNextTier(currentTier);
    if (!nextTier) {
      return NextResponse.json({ success: false, error: 'No upgrade path available' }, { status: 400 });
    }

    const cost = getUpgradeCost(currentTier, nextTier);
    if (cost === null) {
      return NextResponse.json({ success: false, error: 'Invalid upgrade path' }, { status: 400 });
    }

    if (user.balance_usdt < cost) {
      return NextResponse.json({ success: false, error: `Insufficient balance. Need $${cost} USDC` }, { status: 400 });
    }

    // Deduct cost
    mockUpdateUserBalance(user.id, -cost);

    await recordTransaction({
      userId: user.id,
      agentId: id,
      type: 'upgrade_fee',
      amount: -cost,
      description: `Upgraded ${agent.name} from ${currentTier} to ${nextTier}`,
    });

    const upgraded = await upgradeAgentTier(id, nextTier);

    return NextResponse.json({ success: true, data: upgraded });
  } catch (error) {
    console.error('Upgrade error:', error);
    return NextResponse.json({ success: false, error: 'Failed to upgrade agent' }, { status: 500 });
  }
}
