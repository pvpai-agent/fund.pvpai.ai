import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { getMarkPrice, getCandleData } from '@/lib/hyperliquid/trading';
import { evaluateSignalWithAI } from '@/lib/claude/signal-evaluator';
import { getAgentAssets } from '@/types/database';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const user = await getUserByWallet(auth.wallet);
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

  const { id } = await params;
  const agent = await getAgentById(id);
  if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
  if (agent.user_id !== user.id) return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });

  try {
    // Fetch market data + candles for the agent's asset
    const agentAsset = getAgentAssets(agent.parsed_rules)[0];
    const [price, candles] = await Promise.all([
      getMarkPrice(agentAsset),
      getCandleData(agentAsset, '1h', 24),
    ]);

    // Run AI analysis — Claude uses web_search to autonomously find news
    const aiResult = await evaluateSignalWithAI(agent.parsed_rules, price, candles, agentAsset);

    // Last 6 candles for terminal display
    const recentCandles = candles.slice(-6).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    return NextResponse.json({
      success: true,
      data: {
        price,
        headlines: aiResult?.matchedHeadlines ?? [],
        candles: recentCandles,
        analysis: aiResult ? {
          shouldTrade: aiResult.shouldTrade,
          direction: aiResult.direction,
          confidence: aiResult.confidence,
          reason: aiResult.reason,
          matchedHeadlines: aiResult.matchedHeadlines,
          technicalSummary: aiResult.technicalSummary,
        } : {
          shouldTrade: false,
          direction: agent.parsed_rules.direction_bias === 'both' ? 'long' : agent.parsed_rules.direction_bias,
          confidence: 0,
          reason: 'No actionable signal found in current news.',
          matchedHeadlines: [],
          technicalSummary: '',
        },
      },
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json({ success: false, error: 'Analysis failed' }, { status: 500 });
  }
}
