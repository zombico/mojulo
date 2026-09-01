/**
 * /observability — MCP tool telemetry, worn inside the workshop shell (AuthNav
 * and the breadcrumb bar stand down here), so the auth flag enters server-side
 * the same way it does on `/` and `/dashboard`.
 */

import ObservabilityBody from './observability-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ObservabilityPage() {
  return <ObservabilityBody authEnabled={isAuthEnabled()} />;
}
