'use client';

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useChat } from '@/hooks/useChat';
import { useT } from '@/hooks/useTranslation';

interface AgentChatProps {
  agentId: string;
  /** Optional slot rendered before the input field (e.g. tab toggle) */
  tabSlot?: ReactNode;
}

export function AgentChat({ agentId, tabSlot }: AgentChatProps) {
  const { messages, isSending, sendMessage } = useChat(agentId);
  const t = useT();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || isSending) return;
    setInput('');
    await sendMessage(msg);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 p-3 scrollbar-thin scrollbar-thumb-terminal-border">
        {messages.length === 0 && (
          <div className="text-center text-xs font-mono text-gray-600 py-8">
            {t.chatPanel.emptyState}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded px-3 py-2 text-xs font-mono ${
                msg.role === 'user'
                  ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
                  : 'bg-cyber-darker text-gray-300 border border-terminal-border'
              }`}
            >
              <div className="text-[10px] text-gray-600 mb-1">
                {msg.role === 'user'
                  ? `${msg.wallet_address.slice(0, 6)}...${msg.wallet_address.slice(-4)}`
                  : 'AGENT'}
              </div>
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area — no top border since parent handles the separator */}
      <div className="shrink-0 p-3 pt-2">
        <div className="flex items-center gap-2">
          {tabSlot}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={t.chatPanel.placeholder}
            maxLength={500}
            className="flex-1 bg-cyber-darker border border-terminal-border rounded px-3 py-2 font-mono text-xs text-gray-200 placeholder:text-gray-600 focus:border-cyber-blue/50 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={isSending || !input.trim()}
            className="px-3 py-2 bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30 rounded font-mono text-xs uppercase hover:bg-cyber-blue/20 disabled:opacity-30 transition-colors"
          >
            {isSending ? '...' : '>'}
          </button>
        </div>
      </div>
    </div>
  );
}
