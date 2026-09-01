/**
 * /apps — materialized apps index, worn inside the workshop shell. The auth
 * flag enters server-side (as on /library) and rides down to the shell's
 * strip; everything else lives in the client body.
 */

import AppsListBody from './apps-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function AppsListPage() {
  return <AppsListBody authEnabled={isAuthEnabled()} />;
}
