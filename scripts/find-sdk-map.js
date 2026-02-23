const { Hyperliquid } = require('hyperliquid');

async function main() {
  const hl = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: false,
    walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  });
  await hl.connect();

  // Deep search for the asset map
  function findMaps(obj, path, depth) {
    if (depth > 4) return;
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      try {
        const val = obj[key];
        if (key === 'assetToIndexMap' || key === 'assetMap') {
          console.log(`Found ${key} at ${path}.${key}`);
          const entries = val instanceof Map ? [...val.entries()] : Object.entries(val);
          console.log('  Sample:', entries.slice(0, 3));
          console.log('  Size:', entries.length);
          // Check if we can add to it
          if (val instanceof Map) {
            val.set('xyz:NVDA', 110002);
            console.log('  Added xyz:NVDA → 110002');
            console.log('  Verify:', val.get('xyz:NVDA'));
          }
        }
        if (typeof val === 'object' && val !== null) {
          findMaps(val, `${path}.${key}`, depth + 1);
        }
      } catch (e) {}
    }
  }

  findMaps(hl, 'hl', 0);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
