import { NextRequest, NextResponse } from 'next/server';
import { findOrCreateUser } from '@/services/user.service';
import {
  verifyWalletSignature,
  consumeNonce,
  buildSiweMessage,
  setSessionCookie,
  isValidAddress,
  rateLimit,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  try {
    const { walletAddress, signature, nonce } = await req.json();

    if (!isValidAddress(walletAddress)) {
      return NextResponse.json({ success: false, error: 'Invalid wallet address' }, { status: 400 });
    }
    if (!signature || !nonce) {
      return NextResponse.json({ success: false, error: 'Signature and nonce required' }, { status: 400 });
    }

    // Verify nonce hasn't been used and isn't expired
    if (!consumeNonce(nonce)) {
      return NextResponse.json({ success: false, error: 'Invalid or expired nonce' }, { status: 401 });
    }

    // Verify the signature matches the wallet
    const message = buildSiweMessage(walletAddress, nonce);
    const valid = await verifyWalletSignature(message, signature as `0x${string}`, walletAddress);
    if (!valid) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    // Signature verified — create or find user
    const { user, isNew } = await findOrCreateUser(walletAddress);

    // Set session cookie
    const res = NextResponse.json({ success: true, data: { user, isNew } });
    setSessionCookie(res, walletAddress.toLowerCase());
    return res;
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
