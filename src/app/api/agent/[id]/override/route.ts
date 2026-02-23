import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { updateOverrideStatus } from '@/services/chat.service';
import { mockUpdateAgent } from '@/lib/mock-db';
import type { ParsedRules } from '@/types/database';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { messageId, action } = await req.json();

    if (!messageId || !['confirm', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Only the creator can confirm overrides' }, { status: 403 });
    }

    const status = action === 'confirm' ? 'confirmed' as const : 'rejected' as const;
    const updated = await updateOverrideStatus(messageId, id, status);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Message not found' }, { status: 404 });
    }

    // If confirmed, apply the new rules to the agent
    if (action === 'confirm' && updated.override_data) {
      const newRules: ParsedRules = {
        ...updated.override_data,
        tier: agent.parsed_rules.tier, // preserve tier
      };
      mockUpdateAgent(id, { parsed_rules: newRules });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Override error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process override' }, { status: 500 });
  }
}
