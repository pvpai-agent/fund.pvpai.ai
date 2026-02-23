import { bsc } from 'viem/chains';

export const SUPPORTED_CHAINS = [bsc] as const;

export const CHAIN_NAMES: Record<number, string> = {
  [bsc.id]: 'BNB Chain',
};

export const DEFAULT_CHAIN = bsc;
