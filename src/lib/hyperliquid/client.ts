import { Hyperliquid } from 'hyperliquid';

const HL_API = 'https://api.hyperliquid.xyz/info';

let hlClient: Hyperliquid | null = null;

/**
 * Register builder dex assets (e.g. xyz:NVDA) into the SDK's symbol map.
 * The SDK only loads standard perps by default.
 * Builder perps start at asset index 110000 + dexIndex * 10000.
 */
async function registerBuilderDexAssets(hl: Hyperliquid): Promise<void> {
  try {
    const dexRes = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'perpDexs' }),
    });
    const dexes = (await dexRes.json()) as Array<{ name: string } | null>;

    // Find the shared assetToIndexMap from the SDK internals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetMap: Map<string, number> | undefined = (hl as any).symbolConversion?.assetToIndexMap;
    if (!assetMap) {
      console.warn('[HL] Could not find assetToIndexMap — builder dex trading disabled');
      return;
    }

    let count = 0;
    for (let i = 1; i < dexes.length; i++) {
      const dex = dexes[i];
      if (!dex?.name) continue;

      const offset = 110000 + (i - 1) * 10000;
      const metaRes = await fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta', dex: dex.name }),
      });
      const meta = await metaRes.json();

      for (let j = 0; j < meta.universe.length; j++) {
        assetMap.set(meta.universe[j].name, offset + j);
        count++;
      }
    }
    console.log(`[HL] Registered ${count} builder dex assets`);
  } catch (err) {
    console.error('[HL] Failed to register builder dex assets:', err);
  }
}

export async function getHyperliquidClient(): Promise<Hyperliquid> {
  if (!hlClient) {
    hlClient = new Hyperliquid({
      privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
      testnet: process.env.HYPERLIQUID_TESTNET === 'true',
      walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
    });
    await hlClient.connect();

    // Trigger SDK lazy initialization — the internal assetToIndexMap stays
    // empty until the first exchange method is called.  We call updateLeverage
    // on a known standard perp to force the SDK to populate its maps before
    // we patch in builder-dex entries.
    try {
      await hlClient.exchange.updateLeverage('ETH-PERP', 'cross', 1);
    } catch {
      // Ignore — the side-effect (map init) is all we need
    }

    await registerBuilderDexAssets(hlClient);
  }
  return hlClient;
}
