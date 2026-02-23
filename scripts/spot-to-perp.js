const { Hyperliquid } = require('hyperliquid');

async function main() {
  const hl = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: false,
    walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  });
  await hl.connect();

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS;

  // Check spot balance first
  const spotState = await hl.info.spot.getSpotClearinghouseState(wallet);
  const usdcBal = spotState.balances.find(b => b.coin === 'USDC');
  console.log('Spot USDC:', usdcBal ? usdcBal.total : '0');

  console.log('Transferring 40 USDC: Spot → Perps...');

  const result = await hl.exchange.transferBetweenSpotAndPerp(40, true);
  console.log('Transfer result:', JSON.stringify(result));

  // Verify perps balance
  const perpState = await hl.info.perpetuals.getClearinghouseState(wallet);
  console.log('Perps account value:', perpState.marginSummary.accountValue);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
