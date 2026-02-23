import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { withdrawInvestment } from '@/services/investment.service';
import { sendUsdcPayout, isPayoutConfigured } from '@/lib/web3/payout';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { investmentId } = await req.json();

    if (!investmentId) {
      return NextResponse.json({ success: false, error: 'Investment ID required' }, { status: 400 });
    }

    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const payOnChain = isPayoutConfigured();

    // First, do the investment withdrawal (skip internal balance credit if paying on-chain)
    const result = await withdrawInvestment(investmentId, user.id, {
      skipBalanceCredit: payOnChain,
    });

    // Send USDC on-chain to user's wallet on BSC (auto-bridges from HL if needed)
    let txHash: string | null = null;
    let payoutChain: string | null = null;
    if (payOnChain && result.netAmount > 0) {
      const payout = await sendUsdcPayout(user.wallet_address, result.netAmount);
      txHash = payout.txHash;
      payoutChain = payout.chain;
    }

    return NextResponse.json({
      success: true,
      data: {
        netAmount: result.netAmount,
        feeAmount: result.feeAmount,
        txHash,
        chain: payoutChain,
      },
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    const message = error instanceof Error ? error.message : 'Failed to withdraw';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
