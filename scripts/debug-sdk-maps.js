const { Hyperliquid } = require('hyperliquid');
const HL_API = 'https://api.hyperliquid.xyz/info';

async function main() {
  const hl = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: false,
    walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  });
  await hl.connect();

  // Trigger lazy init
  try { await hl.exchange.updateLeverage('ETH-PERP', 'cross', 1); } catch (e) {}

  // Register builder assets
  const dexRes = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'perpDexs' }) });
  const dexes = await dexRes.json();
  const assetMap = hl.symbolConversion.assetToIndexMap;
  for (let i = 1; i < dexes.length; i++) {
    const dex = dexes[i];
    if (!dex?.name) continue;
    const offset = 110000 + (i - 1) * 10000;
    const metaRes = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'meta', dex: dex.name }) });
    const meta = await metaRes.json();
    for (let j = 0; j < meta.universe.length; j++) assetMap.set(meta.universe[j].name, offset + j);
  }

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS;

  // Get NVDA mark price
  const ctxRes = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'xyz' }) });
  const ctxData = await ctxRes.json();
  const nvdaIdx = ctxData[0].universe.findIndex(a => a.name === 'xyz:NVDA');
  const markPx = Number(ctxData[1][nvdaIdx].markPx);
  console.log('NVDA mark: $' + markPx);

  // Set leverage
  await hl.exchange.updateLeverage('xyz:NVDA', 'isolated', 3);
  console.log('Leverage: 3x isolated');

  // $12 worth to clear the $10 minimum after slippage
  const sz = Math.floor((12 / markPx) * 1000) / 1000;
  const limitPrice = Math.round(markPx * 0.95 * 100) / 100;
  console.log(`Order: SHORT ${sz} xyz:NVDA @ limit $${limitPrice} (value ~$${(sz * markPx).toFixed(2)})`);

  const result = await hl.exchange.placeOrder({
    coin: 'xyz:NVDA',
    is_buy: false,
    sz: sz,
    limit_px: limitPrice,
    order_type: { limit: { tif: 'Ioc' } },
    reduce_only: false,
  });
  console.log('Result:', JSON.stringify(result, null, 2));

  // Check fills
  await new Promise(r => setTimeout(r, 2000));
  const fills = await hl.info.getUserFills(wallet);
  console.log('Fills:', fills.length);
  fills.slice(0, 3).forEach(f => console.log('  ', f.coin, f.side, 'sz=' + f.sz, 'px=' + f.px));

  // Check xyz position
  const posRes = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'clearinghouseState', user: wallet, dex: 'xyz' }) });
  const posData = await posRes.json();
  console.log('XYZ account:', posData.marginSummary?.accountValue);
  const positions = (posData.assetPositions || []).filter(p => Number(p.position.szi) !== 0);
  positions.forEach(p => console.log('POS:', p.position.coin, 'size=' + p.position.szi, 'entry=$' + p.position.entryPx));
  if (positions.length === 0) console.log('No positions');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
