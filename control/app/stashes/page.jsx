/**
 * /stashes — inbox of stashes, worn inside the workshop shell.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/library`.
 */

import StashesBody from './stashes-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function StashesIndexPage() {
  return <StashesBody authEnabled={isAuthEnabled()} />;
}
