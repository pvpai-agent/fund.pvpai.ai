import { NextRequest, NextResponse } from 'next/server';
import { settleClosedPositions } from '@/services/settlement.service';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }
    const secretParam = req.nextUrl.searchParams.get('secret');
    if (authHeader !== `Bearer ${cronSecret}` && secretParam !== cronSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await settleClosedPositions();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Settle cron error:', error);
    return NextResponse.json({ success: false, error: 'Settlement failed' }, { status: 500 });
  }
}
