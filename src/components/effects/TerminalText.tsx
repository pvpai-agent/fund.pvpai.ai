'use client';

import { useEffect, useRef } from 'react';

interface TerminalTextProps {
  lines: string[];
  speed?: number; // kept for API compat but no longer used for char-by-char
  className?: string;
  autoScroll?: boolean;
  maxLines?: number;
}

/** Color logic for terminal lines */
function getLineColor(line: string): string {
  if (line.includes('[DECISION]') || line.includes('[SIGNAL]')) return 'text-cyber-gold font-bold';
  if (line.includes('[REASON]')) return 'text-cyan-400';
  if (line.includes('[WEB SEARCH]') || line.includes('[NEWS]')) return 'text-cyber-gold/80';
  if (line.includes('[TECHNICAL]')) return 'text-fuchsia-400/80';
  if (line.includes('[TRIGGER]') || line.includes('[EXEC]')) return 'text-cyber-gold';
  if (line.includes('[PROFIT]')) return 'text-cyber-green font-bold';
  if (line.includes('[LOSS]') || line.includes('[ERROR]')) return 'text-cyber-red';
  if (line.includes('[AI')) return 'text-cyber-blue';
  if (line.includes('\u25B8')) return 'text-gray-300'; // bullet headlines
  if (line.includes('\u2501') || line.includes('\u2500')) return 'text-gray-600'; // separator lines
  if (line.includes('[SYSTEM]')) return 'text-gray-500';
  if (line.includes('[HEARTBEAT]') || line.includes('[STATUS]')) return 'text-gray-500';
  if (line.includes('[PRICE]')) return 'text-cyber-green/70';
  if (line.includes('[K-LINE]')) return 'text-gray-400';
  return 'text-cyber-green';
}

export function TerminalText({ lines, className = '', autoScroll = true, maxLines = 100 }: TerminalTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Auto-scroll on new lines
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    prevLengthRef.current = lines.length;
  }, [lines, autoScroll]);

  const visibleLines = lines.slice(-maxLines);

  return (
    <div ref={containerRef} className={`font-mono text-sm overflow-y-auto ${className}`}>
      {visibleLines.map((rawLine, i) => {
        const line = rawLine ?? '';
        const isNew = i >= prevLengthRef.current - (lines.length - visibleLines.length);
        return (
          <div
            key={`${lines.length}-${i}`}
            className={`flex ${isNew ? 'animate-[fadeIn_0.15s_ease-in]' : ''}`}
          >
            <span className="text-gray-700 mr-2 select-none text-[10px] leading-5">
              {String(i + 1).padStart(3, '0')}
            </span>
            <span className={`leading-5 ${getLineColor(line)}`}>{line}</span>
          </div>
        );
      })}
      <div className="flex">
        <span className="text-gray-700 mr-2 select-none text-[10px] leading-5">
          {String(visibleLines.length + 1).padStart(3, '0')}
        </span>
        <span className="text-cyber-green cursor-blink">_</span>
      </div>
    </div>
  );
}
