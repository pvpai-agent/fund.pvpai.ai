import { NextResponse } from 'next/server';

/**
 * Dev-mode cron bootstrap endpoint.
 * Called automatically by CronBootstrap client component on page load.
 * Triggers the main cron/start endpoint if not already running.
 */

const globalForCron = globalThis as unknown as { __cronRunning?: boolean };

export async function GET() {
  // Only auto-start in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, message: 'Production uses Vercel Cron' });
  }

  if (globalForCron.__cronRunning) {
    return NextResponse.json({ success: true, message: 'Cron already running' });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ success: false, message: 'CRON_SECRET not configured' });
  }

  try {
    // Call the existing cron/start endpoint internally
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/cron/start?secret=${encodeURIComponent(cronSecret)}`);
    const data = await res.json();

    if (data.success) {
      globalForCron.__cronRunning = true;
    }

    return NextResponse.json({ success: true, message: data.message ?? 'Cron bootstrapped' });
  } catch (error) {
    console.error('[CRON-BOOTSTRAP] Failed:', error);
    return NextResponse.json({ success: false, message: 'Bootstrap failed' }, { status: 500 });
  }
}
