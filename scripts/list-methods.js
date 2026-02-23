const { Hyperliquid } = require('hyperliquid');
const hl = new Hyperliquid({ testnet: false });
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(hl.exchange))
  .filter(m => m !== 'constructor');
console.log('Exchange methods:', methods.sort().join(', '));
