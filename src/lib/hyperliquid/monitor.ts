import type { ParsedRules } from '@/types/database';
import { getMarkPrice } from './trading';

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface TradeSignal {
  direction: 'long' | 'short';
  reason: string;
  data: Record<string, unknown>;
}

export async function getCurrentMarketData(symbol: string): Promise<MarketData> {
  const price = await getMarkPrice(symbol);
  return { symbol, price, timestamp: Date.now() };
}

export function evaluateTriggers(
  rules: ParsedRules,
  marketData: MarketData,
  newsHeadlines?: string[]
): TradeSignal | null {
  if (newsHeadlines && rules.keywords.length > 0) {
    for (const headline of newsHeadlines) {
      const headlineLower = headline.toLowerCase();
      const matchedKeyword = rules.keywords.find((kw) =>
        headlineLower.includes(kw.toLowerCase())
      );
      if (matchedKeyword) {
        return {
          direction: rules.direction_bias === 'both' ? 'long' : rules.direction_bias,
          reason: `Keyword match: "${matchedKeyword}" in "${headline}"`,
          data: { headline, keyword: matchedKeyword, price: marketData.price },
        };
      }
    }
  }

  for (const trigger of rules.triggers) {
    if (trigger.type === 'price_level') {
      const params = trigger.parameters as { above?: number; below?: number };
      if (params.above && marketData.price > params.above) {
        return {
          direction: rules.direction_bias === 'both' ? 'long' : rules.direction_bias,
          reason: `Price above ${params.above}: current ${marketData.price}`,
          data: { trigger: 'price_level', threshold: params.above, price: marketData.price },
        };
      }
      if (params.below && marketData.price < params.below) {
        return {
          direction: rules.direction_bias === 'both' ? 'short' : rules.direction_bias,
          reason: `Price below ${params.below}: current ${marketData.price}`,
          data: { trigger: 'price_level', threshold: params.below, price: marketData.price },
        };
      }
    }
  }

  return null;
}
