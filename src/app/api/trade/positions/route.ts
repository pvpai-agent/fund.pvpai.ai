import { NextRequest, NextResponse } from 'next/server';
import { getPositions } from '@/lib/hyperliquid/trading';

// Server-to-server only
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const positions = await getPositions();
    return NextResponse.json({ success: true, data: positions });
  } catch (error) {
    console.error('Positions fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch positions' }, { status: 500 });
  }
}
