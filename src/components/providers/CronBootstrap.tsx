'use client';

import { useEffect, useRef } from 'react';

/**
 * Auto-starts the dev-mode cron scheduler on first page load.
 * Silent — no UI, no errors shown to user.
 */
export function CronBootstrap() {
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    fetch('/api/cron/bootstrap')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) console.log('[CRON] Auto-bootstrap:', d.message);
      })
      .catch(() => {
        // Silent fail — cron can still be started manually
      });
  }, []);

  return null;
}
