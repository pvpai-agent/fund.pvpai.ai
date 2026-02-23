'use client';

export function triggerVibration(pattern: number | number[] = 200) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export function profitVibration() { triggerVibration([100, 50, 100, 50, 200]); }
export function clickVibration() { triggerVibration(50); }
export function errorVibration() { triggerVibration([200, 100, 200]); }
