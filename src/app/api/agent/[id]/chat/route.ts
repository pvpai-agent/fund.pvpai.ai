import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { processChat, getChatHistory } from '@/services/chat.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const messages = await getChatHistory(id);
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch chat history' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { message } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ success: false, error: 'Message too long (max 500 chars)' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const isCreator = agent.user_id === user.id;

    const result = await processChat({
      agentId: id,
      userId: user.id,
      walletAddress: auth.wallet,
      message: message.trim(),
      isCreator,
      agent,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process chat' }, { status: 500 });
  }
}
