/* Server Component — fetches real data server-side, passes to client for i18n */

import { getRecentAgents } from '@/services/lobby.service';
import { getAllDeadAgents } from '@/services/graveyard.service';
import { LobbyContent } from '@/components/lobby/LobbyContent';

export default async function LobbyPage() {
  const [agents, deadAgents] = await Promise.all([
    getRecentAgents(50),
    getAllDeadAgents(),
  ]);

  return <LobbyContent agents={agents} deadAgents={deadAgents} />;
}
