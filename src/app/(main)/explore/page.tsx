/* Server Component — fetches agents for the explore/discover page */

import { getRecentAgents } from '@/services/lobby.service';
import { ExploreContent } from '@/components/explore/ExploreContent';

export default async function ExplorePage() {
  const agents = await getRecentAgents(100);

  return <ExploreContent agents={agents} />;
}
