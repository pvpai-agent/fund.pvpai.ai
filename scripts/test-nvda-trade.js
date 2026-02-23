const { Hyperliquid } = require('hyperliquid');

const HL_API = 'https://api.hyperliquid.xyz/info';

async function registerBuilderAssets(hl) {
  const dexRes = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'perpDexs' }),
  });
  const dexes = await dexRes.json();
  const assetMap = hl.symbolConversion?.assetToIndexMap;
  if (!assetMap) { console.log('No assetToIndexMap found'); return; }

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
    }
  }
  console.log('Registered builder assets, map size:', assetMap.size);
}

async function main() {
  const hl = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: false,
    walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  });
  await hl.connect();
  await registerBuilderAssets(hl);

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS;

  // Verify xyz:NVDA is in the map
  const idx = hl.symbolConversion?.assetToIndexMap?.get('xyz:NVDA');
  console.log('xyz:NVDA asset index:', idx);

  // Get NVDA price
  const res = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'xyz' }),
  });
  const data = await res.json();
  const meta = data[0];
  const ctxs = data[1];
  const nvdaIdx = meta.universe.findIndex(a => a.name === 'xyz:NVDA');
  const nvdaPrice = Number(ctxs[nvdaIdx].markPx);
  console.log('NVDA price: $' + nvdaPrice);

  // $10 test trade
  const sz = Math.floor((10 / nvdaPrice) * 1000) / 1000;
  console.log('Order: SHORT', sz, 'xyz:NVDA (~$10)');

  // Set leverage (xyz requires isolated)
  try {
    await hl.exchange.updateLeverage('xyz:NVDA', 'isolated', 3);
    console.log('Leverage: 3x isolated');
  } catch (e) {
    console.log('Leverage error:', e.message);
  }

  // Place order
  try {
    const result = await hl.exchange.placeOrder({
      coin: 'xyz:NVDA',
      is_buy: false,
      sz: sz,
      limit_px: 0,
      order_type: { limit: { tif: 'Ioc' } },
      reduce_only: false,
    });
    console.log('Order result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.log('Order error:', e.message);
    if (e.response) console.log('Response:', JSON.stringify(e.response));
  }

  // Check position
  const posRes = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: wallet, dex: 'xyz' }),
  });
  const posData = await posRes.json();
  console.log('XYZ account:', posData.marginSummary?.accountValue, 'USDC');
  const positions = (posData.assetPositions || []).filter(p => Number(p.position.szi) !== 0);
  if (positions.length === 0) console.log('No open positions');
  positions.forEach(p => {
    console.log('Position:', p.position.coin, 'size=' + p.position.szi, 'entry=' + p.position.entryPx);
  });

  // Check fills
  const fills = await hl.info.getUserFills(wallet);
  console.log('Recent fills:', fills.length);
  fills.slice(0, 3).forEach(f => {
    console.log('  Fill:', f.coin, f.side, 'sz=' + f.sz, 'px=' + f.px);
  });

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
