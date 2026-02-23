import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, rateLimit } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { recordTransaction } from '@/services/ledger.service';
import { isSupabaseConfigured, createServerClient } from '@/lib/supabase/server';
import { mockUpdateAgent } from '@/lib/mock-db';
import { sendUsdcPayout, isPayoutConfigured } from '@/lib/web3/payout';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const amount = Number(body.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    }

    const user = await getUserByWallet(auth.wallet);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    if (user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Only the creator can withdraw capital' }, { status: 403 });
    }

    const currentCapital = Number(agent.capital_balance);
    if (amount > currentCapital) {
      return NextResponse.json({ success: false, error: `Insufficient capital: pool has $${currentCapital.toFixed(2)}` }, { status: 400 });
    }

    const newCapital = Math.max(0, currentCapital - amount);

    // Reduce agent capital
    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      await supabase
        .from('agents')
        .update({ capital_balance: newCapital, updated_at: new Date().toISOString() })
        .eq('id', id);
    } else {
      mockUpdateAgent(id, { capital_balance: newCapital });
    }

    // Send USDC on-chain to user's wallet on BSC (auto-bridges from HL if needed)
    let txHash: string | null = null;
    let payoutChain: string | null = null;
    if (isPayoutConfigured()) {
      const payout = await sendUsdcPayout(user.wallet_address, amount);
      txHash = payout.txHash;
      payoutChain = payout.chain;
    }

    await recordTransaction({
      userId: user.id,
      agentId: id,
      type: 'withdrawal',
      amount,
      txHash: txHash ?? undefined,
      chain: payoutChain ?? undefined,
      description: `Creator withdrew $${amount.toFixed(2)} capital from ${agent.name}${txHash ? ` (${payoutChain})` : ''}`,
    });

    return NextResponse.json({
      success: true,
      data: { withdrawn: amount, newCapital, txHash, chain: payoutChain },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Withdraw capital error:', message, error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
