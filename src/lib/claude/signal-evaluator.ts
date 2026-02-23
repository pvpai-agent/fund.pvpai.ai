import { getClaudeClient } from './client';
import type { ParsedRules } from '@/types/database';
import type { CandleData } from '@/lib/hyperliquid/trading';

export interface AISignalResult {
  shouldTrade: boolean;
  direction: 'long' | 'short';
  confidence: number;
  reason: string;
  matchedHeadlines: string[];
  technicalSummary: string;
}

/**
 * Determine how many web searches Claude is allowed based on the agent's data sources.
 * - No news sources → 0 (K-line only analysis)
 * - hot_news (free) → 2 searches (general news)
 * - twitter ($10/day) → 3 searches (+ social/X signals)
 * - pvpai_alpha ($30/day) → 5 searches (deep research)
 */
function getMaxSearches(dataSources?: string[]): number {
  if (!dataSources || dataSources.length === 0) return 2; // default: basic news
  let max = 0;
  if (dataSources.includes('hot_news')) max = 2;
  if (dataSources.includes('twitter')) max = Math.max(max, 3);
  if (dataSources.includes('pvpai_alpha')) max = Math.max(max, 5);
  return max;
}

function buildSearchInstructions(dataSources?: string[]): string {
  const sources = dataSources ?? ['hl_kline', 'hot_news'];
  const instructions: string[] = [];

  if (sources.includes('hot_news') || sources.includes('twitter') || sources.includes('pvpai_alpha')) {
    instructions.push('Use the web_search tool to find the LATEST news and developments about the asset and related keywords.');
    instructions.push('Focus on news from the last 24 hours that could impact price.');
  }

  if (sources.includes('twitter')) {
    instructions.push('Also search for recent tweets and social media sentiment from key opinion leaders (KOLs) on X/Twitter about this asset.');
  }

  if (sources.includes('pvpai_alpha')) {
    instructions.push('Conduct deep research: search for whale movements, institutional flows, options data, and upcoming catalysts.');
    instructions.push('Cross-reference multiple sources to validate signals before making a recommendation.');
  }

  if (instructions.length === 0) {
    return 'No web search available. Analyze based on the K-line candle data only.';
  }

  return instructions.join('\n');
}

const SYSTEM_PROMPT = `You are an AI trading analyst for PVP AI, an autonomous trading agent platform.

Your job: Analyze real-time market conditions and decide whether to open a trade RIGHT NOW based on a specific strategy.

Analysis process:
1. SEARCH the web for the latest news about the asset and keywords (if web search is available)
2. Examine the K-line candle data: trend direction, support/resistance levels, momentum, volume patterns
3. Cross-reference technical patterns with news sentiment
4. Only recommend trading when BOTH technical and fundamental signals align
5. A confidence score of 70+ means "trade now"
6. Be specific about which news events and candle patterns drove your decision
7. Consider the strategy's direction bias (long/short/both)

IMPORTANT: After completing your research and analysis, you MUST respond with a FINAL message containing ONLY valid JSON (no other text):
{
  "should_trade": boolean,
  "direction": "long" | "short",
  "confidence": number (0-100),
  "reason": string (one sentence explaining why),
  "matched_headlines": string[] (key news/events that influenced the decision),
  "technical_summary": string (brief technical analysis from candle data)
}`;

export async function evaluateSignalWithAI(
  rules: ParsedRules,
  price: number,
  candles?: CandleData[]
): Promise<AISignalResult | null> {
  if (!candles || candles.length === 0) return null;

  const client = getClaudeClient();
  const maxSearches = getMaxSearches(rules.data_sources);
  const searchInstructions = buildSearchInstructions(rules.data_sources);

  // Format candle data as a compact table
  const rows = candles.slice(-12).map((c) => {
    const time = new Date(c.time).toISOString().slice(11, 16);
    return `| ${time} | ${c.open.toFixed(2)} | ${c.high.toFixed(2)} | ${c.low.toFixed(2)} | ${c.close.toFixed(2)} | ${c.volume.toFixed(0)} |`;
  });
  const candleTable = `| Time | Open | High | Low | Close | Volume |
|------|------|------|-----|-------|--------|
${rows.join('\n')}`;

  const asset = (rules.asset ?? 'BTC').replace('xyz:', '');
  const userMessage = `## Strategy
- Name: ${rules.name ?? 'Agent'}
- Direction Bias: ${rules.direction_bias}
- Description: ${rules.description}
- Keywords of interest: ${rules.keywords.join(', ')}
- Asset: ${asset}

## Current Market
- ${asset} Price: $${price.toFixed(2)}

## K-Line Candles (1h, recent)
${candleTable}

## Data Source Instructions
${searchInstructions}

Based on this strategy and market data, search for the latest relevant news, then decide: should we trade now?`;

  // Build tools array — include web search if agent has news data sources
  const tools: Array<{ type: 'web_search_20250305'; name: 'web_search'; max_uses: number }> = [];
  if (maxSearches > 0) {
    tools.push({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: maxSearches,
    });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      ...(tools.length > 0 ? { tools } : {}),
    });

    // Find the last text block — this contains the JSON decision
    const textBlocks = response.content.filter((c) => c.type === 'text');
    const lastText = textBlocks[textBlocks.length - 1];
    if (!lastText || lastText.type !== 'text') return null;

    let jsonStr = lastText.text.trim();
    // Extract JSON from markdown code block if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    // Try to find JSON object in the text
    const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) jsonStr = jsonObjMatch[0];

    const parsed = JSON.parse(jsonStr);

    const result: AISignalResult = {
      shouldTrade: !!parsed.should_trade,
      direction: parsed.direction === 'long' ? 'long' : 'short',
      confidence: Number(parsed.confidence ?? 0),
      reason: String(parsed.reason ?? ''),
      matchedHeadlines: Array.isArray(parsed.matched_headlines) ? parsed.matched_headlines : [],
      technicalSummary: String(parsed.technical_summary ?? ''),
    };

    // Log search usage if available
    const usage = response.usage as unknown as Record<string, unknown>;
    if (usage?.server_tool_use) {
      console.log(`[AI] Web searches used: ${JSON.stringify(usage.server_tool_use)}`);
    }

    console.log(`[AI] Signal for ${rules.name}: trade=${result.shouldTrade} dir=${result.direction} conf=${result.confidence}% — ${result.reason}`);

    // Only trigger if confidence >= 70
    if (result.shouldTrade && result.confidence >= 70) {
      return result;
    }

    return null;
  } catch (err) {
    console.error('[AI] Signal evaluation failed:', err);
    return null;
  }
}
