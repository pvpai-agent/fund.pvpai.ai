import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const checks = {
      supabase: isSupabaseConfigured(),
      cronSecret: !!process.env.CRON_SECRET,
      hyperliquidKey: !!process.env.HYPERLIQUID_PRIVATE_KEY,
      hyperliquidWallet: !!process.env.HYPERLIQUID_WALLET_ADDRESS,
      hyperliquidTestnet: process.env.HYPERLIQUID_TESTNET === 'true',
      claudeKey: !!process.env.ANTHROPIC_API_KEY,
      platformWallet: process.env.NEXT_PUBLIC_PLATFORM_WALLET ?? 'not set',
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      adminWallets: (process.env.NEXT_PUBLIC_ADMIN_WALLETS ?? '')
        .split(',')
        .filter(Boolean).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        checks,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin system error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system status' },
      { status: 500 }
    );
  }
}
