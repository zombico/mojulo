/**
 * /maker — Mojulo Maker studio hub.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the launcher itself lives in maker-body.jsx.
 */

import MakerHubBody from './maker-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function MakerHubPage() {
  return <MakerHubBody authEnabled={isAuthEnabled()} />;
}
