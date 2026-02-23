'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useT } from '@/hooks/useTranslation';

const STORAGE_KEY = 'pvp_has_seen_how_it_works';

export function HowItWorksModal() {
  const [isOpen, setIsOpen] = useState(false);
  const t = useT();

  const CREATOR_PERKS = [
    {
      label: t.howItWorks.deploy,
      description: t.howItWorks.deployDesc,
    },
    {
      label: t.howItWorks.evolve,
      description: t.howItWorks.evolveDesc,
    },
    {
      label: t.howItWorks.collectRent,
      description: t.howItWorks.collectRentDesc,
    },
  ];

  const INVESTOR_PERKS = [
    {
      label: t.howItWorks.discover,
      description: t.howItWorks.discoverDesc,
    },
    {
      label: t.howItWorks.stake,
      description: t.howItWorks.stakeDesc,
    },
    {
      label: t.howItWorks.profit,
      description: t.howItWorks.profitDesc,
    },
  ];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setIsOpen(true);
    }

    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-how-it-works', handleOpen);
    return () => window.removeEventListener('open-how-it-works', handleOpen);
  }, []);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, '1');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <motion.div
            className="w-full max-w-3xl border border-cyber-green/30 bg-cyber-dark rounded-lg shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
              <div>
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-0.5">
                  {t.howItWorks.systemInit}
                </p>
                <h2 className="text-lg font-mono font-bold text-cyber-green uppercase tracking-wider">
                  {t.howItWorks.chooseYourPath}
                </h2>
              </div>
              <button
                onClick={handleDismiss}
                className="text-gray-500 hover:text-cyber-red transition-colors font-mono text-sm"
              >
                [X]
              </button>
            </div>

            {/* Intro */}
            <div className="px-6 pt-5 pb-2">
              <p className="text-xs font-mono text-gray-400 leading-relaxed max-w-xl">
                {t.howItWorks.intro}
              </p>
            </div>

            {/* Two paths */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-5">
              {/* Creator Path */}
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="border border-cyber-green/30 rounded-lg p-5 bg-cyber-green/[0.02] hover:bg-cyber-green/5 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg border border-cyber-green/40 bg-cyber-green/10 flex items-center justify-center">
                    <span className="text-lg font-mono font-bold text-cyber-green">+</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{t.howItWorks.path1}</p>
                    <h3 className="text-sm font-mono font-bold text-cyber-green uppercase tracking-wider">
                      {t.howItWorks.theAiCreator}
                    </h3>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-gray-500 mb-4 italic">
                  {t.howItWorks.creatorSubtitle}
                </p>
                <div className="space-y-3">
                  {CREATOR_PERKS.map((perk) => (
                    <div key={perk.label}>
                      <span className="text-xs font-mono font-bold text-cyber-green uppercase tracking-wider">
                        {perk.label}
                      </span>
                      <p className="text-[11px] font-mono text-gray-400 leading-relaxed mt-0.5">
                        {perk.description}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Investor Path */}
              <motion.div
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="border border-cyber-gold/30 rounded-lg p-5 bg-cyber-gold/[0.02] hover:bg-cyber-gold/5 transition-colors"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg border border-cyber-gold/40 bg-cyber-gold/10 flex items-center justify-center">
                    <span className="text-lg font-mono font-bold text-cyber-gold">$</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">{t.howItWorks.path2}</p>
                    <h3 className="text-sm font-mono font-bold text-cyber-gold uppercase tracking-wider">
                      {t.howItWorks.theAiInvestor}
                    </h3>
                  </div>
                </div>
                <p className="text-[10px] font-mono text-gray-500 mb-4 italic">
                  {t.howItWorks.investorSubtitle}
                </p>
                <div className="space-y-3">
                  {INVESTOR_PERKS.map((perk) => (
                    <div key={perk.label}>
                      <span className="text-xs font-mono font-bold text-cyber-gold uppercase tracking-wider">
                        {perk.label}
                      </span>
                      <p className="text-[11px] font-mono text-gray-400 leading-relaxed mt-0.5">
                        {perk.description}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* CTA */}
            <div className="px-6 pb-6">
              <button
                onClick={handleDismiss}
                className="w-full px-4 py-2.5 text-xs font-mono text-black bg-cyber-green rounded font-bold uppercase tracking-wider hover:bg-cyber-green/90 transition-colors"
              >
                {t.howItWorks.enterForest}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
