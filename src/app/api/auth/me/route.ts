import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedWallet } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';

export async function GET(req: NextRequest) {
  const wallet = getAuthenticatedWallet(req);
  if (!wallet) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const user = await getUserByWallet(wallet);
  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: { user } });
}
