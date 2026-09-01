/**
 * /arcade — Mojulo Arcade: the menu of playable standalone games.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the cabinets live in arcade-body.jsx.
 */

import ArcadeBody from './arcade-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ArcadePage() {
  return <ArcadeBody authEnabled={isAuthEnabled()} />;
}
