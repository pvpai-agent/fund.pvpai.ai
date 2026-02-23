'use client';

import { useCallback } from 'react';
import confetti from 'canvas-confetti';
import { profitVibration } from '@/components/effects/VibrationFeedback';

export function useConfetti() {
  const fireGoldConfetti = useCallback(() => {
    const colors = ['#ffd700', '#ffb300', '#ff8c00', '#00ff41'];

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    // Delayed side bursts
    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors });
    }, 250);

    profitVibration();
  }, []);

  const fireSuccessConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.5 },
      colors: ['#00ff41', '#00d4ff', '#bf00ff'],
    });
  }, []);

  return { fireGoldConfetti, fireSuccessConfetti };
}
