'use client';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  subtext,
  color = 'text-cyber-green',
  delay = 0,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card>
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {subtext && (
          <p className="text-xs font-mono text-gray-600 mt-2">{subtext}</p>
        )}
      </Card>
    </motion.div>
  );
}
