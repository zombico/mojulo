/**
 * /beats/[ref] — the beats STUDIO (B9.2): the canonical home of one musical
 * artifact. The page wears the workshop shell (AuthNav and the breadcrumb bar
 * stand down here), so the auth flag enters server-side and the ref resolves
 * here; the studio itself is the client body.
 */

import BeatsStudioBody from './studio-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default async function BeatsStudioPage({ params }) {
  const { ref } = await params;
  return <BeatsStudioBody sketchRef={ref} authEnabled={isAuthEnabled()} />;
}
