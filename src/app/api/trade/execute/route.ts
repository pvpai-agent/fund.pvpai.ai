import { NextRequest, NextResponse } from 'next/server';
import { openTrade } from '@/services/trade.service';
import { getAgentById } from '@/services/agent.service';
import { getUserByWallet } from '@/services/user.service';
import { requireAuth } from '@/lib/auth';
import { TRADING, METABOLISM } from '@/constants/trading';

// Accepts both cron auth (Bearer token) and user session auth (cookie)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

  // If not cron auth, try user session auth
  let authenticatedUserId: string | null = null;
  if (!isCronAuth) {
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    authenticatedUserId = user.id;
  }

  try {
    const { agentId, direction, triggerReason, triggerData } = await req.json();
    if (!agentId || !direction || !triggerReason) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (!['long', 'short'].includes(direction)) {
      return NextResponse.json({ success: false, error: 'Invalid direction' }, { status: 400 });
    }

    const agent = await getAgentById(agentId);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    if (authenticatedUserId && agent.user_id !== authenticatedUserId) {
      return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
    }
    if (agent.status !== 'active') return NextResponse.json({ success: false, error: 'Agent is not active' }, { status: 400 });

    if (Number(agent.energy_balance) < METABOLISM.MIN_ENERGY_TO_LIVE) {
      return NextResponse.json({ success: false, error: 'Insufficient energy for trade' }, { status: 400 });
    }

    const sizeUsd = Number(agent.capital_balance) * (agent.parsed_rules.risk_management.max_position_size_pct / 100);
    if (sizeUsd < TRADING.MIN_TRADE_SIZE_USD) {
      return NextResponse.json({ success: false, error: 'Insufficient capital' }, { status: 400 });
    }

    const trade = await openTrade({
      agentId, userId: agent.user_id, direction,
      sizeUsd: Math.min(sizeUsd, TRADING.MAX_TRADE_SIZE_USD),
      leverage: agent.parsed_rules.risk_management.max_leverage,
      triggerReason, triggerData,
    });
    return NextResponse.json({ success: true, data: trade }, { status: 201 });
  } catch (error) {
    console.error('Trade execution error:', error);
    return NextResponse.json({ success: false, error: 'Trade execution failed' }, { status: 500 });
  }
}
