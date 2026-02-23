import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getUserAgents } from '@/services/agent.service';
import { getUserByWallet, updateUserBalance } from '@/services/user.service';
import { recordTransaction } from '@/services/ledger.service';
import { calculatePvpFromUsd, getTierBurnRate } from '@/services/metabolism.service';
import { METABOLISM, AGENT_TIERS } from '@/constants/trading';
import type { AgentTier } from '@/constants/trading';
import { requireAuth, isValidAddress, rateLimit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 20, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { name, prompt, parsedRules, mintAmount, avatarSeed } = body;

    if (!name || !prompt || !parsedRules || !mintAmount || !avatarSeed) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof mintAmount !== 'number' || mintAmount < METABOLISM.MIN_MINT_USD) {
      return NextResponse.json({ success: false, error: `Minimum amount: $${METABOLISM.MIN_MINT_USD}` }, { status: 400 });
    }

    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    if (Number(user.balance_usdt) < mintAmount) {
      return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 });
    }

    const capitalUsd = mintAmount * (METABOLISM.CAPITAL_SPLIT_PCT / 100);
    const energyUsd = mintAmount * (METABOLISM.ENERGY_SPLIT_PCT / 100);
    const pvpPoints = calculatePvpFromUsd(energyUsd);
    const tier: AgentTier = parsedRules.tier ?? METABOLISM.DEFAULT_TIER;
    const burnRate = getTierBurnRate(tier);

    await updateUserBalance(user.id, -mintAmount);
    await recordTransaction({
      userId: user.id,
      type: 'agent_mint',
      amount: -mintAmount,
      description: `Agent minted from balance: $${capitalUsd.toFixed(2)} capital + $${(pvpPoints / 100).toFixed(2)} fuel (${AGENT_TIERS[tier].name})`,
    });

    const agent = await createAgent({
      userId: user.id,
      name,
      prompt,
      parsedRules,
      avatarSeed,
      allocatedFunds: capitalUsd,
      energyBalance: pvpPoints,
      capitalBalance: capitalUsd,
      burnRatePerHour: burnRate,
    });

    return NextResponse.json({ success: true, data: agent }, { status: 201 });
  } catch (error) {
    console.error('Agent creation error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create agent' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    const agents = await getUserAgents(user.id);
    return NextResponse.json({ success: true, data: agents });
  } catch (error) {
    console.error('Agent list error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch agents' }, { status: 500 });
  }
}
