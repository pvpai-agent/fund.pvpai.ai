'use client';

import { motion } from 'framer-motion';

interface MosaicOverlayProps { isLocked: boolean; message?: string; onUnlock?: () => void; }

export function MosaicOverlay({ isLocked, message = 'Share to unlock strategy details', onUnlock }: MosaicOverlayProps) {
  if (!isLocked) return null;
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-lg bg-cyber-dark/50 rounded-lg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="text-center p-6">
        <p className="text-cyber-blue font-mono text-sm mb-4">{message}</p>
        {onUnlock && (
          <button onClick={onUnlock} className="px-4 py-2 border border-cyber-gold text-cyber-gold font-mono text-xs uppercase tracking-wider hover:bg-cyber-gold/10 transition-colors">
            Share &amp; Unlock
          </button>
        )}
      </div>
    </motion.div>
  );
}
