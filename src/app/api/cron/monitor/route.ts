import { NextRequest, NextResponse } from 'next/server';
import { checkAllActiveAgents } from '@/services/monitor.service';

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

    // Monitor now fetches its own news internally
    const result = await checkAllActiveAgents();
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Monitor cron error:', error);
    return NextResponse.json({ success: false, error: 'Monitor check failed' }, { status: 500 });
  }
}
