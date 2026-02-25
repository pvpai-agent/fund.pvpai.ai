import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserByWallet } from '@/services/user.service';
import { getAgentById } from '@/services/agent.service';
import { mockUpdateAgent, mockAddStrategyVersion } from '@/lib/mock-db';
import type { ParsedRules } from '@/types/database';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();

    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 });

    const user = await getUserByWallet(auth.wallet);
    if (!user || user.id !== agent.user_id) {
      return NextResponse.json({ success: false, error: 'Only the creator can edit strategy' }, { status: 403 });
    }

    // Full reconfigure: new prompt + fully parsed rules
    if (body.prompt && body.parsedRules) {
      const newRules: ParsedRules = {
        ...agent.parsed_rules,
        ...body.parsedRules,
        risk_management: {
          ...agent.parsed_rules.risk_management,
          ...(body.parsedRules.risk_management ?? {}),
        },
      };

      // Record version history before updating
      mockAddStrategyVersion(id, agent.prompt, agent.parsed_rules);

      const updated = mockUpdateAgent(id, {
        prompt: body.prompt,
        parsed_rules: newRules,
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // Partial update: individual fields
    const { direction_bias, keywords, risk_management } = body;
    const newRules = {
      ...agent.parsed_rules,
      ...(direction_bias && { direction_bias }),
      ...(keywords && { keywords }),
      ...(risk_management && {
        risk_management: {
          ...agent.parsed_rules.risk_management,
          ...risk_management,
        },
      }),
    };

    const updated = mockUpdateAgent(id, { parsed_rules: newRules });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Strategy update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update strategy' }, { status: 500 });
  }
}
