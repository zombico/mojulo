/**
 * /render-bay — one place to watch mojulo produce something.
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the three lanes live in render-bay-body.jsx.
 */

import RenderBayBody from './render-bay-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function RenderBayPage() {
  return <RenderBayBody authEnabled={isAuthEnabled()} />;
}
