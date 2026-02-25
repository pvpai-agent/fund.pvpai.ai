import { mockAddChatMessage, mockGetChatMessages, mockUpdateChatOverrideStatus, mockGetAgentById } from '@/lib/mock-db';
import { getClaudeClient } from '@/lib/claude/client';
import type { ChatMessage, OverrideStatus } from '@/types/chat';
import type { Agent } from '@/types/database';

const CHAT_SYSTEM_PROMPT = `You are an AI trading agent running on PVP AI. You trade perpetual contracts on Hyperliquid (stocks, crypto, commodities, forex).

When chatting:
- Speak in character as the trading agent
- Reference your strategy rules, recent trades, and market conditions
- Be concise and use trading jargon
- Use a confident, slightly aggressive tone
- Anyone can chat with you — creators, investors, or curious visitors
- Share your market outlook, explain your recent trades, and discuss your strategy
- Never output JSON code blocks or propose strategy changes in chat`;

export async function processChat(input: {
  agentId: string;
  userId: string;
  walletAddress: string;
  message: string;
  isCreator: boolean;
  agent?: Agent;
}): Promise<{ userMsg: ChatMessage; agentMsg: ChatMessage }> {
  // Save user message
  const userMsg = mockAddChatMessage({
    agentId: input.agentId,
    userId: input.userId,
    walletAddress: input.walletAddress,
    role: 'user',
    content: input.message,
  });

  try {
    // Use passed agent or fall back to mock-db lookup
    const agent = input.agent ?? mockGetAgentById(input.agentId);
    if (!agent) throw new Error('Agent not found');

    // Get recent chat for context
    const recentMessages = mockGetChatMessages(input.agentId, 10);

    // Build Claude messages
    const contextBlock = buildAgentContext(agent);

    const messages = [
      ...recentMessages.slice(-8).map((m) => ({
        role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user' as const, content: input.message },
    ];
    const client = getClaudeClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `${CHAT_SYSTEM_PROMPT}\n\n${contextBlock}`,
      messages,
    });

    const textContent = response.content.find((c) => c.type === 'text');
    const reply = textContent && textContent.type === 'text' ? textContent.text : 'Signal lost. Reconnecting...';

    const agentMsg = mockAddChatMessage({
      agentId: input.agentId,
      userId: 'system',
      walletAddress: '',
      role: 'agent',
      content: reply,
    });

    return { userMsg, agentMsg };
  } catch {
    // Fallback response if Claude fails
    const agentMsg = mockAddChatMessage({
      agentId: input.agentId,
      userId: 'system',
      walletAddress: '',
      role: 'agent',
      content: 'Neural link unstable. Try again.',
    });

    return { userMsg, agentMsg };
  }
}

export async function getChatHistory(agentId: string, limit = 50): Promise<ChatMessage[]> {
  return mockGetChatMessages(agentId, limit);
}

export async function updateOverrideStatus(
  messageId: string,
  agentId: string,
  status: OverrideStatus
): Promise<ChatMessage | null> {
  return mockUpdateChatOverrideStatus(messageId, agentId, status);
}

function buildAgentContext(agent: Agent): string {
  const rules = agent.parsed_rules;
  const lines = [
    `AGENT: ${agent.name} (${agent.status})`,
  ];

  if (rules) {
    lines.push(
      `STRATEGY: ${rules.description ?? 'Unknown'}`,
      `DIRECTION: ${rules.direction_bias ?? 'neutral'}`,
      `ASSETS: ${(rules.assets ?? ['BTC']).map(a => a.replace('xyz:', '')).join(', ')}`,
      `KEYWORDS: ${(rules.keywords ?? []).join(', ')}`,
    );
    if (rules.risk_management) {
      lines.push(`RISK: SL ${rules.risk_management.stop_loss_pct}% / TP ${rules.risk_management.take_profit_pct}% / Max Lev ${rules.risk_management.max_leverage}x`);
    }
  }

  lines.push(
    `STATS: ${agent.total_trades} trades | P&L $${agent.total_pnl.toFixed(2)} | WR ${agent.win_rate.toFixed(0)}%`,
    `FUEL: ${agent.energy_balance.toFixed(0)} PVP | Capital: $${agent.capital_balance.toFixed(2)}`,
  );

  return lines.join('\n');
}

