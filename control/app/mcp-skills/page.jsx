/**
 * /mcp-skills — connected services index, worn inside the workshop shell.
 * The auth flag enters server-side (as on /library) and rides down to the
 * shell's strip; everything else lives in the client body.
 */

import ConnectedServicesBody from './services-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ConnectedServicesPage() {
  return <ConnectedServicesBody authEnabled={isAuthEnabled()} />;
}
