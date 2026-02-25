'use client';

import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';

interface NeonBorderProps { color?: 'green' | 'blue' | 'purple' | 'gold'; children: React.ReactNode; className?: string; animate?: boolean; }

const darkColorMap = {
  green: { border: 'border-cyber-green/50', shadow: '0 0 10px #00ff41, 0 0 20px #00ff41' },
  blue: { border: 'border-cyber-blue/50', shadow: '0 0 10px #00d4ff, 0 0 20px #00d4ff' },
  purple: { border: 'border-cyber-purple/50', shadow: '0 0 10px #bf00ff, 0 0 20px #bf00ff' },
  gold: { border: 'border-cyber-gold/50', shadow: '0 0 10px #ffd700, 0 0 20px #ffd700' },
};

const lightColorMap = {
  green: { border: 'border-cyber-green/40', shadow: '0 1px 4px rgba(0,122,51,0.15), 0 0 0 1px rgba(0,122,51,0.1)' },
  blue: { border: 'border-cyber-blue/40', shadow: '0 1px 4px rgba(0,109,143,0.15), 0 0 0 1px rgba(0,109,143,0.1)' },
  purple: { border: 'border-cyber-purple/40', shadow: '0 1px 4px rgba(122,0,168,0.15), 0 0 0 1px rgba(122,0,168,0.1)' },
  gold: { border: 'border-cyber-gold/40', shadow: '0 1px 4px rgba(138,109,0,0.15), 0 0 0 1px rgba(138,109,0,0.1)' },
};

export function NeonBorder({ color = 'green', children, className = '', animate = true }: NeonBorderProps) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const { border, shadow } = isLight ? lightColorMap[color] : darkColorMap[color];

  if (animate && !isLight) {
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
