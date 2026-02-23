'use client';

import { useMemo } from 'react';
import type { Trade } from '@/types/database';

interface PerformanceChartProps {
  trades: Trade[];
  className?: string;
}

export function PerformanceChart({ trades, className = '' }: PerformanceChartProps) {
  const { points, minY, maxY, isPositive } = useMemo(() => {
    const sorted = [...trades]
      .filter((t) => t.realized_pnl != null)
      .sort((a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime());

    if (sorted.length === 0) {
      return { points: [], minY: 0, maxY: 0, isPositive: true };
    }

    let cumPnl = 0;
    const pts = [0];
    sorted.forEach((t) => {
      cumPnl += Number(t.realized_pnl ?? 0);
      pts.push(cumPnl);
    });

    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    return {
      points: pts,
      minY: min - range * 0.2,
      maxY: max + range * 0.2,
      isPositive: cumPnl >= 0,
    };
  }, [trades]);

  if (points.length < 2) {
    return <div className={`h-5 ${className}`} />;
  }

  const W = 80;
  const H = 20;

  const xScale = (i: number) => (i / (points.length - 1)) * W;
  const yScale = (y: number) => H - ((y - minY) / (maxY - minY)) * H;

  const linePath = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(y).toFixed(1)}`)
    .join('');

  const areaPath = `${linePath}L${W},${H}L0,${H}Z`;

  const stroke = isPositive ? '#00ff41' : '#ff3232';
  const fill = isPositive ? 'rgba(0,255,65,0.15)' : 'rgba(255,50,50,0.15)';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-5 ${className}`} preserveAspectRatio="none">
      <path d={areaPath} fill={fill} />
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
