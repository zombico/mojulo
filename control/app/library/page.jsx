/**
 * /library — the one asset browser.
 *
 * Folds in what used to be four routes (/sketches, /maker/illustrations,
 * /maker/worlds, /maker/objects), which were the same gallery with a different
 * `bucket` prop and made the operator pick a concern before they could look at
 * anything. The bucket is now a filter chip, never a fork. Those four routes
 * redirect here with their shelf preselected; `/sketches/<ref>` detail pages are
 * untouched.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`.
 *
 * Design: components/3d-factory-ui.plan.md §2.
 */

import LibraryBody from './library-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function LibraryPage() {
  return <LibraryBody authEnabled={isAuthEnabled()} />;
}
