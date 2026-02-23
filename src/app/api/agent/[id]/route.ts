import { NextRequest, NextResponse } from 'next/server';
import { getAgentById, updateAgentStatus } from '@/services/agent.service';
import { getUserByWallet } from '@/services/user.service';
import { requireAuth } from '@/lib/auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error('Agent fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch agent' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const existing = await getAgentById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    // Ownership check
    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== existing.user_id) {
      return NextResponse.json({ success: false, error: 'Not your agent' }, { status: 403 });
    }

    if (existing.status === 'dead') {
      return NextResponse.json({ success: false, error: 'Cannot modify a dead agent. Use resurrect.' }, { status: 400 });
    }

    const { status } = await req.json();
    if (!['active', 'paused', 'closed'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
    }
    const agent = await updateAgentStatus(id, status);
    return NextResponse.json({ success: true, data: agent });
  } catch (error) {
    console.error('Agent update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update agent' }, { status: 500 });
  }
}
