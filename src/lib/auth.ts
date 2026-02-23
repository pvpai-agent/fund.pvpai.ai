import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { verifyMessage } from 'viem';
import { isAddress, type Address } from 'viem';
import { NextRequest, NextResponse } from 'next/server';

const AUTH_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev-secret-change-me';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SIGNATURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/* ─── SIWE Message ─── */

export function buildSiweMessage(wallet: string, nonce: string): string {
  return [
    'Sign in to PVP AI Agent Lab',
    '',
    `Wallet: ${wallet}`,
    `Nonce: ${nonce}`,
  ].join('\n');
}

export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

// In-memory nonce store (TTL = SIGNATURE_WINDOW_MS)
// Attached to globalThis to survive HMR in dev mode
const globalForNonce = globalThis as unknown as { __nonceStore?: Map<string, number> };
if (!globalForNonce.__nonceStore) globalForNonce.__nonceStore = new Map();
const nonceStore = globalForNonce.__nonceStore; // nonce → createdAt

export function storeNonce(nonce: string): void {
  nonceStore.set(nonce, Date.now());
  // Cleanup expired nonces
  const cutoff = Date.now() - SIGNATURE_WINDOW_MS;
  for (const [k, v] of nonceStore) {
    if (v < cutoff) nonceStore.delete(k);
  }
}

export function consumeNonce(nonce: string): boolean {
  const createdAt = nonceStore.get(nonce);
  if (!createdAt) return false;
  if (Date.now() - createdAt > SIGNATURE_WINDOW_MS) {
    nonceStore.delete(nonce);
    return false;
  }
  nonceStore.delete(nonce);
  return true;
}

/* ─── Signature Verification ─── */

export async function verifyWalletSignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: string
): Promise<boolean> {
  try {
    const recovered = await verifyMessage({
      address: expectedAddress as Address,
      message,
      signature,
    });
    return recovered;
  } catch {
    return false;
  }
}

/* ─── Session Token (HMAC-signed cookie) ─── */

function hmacSign(data: string): string {
  return createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
}

export function createSessionToken(walletAddress: string): string {
  const expiry = Date.now() + SESSION_DURATION_MS;
  const payload = `${walletAddress.toLowerCase()}:${expiry}`;
  const sig = hmacSign(payload);
  return Buffer.from(`${payload}:${sig}`).toString('base64');
}

export function verifySessionToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;

    const [wallet, expiryStr, sig] = parts;
    const expiry = Number(expiryStr);
    if (Date.now() > expiry) return null;

    const payload = `${wallet}:${expiryStr}`;
    const expectedSig = hmacSign(payload);

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    return wallet!;
  } catch {
    return null;
  }
}

/* ─── Request Helpers ─── */

const COOKIE_NAME = 'pvpai_session';

export function getAuthenticatedWallet(req: NextRequest): string | null {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verifySessionToken(cookie.value);
}

export function setSessionCookie(res: NextResponse, walletAddress: string): void {
  const token = createSessionToken(walletAddress);
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

/* ─── Auth guard for API routes ─── */

export function requireAuth(req: NextRequest): { wallet: string } | NextResponse {
  const wallet = getAuthenticatedWallet(req);
  if (!wallet) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }
  return { wallet };
}

/* ─── Admin Auth Guard ─── */

export function requireAdmin(req: NextRequest): { wallet: string } | NextResponse {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { isAdminWallet } = require('./admin');
  if (!isAdminWallet(auth.wallet)) {
    return NextResponse.json(
      { success: false, error: 'Admin access required' },
      { status: 403 }
    );
  }
  return auth;
}

/* ─── Input Validation ─── */

export function isValidAddress(addr: unknown): addr is string {
  return typeof addr === 'string' && isAddress(addr);
}

/* ─── Rate Limiter (in-memory, per-IP) ─── */

const globalForRateLimit = globalThis as unknown as { __rateLimitStore?: Map<string, { count: number; resetAt: number }> };
if (!globalForRateLimit.__rateLimitStore) globalForRateLimit.__rateLimitStore = new Map();
const rateLimitStore = globalForRateLimit.__rateLimitStore;

export function rateLimit(
  req: NextRequest,
  maxRequests: number,
  windowMs: number
): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';
  const key = `${ip}:${req.nextUrl.pathname}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 }
    );
  }
  return null;

  // Cleanup old entries periodically (every 100 checks)
}

// Cleanup stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 60_000);
