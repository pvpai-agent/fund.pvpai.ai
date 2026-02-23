const { Hyperliquid } = require('hyperliquid');

async function main() {
  const hl = new Hyperliquid({
    privateKey: process.env.HYPERLIQUID_PRIVATE_KEY,
    testnet: false,
    walletAddress: process.env.HYPERLIQUID_WALLET_ADDRESS,
  });
  await hl.connect();

  const wallet = process.env.HYPERLIQUID_WALLET_ADDRESS;

  // Check current balance
  const state = await hl.info.perpetuals.getClearinghouseState(wallet);
  console.log('Standard account value:', state.marginSummary.accountValue);

  // Transfer to xyz sub-account
  // The subAccountUser for xyz dex needs to be discovered
  // First let's try the vaultTransfer or subAccountTransfer approach
  console.log('Attempting to transfer 40 USDC to xyz dex...');

  try {
    const result = await hl.exchange.transferBetweenSubAccounts(
      'xyz',    // destination sub-account (dex name)
      true,     // isDeposit (into sub-account)
      40        // amount in USD
    );
    console.log('Transfer result:', JSON.stringify(result));
  } catch (err) {
    console.log('transferBetweenSubAccounts failed:', err.message);

    // Try alternative: usdClassTransfer
    try {
      const result2 = await hl.exchange.usdClassTransfer(40, true, 'xyz');
      console.log('usdClassTransfer result:', JSON.stringify(result2));
    } catch (err2) {
      console.log('usdClassTransfer failed:', err2.message);
      console.log('\nYou may need to transfer manually via app.hyperliquid.xyz');
      console.log('Go to: https://app.hyperliquid.xyz/trade/xyz:NVDA');
      console.log('Click "Transfer" and move USDC from Perps to xyz');
    }
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
