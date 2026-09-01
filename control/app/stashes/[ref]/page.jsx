/**
 * /stashes/[ref] — stash detail, worn inside the workshop shell.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/library`. The route param resolves server-side and travels down as
 * `stashRef` (`ref` is a reserved React prop name).
 */

import StashDetailBody from './stash-detail-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default async function StashDetailPage({ params }) {
  const { ref } = await params;
  return <StashDetailBody stashRef={ref} authEnabled={isAuthEnabled()} />;
}
