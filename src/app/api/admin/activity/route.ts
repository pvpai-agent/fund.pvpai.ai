import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { mockGetAnalysisLogs } from '@/lib/mock-db';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 100);
  const logs = mockGetAnalysisLogs(limit);

  return NextResponse.json({ success: true, data: logs });
}
