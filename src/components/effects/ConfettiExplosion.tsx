'use client';

import { useCallback, useEffect } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiExplosionProps { trigger: boolean; onComplete?: () => void; }

export function ConfettiExplosion({ trigger, onComplete }: ConfettiExplosionProps) {
  const fireConfetti = useCallback(() => {
    const colors = ['#ffd700', '#ffb300', '#ff8c00', '#00ff41', '#00d4ff'];
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors });
    const end = Date.now() + 3000;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
      else onComplete?.();
    };
    frame();
  }, [onComplete]);

  useEffect(() => { if (trigger) fireConfetti(); }, [trigger, fireConfetti]);
  return null;
}
