'use client';

import { useState, useEffect, useRef } from 'react';

interface TerminalTextProps {
  lines: string[];
  speed?: number;
  className?: string;
  autoScroll?: boolean;
  maxLines?: number;
}

export function TerminalText({ lines, speed = 50, className = '', autoScroll = true, maxLines = 100 }: TerminalTextProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentLineIndex >= lines.length) return;
    const currentLine = lines[currentLineIndex] ?? '';
    if (currentCharIndex < currentLine.length) {
      const timer = setTimeout(() => {
        setDisplayedLines((prev) => {
          const newLines = [...prev];
          newLines[currentLineIndex] = currentLine.slice(0, currentCharIndex + 1);
          return newLines.slice(-maxLines);
        });
        setCurrentCharIndex((prev) => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setCurrentLineIndex((prev) => prev + 1);
        setCurrentCharIndex(0);
      }, speed * 5);
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, currentCharIndex, lines, speed, maxLines]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, autoScroll]);

  return (
    <div ref={containerRef} className={`font-mono text-sm overflow-y-auto ${className}`}>
      {displayedLines.map((rawLine, i) => {
        const line = rawLine ?? '';
        return (
          <div key={i} className="flex">
            <span className="text-gray-600 mr-2 select-none">{String(i + 1).padStart(3, '0')}</span>
            <span className={
              line.includes('[TRIGGER]') || line.includes('[EXEC]') ? 'text-cyber-gold' :
              line.includes('[PROFIT]') ? 'text-cyber-green neon-glow' :
              line.includes('[LOSS]') || line.includes('[ERROR]') ? 'text-cyber-red' :
              'text-cyber-green'
            }>{line}</span>
          </div>
        );
      })}
      <div className="flex">
        <span className="text-gray-600 mr-2 select-none">{String(displayedLines.length + 1).padStart(3, '0')}</span>
        <span className="text-cyber-green cursor-blink">_</span>
      </div>
    </div>
  );
}
