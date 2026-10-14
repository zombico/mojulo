/**
 * /play — every playable game, grouped by where it came from (play-body.jsx). It folds the Arcade (/arcade) and the
 * Game Developer gallery (/maker/games), which both redirect here; a project's own shelf stays at /games/<ref>.
 */

import PlayBody from './play-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function PlayPage() {
  return <PlayBody authEnabled={isAuthEnabled()} />;
}
