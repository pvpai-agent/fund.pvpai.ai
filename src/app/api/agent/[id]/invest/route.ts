import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, rateLimit } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { getTransactionByTxHash } from '@/services/ledger.service';
import { createInvestment } from '@/services/investment.service';
import { verifyOnChainPayment } from '@/lib/web3/payment';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { txHash, amount } = await req.json();

    if (!amount || amount < 10) {
      return NextResponse.json({ success: false, error: 'Minimum investment is $10' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    if (agent.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Agent is not active' }, { status: 400 });
    }

    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    // On-chain payment verification
    if (txHash) {
      const existingTx = await getTransactionByTxHash(txHash);
      if (existingTx) {
        return NextResponse.json({ success: false, error: 'Transaction already processed' }, { status: 400 });
      }

      const verification = await verifyOnChainPayment(txHash, amount, auth.wallet);
      if (!verification.verified) {
        return NextResponse.json({ success: false, error: 'Payment verification failed' }, { status: 400 });
      }
    }

    // Create investment — skip balance deduction when paid on-chain
    const investment = await createInvestment({
      userId: user.id,
      agentId: id,
      amount,
      txHash: txHash ?? undefined,
    });

    return NextResponse.json({ success: true, data: investment });
  } catch (error) {
    console.error('Investment error:', error);
    return NextResponse.json({ success: false, error: 'Failed to create investment' }, { status: 500 });
  }
}
