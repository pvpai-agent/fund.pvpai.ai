import { NextResponse } from 'next/server';
import { generateNonce, storeNonce } from '@/lib/auth';

export async function GET() {
  const nonce = generateNonce();
  storeNonce(nonce);
  return NextResponse.json({ nonce });
}
