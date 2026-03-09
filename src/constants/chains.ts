import { bsc, monad } from 'viem/chains';

export const SUPPORTED_CHAINS = [bsc, monad] as const;

export const SUPPORTED_CHAIN_IDS = [bsc.id, monad.id] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export const CHAIN_NAMES: Record<number, string> = {
  [bsc.id]: 'BNB Chain',
  [monad.id]: 'Monad',
};

export const DEFAULT_CHAIN = bsc;
export const DEFAULT_CHAIN_ID = DEFAULT_CHAIN.id;

export const CHAIN_KEY_BY_ID: Record<number, string> = {
  [bsc.id]: 'bsc',
  [monad.id]: 'monad',
};

export function isSupportedChainId(chainId: number | null | undefined): chainId is SupportedChainId {
  return chainId === bsc.id || chainId === monad.id;
}

export function resolveSupportedChainId(chainId: number | null | undefined): SupportedChainId {
  return isSupportedChainId(chainId) ? chainId : DEFAULT_CHAIN_ID;
}

export function getChainName(chainId: number | null | undefined): string {
  if (!chainId) return CHAIN_NAMES[DEFAULT_CHAIN_ID];
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}
