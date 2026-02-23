import { getClaudeClient } from './client';
import { TradingStrategySchema, type TradingStrategy } from './schemas';

const SYSTEM_PROMPT = `You are an AI trading strategy parser for PVP AI, a platform that trades perpetual contracts on Hyperliquid.

Your job is to parse natural language trading strategies from users into structured JSON rules.

Available assets (use the exact symbol):
- US Stocks: xyz:NVDA, xyz:TSLA, xyz:AAPL, xyz:MSFT, xyz:AMZN, xyz:GOOGL, xyz:META, xyz:HOOD, xyz:MSTR, xyz:ORCL, xyz:AVGO, xyz:MU, xyz:CRCL, xyz:SPACEX, xyz:OPENAI
- ETFs: xyz:SPY, xyz:QQQ, xyz:GLD, xyz:SLV
- Crypto: BTC, ETH, SOL, XRP
- Forex: xyz:PEUR

Rules:
- Identify the best matching asset from the available list based on the user's description
- If the user mentions a stock like "NVDA" or "Nvidia", use "xyz:NVDA"
- If the user mentions crypto like "Bitcoin" or "BTC", use "BTC"
- If no specific asset is mentioned, default to "BTC"
- Maximum leverage is 10x
- Extract clear trigger conditions from the user's description
- If the user doesn't specify risk parameters, use sensible defaults:
  - stop_loss_pct: 5
  - take_profit_pct: 15
  - max_position_size_pct: 100
  - max_leverage: 3
  - max_daily_trades: 5
- Extract keywords from the strategy that should trigger trades
- Determine if the strategy is bullish (long), bearish (short), or both
- Create a memorable short name for the strategy
- Provide a one-sentence description`;

export async function parseStrategy(userPrompt: string): Promise<TradingStrategy> {
  const client = getClaudeClient();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Parse this trading strategy into structured JSON:\n\n"${userPrompt}"\n\nRespond with ONLY valid JSON matching this schema:\n{\n  "name": string,\n  "description": string,\n  "asset": string (use the exact symbol from the available assets list),\n  "direction_bias": "long" | "short" | "both",\n  "triggers": [{ "type": "keyword"|"price_level"|"time_based"|"momentum", "condition": string, "parameters": {} }],\n  "risk_management": { "max_position_size_pct": number, "stop_loss_pct": number, "take_profit_pct": number, "max_leverage": number, "max_daily_trades": number },\n  "keywords": string[]\n}`,
      },
    ],
  });

  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  let jsonStr = textContent.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to extract JSON object even if there's surrounding text
  const jsonObjMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonObjMatch) {
    jsonStr = jsonObjMatch[0];
  }

  const parsed = JSON.parse(jsonStr);
  return TradingStrategySchema.parse(parsed);
}
