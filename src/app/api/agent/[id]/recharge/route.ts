import { NextRequest, NextResponse } from 'next/server';
import { getAgentById } from '@/services/agent.service';
import { getUserByWallet } from '@/services/user.service';
import { processRecharge } from '@/services/payment.service';
import { METABOLISM } from '@/constants/trading';
import { requireAuth, rateLimit } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { txHash, amount } = await req.json();

    if (!txHash || typeof amount !== 'number') {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (amount < METABOLISM.MIN_RECHARGE_USD) {
      return NextResponse.json({ success: false, error: `Minimum recharge: $${METABOLISM.MIN_RECHARGE_USD}` }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    // Ownership check
    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
    }

    if (agent.status === 'dead') return NextResponse.json({ success: false, error: 'Cannot recharge a dead agent' }, { status: 400 });

    const result = await processRecharge(auth.wallet, txHash, amount, id);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: { pvpAdded: result.pvpAdded, newBalance: result.newBalance },
    });
  } catch (error) {
    console.error('Recharge error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process recharge' }, { status: 500 });
  }
}
