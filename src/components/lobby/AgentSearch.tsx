'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { Agent } from '@/types/database';
import { useT } from '@/hooks/useTranslation';

interface AgentSearchProps {
  agents: Agent[];
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agents?: Agent[];
}

function makeTicker(name: string): string {
  const words = name.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/);
  if (words.length === 1) return '$' + words[0].slice(0, 5).toUpperCase();
  return '$' + words.map(w => w[0]).join('').slice(0, 5).toUpperCase();
}

export function AgentSearch({ agents, onClose }: AgentSearchProps) {
  const t = useT();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: t.lobby.searchWelcome },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agentMapRef = useRef<Map<string, Agent>>(new Map());

  // Build agent lookup map
  useEffect(() => {
    const map = new Map<string, Agent>();
    agents.forEach(a => map.set(a.id, a));
    agentMapRef.current = map;
  }, [agents]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/agent/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        const { message, agentIds } = json.data as { message: string; agentIds: string[] };
        const matchedAgents = agentIds
          .map(id => agentMapRef.current.get(id))
          .filter((a): a is Agent => !!a);

        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: message,
          agents: matchedAgents.length > 0 ? matchedAgents : undefined,
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: t.lobby.searchNoResults,
        }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t.lobby.searchNoResults,
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, t.lobby.searchNoResults]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-cyber-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl mx-4 bg-cyber-dark border border-terminal-border rounded-lg shadow-2xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-cyber-green text-sm">{'>'}_</span>
            <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">AI Agent Search</span>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 font-mono text-xs">[X]</button>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${msg.role === 'user' ? '' : ''}`}>
                <div className={`rounded-lg px-3 py-2 text-xs font-mono ${
                  msg.role === 'user'
                    ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
                    : 'bg-cyber-darker text-gray-300 border border-terminal-border'
                }`}>
                  {msg.content}
                </div>
                {/* Agent recommendation cards */}
                {msg.agents && msg.agents.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {msg.agents.map((agent) => {
                      const roi = agent.allocated_funds > 0 ? ((agent.total_pnl / agent.allocated_funds) * 100) : 0;
                      const pnlSign = agent.total_pnl >= 0 ? '+' : '';
                      const asset = (agent.parsed_rules?.asset ?? 'BTC').replace('xyz:', '');
                      return (
                        <Link
                          key={agent.id}
                          href={`/agent/${agent.id}`}
                          onClick={onClose}
                          className="block bg-cyber-dark border border-terminal-border rounded-lg p-3 hover:border-cyber-green/40 transition-all group"
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-mono font-bold text-xs text-cyber-green group-hover:neon-glow truncate">{agent.name}</span>
                            <span className="text-[9px] font-mono text-gray-600">{makeTicker(agent.name)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-gray-500">{asset}</span>
                            <span className={roi >= 0 ? 'text-cyber-green' : 'text-cyber-red'}>{pnlSign}{roi.toFixed(1)}% ROI</span>
                            <span className="text-gray-500">{agent.win_rate.toFixed(0)}%W</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {/* No results → create CTA */}
                {msg.role === 'assistant' && msg.content === t.lobby.searchNoResults && (
                  <div className="mt-2 p-3 bg-cyber-darker border border-dashed border-terminal-border rounded-lg">
                    <p className="text-[10px] font-mono text-gray-500 mb-2">{t.lobby.searchCreateHint}</p>
                    <Link
                      href="/agent/new"
                      onClick={onClose}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded bg-cyber-green/15 border border-cyber-green/40 text-cyber-green hover:bg-cyber-green/25 transition-all"
                    >
                      {t.lobby.searchCreateBtn}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-cyber-darker border border-terminal-border rounded-lg px-3 py-2 text-xs font-mono text-gray-500">
                <span className="animate-pulse">{t.lobby.searchTyping}</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 p-3 border-t border-terminal-border">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t.lobby.searchPlaceholder}
              className="flex-1 bg-cyber-darker border border-terminal-border rounded px-3 py-2 font-mono text-xs text-gray-200 placeholder:text-gray-600 focus:border-cyber-green/50 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="px-3 py-2 bg-cyber-green/10 text-cyber-green border border-cyber-green/30 rounded font-mono text-xs uppercase hover:bg-cyber-green/20 disabled:opacity-30 transition-colors"
            >
              {'>'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
