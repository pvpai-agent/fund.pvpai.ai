import { NextResponse } from 'next/server';
import { getLobbyEvents, getRecentAgents, getLeaderboard } from '@/services/lobby.service';

export async function GET() {
  try {
    const [events, newborns, leaderboardRoi] = await Promise.all([
      getLobbyEvents(30),
      getRecentAgents(30),
      getLeaderboard('roi', 20),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        events,
        newborns,
        leaderboard: leaderboardRoi,
      },
    });
  } catch (error) {
    console.error('Lobby fetch error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch lobby data' }, { status: 500 });
  }
}
