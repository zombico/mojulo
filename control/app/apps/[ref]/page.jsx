/**
 * /apps/[ref] — app detail, worn inside the workshop shell. The auth flag
 * enters server-side; the params promise rides down to the client body,
 * which unwraps it with `use()`.
 */

import AppDetailBody from './app-detail-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function AppDetailPage({ params }) {
  return <AppDetailBody params={params} authEnabled={isAuthEnabled()} />;
}
