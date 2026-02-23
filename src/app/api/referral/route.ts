import { NextRequest, NextResponse } from 'next/server';
import { getUserByWallet, applyReferralCode } from '@/services/user.service';
import { requireAuth, rateLimit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { referralCode } = await req.json();
    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json({ success: false, error: 'Referral code is required' }, { status: 400 });
    }
    if (!/^[A-Za-z0-9]{4,12}$/.test(referralCode)) {
      return NextResponse.json({ success: false, error: 'Invalid referral code format' }, { status: 400 });
    }

    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    if (user.referred_by) return NextResponse.json({ success: false, error: 'Already has referrer' }, { status: 400 });

    await applyReferralCode(user.id, referralCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Referral error:', error);
    return NextResponse.json({ success: false, error: 'Failed to apply referral code' }, { status: 500 });
  }
}
