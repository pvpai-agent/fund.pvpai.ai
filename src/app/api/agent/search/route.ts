import { NextRequest, NextResponse } from 'next/server';
import { getClaudeClient } from '@/lib/claude/client';
import { getRecentAgents } from '@/services/lobby.service';
import type { Agent } from '@/types/database';

function buildAgentSummary(agents: Agent[]): string {
  return agents
    .map((a) => {
      const rules = a.parsed_rules;
      const roi =
        a.allocated_funds > 0
          ? ((a.total_pnl / a.allocated_funds) * 100).toFixed(1)
          : '0.0';
      return [
        `ID:${a.id}`,
        `Name:${a.name}`,
        `Assets:${(rules?.assets ?? ['unknown']).join(',')}`,
        `Tier:${rules?.tier ?? 'scout'}`,
        `Bias:${rules?.direction_bias ?? 'both'}`,
        `ROI:${roi}%`,
        `PnL:$${a.total_pnl.toFixed(0)}`,
        `WinRate:${a.win_rate.toFixed(0)}%`,
        `TVL:$${a.capital_balance.toFixed(0)}`,
        `Keywords:${(rules?.keywords ?? []).join(',')}`,
        `Desc:${rules?.description ?? ''}`,
      ].join(' | ');
    })
    .join('\n');
}

const SYSTEM_PROMPT = `You are an AI agent recommendation assistant for the PVP AI platform — a competitive trading agent arena.

Given the user's natural language query and a list of available trading agents, recommend the most relevant agents.

Return ONLY a valid JSON object (no markdown, no code fences) with exactly two keys:
- "message": a short, helpful natural language recommendation (1-3 sentences). Write in the SAME LANGUAGE as the user's query.
- "agentIds": an array of recommended agent ID strings (maximum 6). Order by relevance.

Selection criteria to consider:
- Asset type (BTC, ETH, SOL, etc.)
- Direction bias (long / short / both)
- ROI and PnL performance
- Risk level and risk management parameters
- Tier (scout / sniper / predator)
- Keywords and description relevance

If no agents match the query well, return an empty agentIds array and suggest in "message" that the user create their own custom agent.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Fetch all active agents
    const agents = await getRecentAgents(100);

    if (agents.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message:
            'There are no active agents at the moment. Try creating your own!',
          agentIds: [],
        },
      });
    }

    const agentSummary = buildAgentSummary(agents);

    const claude = getClaudeClient();

    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `User query: "${query.trim()}"\n\nAvailable agents:\n${agentSummary}`,
        },
      ],
    });

    // Extract text from response
    const textBlock = response.content.find((b) => b.type === 'text');
    const rawText = textBlock && 'text' in textBlock ? textBlock.text : '';

    // Parse JSON from Claude's response
    const parsed = JSON.parse(rawText) as {
      message: string;
      agentIds: string[];
    };

    // Validate and clamp agentIds to max 6
    const agentIds = (Array.isArray(parsed.agentIds) ? parsed.agentIds : [])
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      data: {
        message: parsed.message || 'Here are some agents you might like.',
        agentIds,
      },
    });
  } catch (error) {
    console.error('Agent search error:', error);

    // Fallback: return a graceful response even if Claude fails
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search agents. Please try again later.',
      },
      { status: 500 }
    );
  }
}
