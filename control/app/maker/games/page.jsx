/**
 * /maker/games — the GAME PROJECTS gallery (game-developer.plan.md GP3).
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the gallery itself lives in games-body.jsx.
 */

import GameProjectsBody from './games-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function GameProjectsPage() {
  return <GameProjectsBody authEnabled={isAuthEnabled()} />;
}
