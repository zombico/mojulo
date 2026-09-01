/**
 * /mcp-skills/[ref] — connected-service detail, worn inside the workshop
 * shell. The auth flag enters server-side; the params promise rides down to
 * the client body, which unwraps it with `use()`.
 */

import ConnectedServiceDetailBody from './service-detail-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ConnectedServiceDetailPage({ params }) {
  return <ConnectedServiceDetailBody params={params} authEnabled={isAuthEnabled()} />;
}
