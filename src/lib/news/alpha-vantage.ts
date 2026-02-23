const API_KEY = process.env.ALPHA_VANTAGE_API_KEY ?? '';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedHeadlines: string[] = [];
let lastFetchedAt = 0;

/**
 * Fetch NVDA-related news from Alpha Vantage News Sentiment API.
 * Free tier: 25 requests/day — 5-min cache keeps usage well within limits.
 */
export async function fetchNvidiaNews(): Promise<string[]> {
  // Return cache if fresh
  if (Date.now() - lastFetchedAt < CACHE_TTL_MS && cachedHeadlines.length > 0) {
    return cachedHeadlines;
  }

  if (!API_KEY) {
    console.warn('[NEWS] ALPHA_VANTAGE_API_KEY not set, skipping news fetch');
    return [];
  }

  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=NVDA&limit=10&apikey=${API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!res.ok) {
      console.error(`[NEWS] Alpha Vantage returned ${res.status}`);
      return cachedHeadlines;
    }

    const data = await res.json();

    if (data.Information) {
      console.warn('[NEWS] Alpha Vantage rate limit:', data.Information);
      return cachedHeadlines;
    }

    const feed = data.feed as Array<{ title: string; summary: string; overall_sentiment_label: string }> | undefined;
    if (!feed || !Array.isArray(feed)) {
      return cachedHeadlines;
    }

    cachedHeadlines = feed.map((item) => item.title).slice(0, 10);
    lastFetchedAt = Date.now();

    console.log(`[NEWS] Fetched ${cachedHeadlines.length} NVDA headlines`);
    return cachedHeadlines;
  } catch (err) {
    console.error('[NEWS] Failed to fetch news:', err instanceof Error ? err.message : err);
    return cachedHeadlines;
  }
}
