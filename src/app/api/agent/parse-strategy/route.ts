import { NextRequest, NextResponse } from 'next/server';
import { parseStrategy } from '@/lib/claude/strategy-parser';
import { requireAuth, rateLimit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Strict rate limit: costs money (Claude API)
  const limited = rateLimit(req, 5, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }
    if (prompt.length > 2000) {
      return NextResponse.json({ success: false, error: 'Prompt too long (max 2000 chars)' }, { status: 400 });
    }
    const parsedRules = await parseStrategy(prompt);
    return NextResponse.json({ success: true, data: { parsedRules } });
  } catch (error) {
    console.error('Strategy parse error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    // Surface specific error types to help debugging
    if (msg.includes('authentication') || msg.includes('api_key') || msg.includes('401')) {
      return NextResponse.json({ success: false, error: 'AI service authentication failed. Check ANTHROPIC_API_KEY.' }, { status: 500 });
    }
    if (msg.includes('credit balance') || msg.includes('billing')) {
      return NextResponse.json({ success: false, error: 'AI service credit balance too low. Please top up Anthropic API credits.' }, { status: 402 });
    }
    if (msg.includes('rate_limit') || msg.includes('429')) {
      return NextResponse.json({ success: false, error: 'AI rate limited. Please wait a moment and try again.' }, { status: 429 });
    }
    if (msg.includes('JSON')) {
      return NextResponse.json({ success: false, error: 'AI returned invalid format. Please try rephrasing your strategy.' }, { status: 500 });
    }
    return NextResponse.json({ success: false, error: `Failed to parse strategy: ${msg}` }, { status: 500 });
  }
}
