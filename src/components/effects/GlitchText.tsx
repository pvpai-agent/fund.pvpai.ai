'use client';

import { useState, useEffect } from 'react';

const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789';

interface GlitchTextProps { text: string; className?: string; glitchInterval?: number; }

export function GlitchText({ text, className = '', glitchInterval = 3000 }: GlitchTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isGlitching, setIsGlitching] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsGlitching(true);
      let iterations = 0;
      const glitchTimer = setInterval(() => {
        setDisplayText(
          text.split('').map((char, i) => {
            if (i < iterations) return text[i];
            if (char === ' ') return ' ';
            return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          }).join('')
        );
        iterations += 1;
        if (iterations > text.length) {
          clearInterval(glitchTimer);
          setDisplayText(text);
          setIsGlitching(false);
        }
      }, 30);
    }, glitchInterval);
    return () => clearInterval(interval);
  }, [text, glitchInterval]);

  return <span className={`${className} ${isGlitching ? 'text-cyber-blue' : ''}`}>{displayText}</span>;
}
