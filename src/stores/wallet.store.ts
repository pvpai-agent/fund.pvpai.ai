import { create } from 'zustand';
import type { User } from '@/types/database';

interface WalletState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  updateBalance: (balance: number) => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  user: null,
  isLoading: false,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  updateBalance: (balance) =>
    set((state) => {
      if (!state.user) return state;
      return { user: { ...state.user, balance_usdt: balance } };
    }),
}));
