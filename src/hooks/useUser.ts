'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useWalletStore } from '@/stores/wallet.store';
import type { User } from '@/types/database';

function buildSiweMessage(wallet: string, nonce: string): string {
  return [
    'Sign in to PVP AI Agent Lab',
    '',
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

export function useUser() {
  const { address, isConnected } = useAccount();
  const { user, isLoading, setUser, setLoading } = useWalletStore();
  const { signMessageAsync } = useSignMessage();
  const authInProgress = useRef(false);
  const sessionChecked = useRef(false);

  // Try restoring session from existing cookie (no signature needed)
  const checkSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return false;
      const data = await res.json();
      if (data.success && data.data?.user) {
        setUser(data.data.user as User);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [setUser]);

  // Full SIWE sign-in (only when no valid session exists)
  const authenticate = useCallback(async (walletAddress: string) => {
    if (authInProgress.current) return;
    authInProgress.current = true;
    setLoading(true);

    try {
      // 1. Get a nonce from server
      const nonceRes = await fetch('/api/auth/nonce');
      const { nonce } = await nonceRes.json();

      // 2. Sign the SIWE message
      const message = buildSiweMessage(walletAddress, nonce);
      const signature = await signMessageAsync({ message });

      // 3. Verify on server (sets httpOnly session cookie)
      const res = await fetch('/api/auth/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, signature, nonce }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data.user as User);
      } else {
        console.error('Auth failed:', data.error);
        setUser(null);
      }
    } catch (err) {
      // User rejected signature or network error
      console.error('Authentication failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
      authInProgress.current = false;
    }
  }, [setUser, setLoading, signMessageAsync]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    setUser(null);
    sessionChecked.current = false;
  }, [setUser]);

  useEffect(() => {
    if (isConnected && address && !user) {
      // First try restoring from session cookie, only sign if that fails
      if (!sessionChecked.current && !authInProgress.current) {
        sessionChecked.current = true;
        setLoading(true);
        checkSession().then((restored) => {
          if (!restored) {
            authenticate(address);
          } else {
            setLoading(false);
          }
        });
      }
    } else if (!isConnected) {
      logout();
    }
  }, [isConnected, address, user, authenticate, logout, checkSession, setLoading]);

  return {
    user,
    isLoading,
    isConnected,
    address,
    refetchUser: () => checkSession(),
  };
}
