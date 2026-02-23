import { NextRequest, NextResponse } from 'next/server';
import { getTradesByAgent } from '@/services/trade.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const trades = await getTradesByAgent(id);
    return NextResponse.json({ success: true, data: trades });
  } catch {
    // Return empty trades array for mock/seed agents
    return NextResponse.json({ success: true, data: [] });
  }
}
