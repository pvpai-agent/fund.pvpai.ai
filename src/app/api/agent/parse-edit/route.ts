import { NextRequest, NextResponse } from 'next/server';
import { getClaudeClient } from '@/lib/claude/client';
import { requireAuth, rateLimit } from '@/lib/auth';

const SYSTEM_PROMPT = `You are an AI assistant that modifies trading strategy parameters based on user requests.

You will receive the current strategy parameters and a natural language edit request.
Return ONLY a JSON object with the updated fields. Only include fields that should change.

Available fields:
- direction_bias: "long" | "short" | "both"
- keywords: string[] (trading signal keywords)
- risk_management.max_leverage: number (1-10)
- risk_management.stop_loss_pct: number (1-50)
- risk_management.take_profit_pct: number (1-100)
- risk_management.max_position_size_pct: number (1-100)
- risk_management.max_daily_trades: number (1-20)

Rules:
- Only return fields the user wants to change
- Keep values within the valid ranges
- If the user says "long only" or "bullish", set direction_bias to "long"
- If the user says "short only" or "bearish", set direction_bias to "short"
- If the user says "both directions" or "flexible", set direction_bias to "both"
- Parse leverage like "5x" or "leverage 5" as max_leverage: 5
- Parse stop loss like "SL 3%" or "止损3" as stop_loss_pct: 3
- Parse take profit like "TP 20%" or "止盈20" as take_profit_pct: 20
- Return valid JSON only, no explanations`;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { currentStrategy, editPrompt } = await req.json();
    if (!editPrompt || typeof editPrompt !== 'string') {
      return NextResponse.json({ success: false, error: 'Edit prompt is required' }, { status: 400 });
    }
    if (editPrompt.length > 500) {
      return NextResponse.json({ success: false, error: 'Prompt too long (max 500 chars)' }, { status: 400 });
    }

    const client = getClaudeClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Current strategy:\n${JSON.stringify(currentStrategy, null, 2)}\n\nUser's edit request: "${editPrompt}"\n\nReturn ONLY the JSON with updated fields:`,
        },
      ],
    });

    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ success: false, error: 'No response from AI' }, { status: 500 });
    }

    let jsonStr = textContent.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) jsonStr = jsonObjMatch[0];

    const parsed = JSON.parse(jsonStr);
    return NextResponse.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Parse edit error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('credit balance') || msg.includes('billing')) {
      return NextResponse.json({ success: false, error: 'AI credit balance too low' }, { status: 402 });
    }
    if (msg.includes('JSON')) {
      return NextResponse.json({ success: false, error: 'AI returned invalid format. Please try rephrasing.' }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: `Failed to parse edit: ${msg}` }, { status: 500 });
  }
}
