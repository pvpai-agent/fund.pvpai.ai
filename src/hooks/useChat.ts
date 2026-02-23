'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ChatMessage } from '@/types/chat';

export function useChat(agentId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agent/${agentId}/chat`);
      const json = await res.json();
      if (json.success) {
        setMessages(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const sendMessage = useCallback(async (message: string) => {
    if (!agentId || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/agent/${agentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const json = await res.json();
      if (json.success) {
        setMessages((prev) => [...prev, json.data.userMsg, json.data.agentMsg]);
      } else {
        throw new Error(json.error);
      }
    } finally {
      setIsSending(false);
    }
  }, [agentId, isSending]);

  const confirmOverride = useCallback(async (messageId: string, action: 'confirm' | 'reject') => {
    const res = await fetch(`/api/agent/${agentId}/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, action }),
    });
    const json = await res.json();
    if (json.success) {
      // Update the message in state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, override_status: action === 'confirm' ? 'confirmed' : 'rejected' } : m
        )
      );
    }
    return json;
  }, [agentId]);

  return { messages, isLoading, isSending, sendMessage, confirmOverride, refetch: fetchHistory };
}
