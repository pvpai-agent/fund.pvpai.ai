import { NextRequest, NextResponse } from 'next/server';
import { processAgentMint } from '@/services/payment.service';
import { METABOLISM } from '@/constants/trading';
import { requireAuth, rateLimit } from '@/lib/auth';
import { DEFAULT_CHAIN_ID, isSupportedChainId } from '@/constants/chains';

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 10, 60_000);
  if (limited) return limited;

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { txHash, mintAmount, agentInput, chainId } = await req.json();

    if (!txHash || !mintAmount || !agentInput) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (typeof mintAmount !== 'number' || mintAmount < METABOLISM.MIN_MINT_USD) {
      return NextResponse.json({ success: false, error: `Minimum mint amount is $${METABOLISM.MIN_MINT_USD}` }, { status: 400 });
    }

    const activeChainId = typeof chainId === 'number' && isSupportedChainId(chainId)
      ? chainId
      : DEFAULT_CHAIN_ID;

    // Use wallet from session, not from client body
    const result = await processAgentMint(auth.wallet, txHash, mintAmount, agentInput, activeChainId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: { agentId: result.agentId } }, { status: 201 });
  } catch (error) {
    console.error('Payment verify error:', error);
    return NextResponse.json({ success: false, error: 'Payment processing failed' }, { status: 500 });
  }
}
