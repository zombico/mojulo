/**
 * /mcp-skills/[ref]/graph — the service's creation map, worn inside the
 * workshop shell. Auth flag resolved server-side; params promise handed to
 * the client body.
 */

import ConnectedServiceGraphBody from './service-graph-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ConnectedServiceGraphPage({ params }) {
  return <ConnectedServiceGraphBody params={params} authEnabled={isAuthEnabled()} />;
}
