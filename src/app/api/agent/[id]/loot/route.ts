import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { lootAgent, LOOT_FEE_USDC } from '@/services/graveyard.service';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    if (user.balance_usdt < LOOT_FEE_USDC) {
      return NextResponse.json({
        success: false,
        error: `Insufficient balance. Loot costs $${LOOT_FEE_USDC} USDC`,
      }, { status: 400 });
    }

    const loot = await lootAgent(id, user.id);

    return NextResponse.json({ success: true, data: loot });
  } catch (error) {
    console.error('Loot error:', error);
    const message = error instanceof Error ? error.message : 'Failed to loot agent';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
