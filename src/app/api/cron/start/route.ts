import { NextRequest, NextResponse } from 'next/server';
import { checkAllActiveAgents } from '@/services/monitor.service';
import { settleClosedPositions } from '@/services/settlement.service';

/**
 * Dev-mode cron scheduler.
 * GET /api/cron/start — starts background polling loops.
 * Only works with valid CRON_SECRET auth.
 *
 * In production, use Vercel Cron (vercel.json) instead.
 */

const globalForCron = globalThis as unknown as {
  __cronRunning?: boolean;
  __monitorInterval?: ReturnType<typeof setInterval>;
  __settleInterval?: ReturnType<typeof setInterval>;
};

function getIsRunning() { return globalForCron.__cronRunning ?? false; }
function setIsRunning(v: boolean) { globalForCron.__cronRunning = v; }

// Aliases for backward compat within this file
function getMonitorInterval() { return globalForCron.__monitorInterval ?? null; }
function setMonitorInterval(v: ReturnType<typeof setInterval> | null) {
  if (v) globalForCron.__monitorInterval = v;
  else delete globalForCron.__monitorInterval;
}
function getSettleInterval() { return globalForCron.__settleInterval ?? null; }
function setSettleInterval(v: ReturnType<typeof setInterval> | null) {
  if (v) globalForCron.__settleInterval = v;
  else delete globalForCron.__settleInterval;
}

const MONITOR_INTERVAL_MS = 2 * 60 * 1000; // Every 2 minutes
const SETTLE_INTERVAL_MS = 5 * 60 * 1000;  // Every 5 minutes

async function runMonitor() {
  try {
    const result = await checkAllActiveAgents();
    console.log(
      `[CRON] Monitor: ${result.agentsChecked} agents | ` +
      `${result.tradesOpened} opened | ${result.tradesClosed} closed | ` +
      `${result.agentsDied} died | ` +
      `${result.errors.length} errors`
    );
    if (result.errors.length > 0) {
      console.warn('[CRON] Monitor errors:', result.errors);
    }
  } catch (err) {
    console.error('[CRON] Monitor failed:', err);
  }
}

async function runSettle() {
  try {
    const result = await settleClosedPositions();
    if (result.settled > 0 || result.errors.length > 0) {
      console.log(`[CRON] Settle: ${result.settled} trades settled | ${result.errors.length} errors`);
    }
  } catch (err) {
    console.error('[CRON] Settle failed:', err);
  }
}

function verifyCronAuth(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  // Support both: Authorization header or ?secret= query param
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const secretParam = req.nextUrl.searchParams.get('secret');
  if (secretParam === cronSecret) return true;

  return false;
}

export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
  }
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (getIsRunning()) {
    return NextResponse.json({
      success: true,
      message: 'Scheduler already running',
      intervals: { monitor: MONITOR_INTERVAL_MS, settle: SETTLE_INTERVAL_MS },
    });
  }

  setIsRunning(true);

  // Run immediately
  runMonitor();
  runSettle();

  // Start intervals
  setMonitorInterval(setInterval(runMonitor, MONITOR_INTERVAL_MS));
  setSettleInterval(setInterval(runSettle, SETTLE_INTERVAL_MS));

  console.log(`[CRON] Scheduler started — Monitor every ${MONITOR_INTERVAL_MS / 1000}s, Settle every ${SETTLE_INTERVAL_MS / 1000}s`);

  return NextResponse.json({
    success: true,
    message: 'Scheduler started',
    intervals: { monitor: MONITOR_INTERVAL_MS, settle: SETTLE_INTERVAL_MS },
  });
}

export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!verifyCronAuth(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const mi = getMonitorInterval();
  const si = getSettleInterval();
  if (mi) clearInterval(mi);
  if (si) clearInterval(si);
  setMonitorInterval(null);
  setSettleInterval(null);
  setIsRunning(false);

  console.log('[CRON] Scheduler stopped');
  return NextResponse.json({ success: true, message: 'Scheduler stopped' });
}
