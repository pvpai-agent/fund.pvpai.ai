const ADMIN_WALLETS_RAW = process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? '';

export function getAdminWallets(): string[] {
  return ADMIN_WALLETS_RAW
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminWallet(address: string | undefined): boolean {
  if (!address) return false;
  return getAdminWallets().includes(address.toLowerCase());
}
