const { Hyperliquid } = require('hyperliquid');

async function main() {
  const hl = new Hyperliquid({ testnet: false });
  await hl.connect();

  const wallet = '0x3a118b4d9ea3617c7f8ced388806c90f1c26a015';

  // Check fills
  const fills = await hl.info.getUserFills(wallet);
  console.log('Total fills:', fills.length);
  fills.slice(0, 10).forEach(f => {
    console.log(`${f.coin} ${f.side} sz=${f.sz} px=${f.px} time=${new Date(f.time).toISOString()} closedPnl=${f.closedPnl}`);
  });

  // Check account value
  const state = await hl.info.perpetuals.getClearinghouseState(wallet);
  console.log('\nAccount value:', state.marginSummary?.accountValue);
  console.log('Total margin used:', state.marginSummary?.totalMarginUsed);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
