import { NextRequest, NextResponse } from 'next/server';
import { getAgentById } from '@/services/agent.service';
import { getUserByWallet, updateUserBalance } from '@/services/user.service';
import { recordTransaction } from '@/services/ledger.service';
import { requireAuth, rateLimit } from '@/lib/auth';
import { createServerClient, isSupabaseConfigured } from '@/lib/supabase/server';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Only the creator can claim fees' }, { status: 403 });
    }

    const claimable = Number(agent.creator_earnings);
    if (claimable <= 0) {
      return NextResponse.json({ success: false, error: 'No earnings to claim' }, { status: 400 });
    }

    // Transfer earnings to creator's balance
    const balanceBefore = Number(user.balance_usdt);
    await updateUserBalance(user.id, claimable);

    // Reset creator_earnings on agent
    if (isSupabaseConfigured()) {
      const supabase = createServerClient();
      await supabase
        .from('agents')
        .update({ creator_earnings: 0, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    await recordTransaction({
      userId: user.id,
      agentId: id,
      type: 'creator_claim',
      amount: claimable,
      description: `Creator fee claim: +$${claimable.toFixed(2)} from ${agent.name}`,
      balanceBefore,
      balanceAfter: balanceBefore + claimable,
    });

    return NextResponse.json({
      success: true,
      data: { claimed: claimable, newBalance: balanceBefore + claimable },
    });
  } catch (error) {
    console.error('Claim error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process claim' }, { status: 500 });
  }
}
