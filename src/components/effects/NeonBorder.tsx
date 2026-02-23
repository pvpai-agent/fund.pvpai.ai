'use client';

import { motion } from 'framer-motion';

interface NeonBorderProps { color?: 'green' | 'blue' | 'purple' | 'gold'; children: React.ReactNode; className?: string; animate?: boolean; }

const colorMap = {
  green: { border: 'border-cyber-green/50', shadow: '0 0 10px #00ff41, 0 0 20px #00ff41' },
  blue: { border: 'border-cyber-blue/50', shadow: '0 0 10px #00d4ff, 0 0 20px #00d4ff' },
  purple: { border: 'border-cyber-purple/50', shadow: '0 0 10px #bf00ff, 0 0 20px #bf00ff' },
  gold: { border: 'border-cyber-gold/50', shadow: '0 0 10px #ffd700, 0 0 20px #ffd700' },
};

export function NeonBorder({ color = 'green', children, className = '', animate = true }: NeonBorderProps) {
  const { border, shadow } = colorMap[color];
  if (animate) {
    return (
      <motion.div
        className={`border ${border} rounded-lg ${className}`}
        animate={{ boxShadow: [shadow, shadow.replace(/10px/g, '15px').replace(/20px/g, '30px'), shadow] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    );
  }
  return <div className={`border ${border} rounded-lg ${className}`} style={{ boxShadow: shadow }}>{children}</div>;
}
