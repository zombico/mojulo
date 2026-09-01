/**
 * /research — the research-mode inbox, worn inside the workshop shell.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/library`.
 */

import ResearchBody from './research-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function ResearchPage() {
  return <ResearchBody authEnabled={isAuthEnabled()} />;
}
