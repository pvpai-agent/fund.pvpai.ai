import { NextRequest, NextResponse } from 'next/server';
import { settleClosedPositions } from '@/services/settlement.service';

// Server-to-server only
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await settleClosedPositions();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Settlement error:', error);
    return NextResponse.json({ success: false, error: 'Settlement failed' }, { status: 500 });
  }
}
