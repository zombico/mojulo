/**
 * /graph — the app creation map, worn inside the workshop shell (AuthNav and
 * the breadcrumb bar stand down here), so the auth flag enters server-side the
 * same way it does on `/` and `/dashboard`.
 */

import GraphBody from './graph-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function GraphPage() {
  return <GraphBody authEnabled={isAuthEnabled()} />;
}
