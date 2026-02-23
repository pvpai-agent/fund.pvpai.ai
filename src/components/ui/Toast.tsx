'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', isVisible, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed bottom-6 right-6 z-50"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
        >
          <div className={clsx(
            'px-4 py-3 rounded-lg border font-mono text-sm',
            type === 'success' && 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green',
            type === 'error' && 'bg-cyber-red/10 border-cyber-red/30 text-cyber-red',
            type === 'info' && 'bg-cyber-blue/10 border-cyber-blue/30 text-cyber-blue'
          )}>
            <div className="flex items-center gap-2">
              <span>{message}</span>
              <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">x</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
