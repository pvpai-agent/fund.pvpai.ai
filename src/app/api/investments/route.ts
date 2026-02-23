import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getUserInvestments } from '@/services/investment.service';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const investments = await getUserInvestments(user.id);

    return NextResponse.json({ success: true, data: investments });
  } catch (error) {
    console.error('Investments fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch investments' }, { status: 500 });
  }
}
