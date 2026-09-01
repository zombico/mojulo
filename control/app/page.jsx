import WorkshopHome from '@/components/WorkshopHome';
import { isAuthEnabled } from '@/lib/auth/session';

/**
 * The front door is a DIRECTORY. The splayed floor — the library laid out as the
 * landing surface — moved to `/dashboard`, taking `?ref=` (the viewport home's
 * single-artifact reading) with it. What stays here is one screen you read and
 * leave: every workshop door as a plate wearing its own dot-relief face,
 * grouped by mode, named and nothing else.
 *
 * The shell's top strip is also the app's nav here — AuthNav stands down at `/`
 * — so this is where the auth flag enters: the strip owns the sign-out.
 *
 * Design: components/3d-factory-ui.plan.md §7 (the brand system), rendered in
 * the wireframe register of the treatment sheet.
 */
export default function HomePage() {
  return <WorkshopHome authEnabled={isAuthEnabled()} />;
}
