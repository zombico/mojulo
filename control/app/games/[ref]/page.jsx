/**
 * /games/[ref] — the GAME DEVELOPER studio (game-developer.plan.md GP3). The
 * page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side and the ref resolves here; the
 * studio itself is the client body.
 */

import GameDeveloperBody from './studio-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default async function GameDeveloperPage({ params }) {
  const { ref } = await params;
  return <GameDeveloperBody projectRef={ref} authEnabled={isAuthEnabled()} />;
}
