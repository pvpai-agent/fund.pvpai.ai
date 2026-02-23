const { Hyperliquid } = require('hyperliquid');

async function main() {
  const hl = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: false,
    walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  });
  await hl.connect();

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS;
  const state = await hl.info.perpetuals.getClearinghouseState(wallet);
  const positions = state.assetPositions.filter(p => Number(p.position.szi) !== 0);

  console.log('Open positions:', positions.length);
  for (const p of positions) {
    const pos = p.position;
    console.log(`${pos.coin}: size=${pos.szi} entry=${pos.entryPx} pnl=${pos.unrealizedPnl}`);

    // Close it
    const size = Math.abs(Number(pos.szi));
    const isBuy = Number(pos.szi) < 0; // buy to close short
    console.log(`Closing ${pos.coin}: isBuy=${isBuy} sz=${size}`);

    const result = await hl.exchange.placeOrder({
      coin: pos.coin,
      is_buy: isBuy,
      sz: size,
      limit_px: 0,
      order_type: { limit: { tif: 'Ioc' } },
      reduce_only: true,
    });
    console.log('Close result:', JSON.stringify(result));
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
