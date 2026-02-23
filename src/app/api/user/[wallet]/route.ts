import { NextRequest, NextResponse } from 'next/server';
import { getUserByWallet } from '@/services/user.service';
import { getUserAgents } from '@/services/agent.service';
import { getUserTransactions } from '@/services/ledger.service';
import { getUserTrades } from '@/services/trade.service';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { wallet } = await params;

    // Users can only fetch their own data
    if (wallet.toLowerCase() !== auth.wallet.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const user = await getUserByWallet(wallet);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
    const [agents, recentTransactions, recentTrades] = await Promise.all([
      getUserAgents(user.id),
      getUserTransactions(user.id, 10),
      getUserTrades(user.id, 10),
    ]);
    return NextResponse.json({ success: true, data: { user, agents, recentTransactions, recentTrades } });
  } catch (error) {
    console.error('User data fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}
