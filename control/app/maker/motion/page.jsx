/**
 * /maker/motion — gallery of motion artifacts ("Motion Projects").
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the gallery itself lives in motion-body.jsx.
 */

import MotionGalleryBody from './motion-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function MotionGalleryPage() {
  return <MotionGalleryBody authEnabled={isAuthEnabled()} />;
}
