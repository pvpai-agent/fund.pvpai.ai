import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, resurrectAgent } from '@/services/agent.service';
import { getUserByWallet, updateUserBalance } from '@/services/user.service';
import { calculatePvpFromUsd, getTierBurnRate } from '@/services/metabolism.service';
import { recordTransaction } from '@/services/ledger.service';
import { METABOLISM, AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { requireAuth, rateLimit } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { amount } = await req.json();

    if (typeof amount !== 'number') {
      return NextResponse.json({ success: false, error: 'Amount is required' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    if (agent.status !== 'dead') return NextResponse.json({ success: false, error: 'Agent is not dead' }, { status: 400 });

    // Ownership check
    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
    }

    if (amount < METABOLISM.MIN_MINT_USD) return NextResponse.json({ success: false, error: `Minimum: $${METABOLISM.MIN_MINT_USD}` }, { status: 400 });
    if (Number(user.balance_usdt) < amount) return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 });

    const capitalUsd = amount * (METABOLISM.CAPITAL_SPLIT_PCT / 100);
    const energyUsd = amount * (METABOLISM.ENERGY_SPLIT_PCT / 100);
    const pvpPoints = calculatePvpFromUsd(energyUsd);
    const tier: AgentTier = (agent.parsed_rules.tier as AgentTier) ?? METABOLISM.DEFAULT_TIER;
    const burnRate = getTierBurnRate(tier);

    await updateUserBalance(user.id, -amount);
    const resurrected = await resurrectAgent(id, pvpPoints, capitalUsd, burnRate);

    await recordTransaction({
      userId: user.id,
      agentId: id,
      type: 'agent_mint',
      amount: -amount,
      description: `Agent resurrected: $${capitalUsd.toFixed(2)} capital + $${(pvpPoints / 100).toFixed(2)} fuel (${AGENT_TIERS[tier].name})`,
    });

    return NextResponse.json({ success: true, data: resurrected });
  } catch (error) {
    console.error('Resurrect error:', error);
    return NextResponse.json({ success: false, error: 'Failed to resurrect agent' }, { status: 500 });
  }
}
