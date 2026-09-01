import SplayedFloor from '@/components/floor/SplayedFloor';
import ViewportHome from '@/components/ViewportHome';
import { isAuthEnabled } from '@/lib/auth/session';

/**
 * The dashboard is the splayed floor — the library sorted 3D / 2D, per
 * components/3d-factory-ui.plan.md §10. It was the front door until `/` became
 * the directory; the floor is what you open when you want to SEE the workshop
 * rather than navigate it, so it earns its own address instead of standing
 * between the operator and every other page.
 *
 * `?ref=` keeps its meaning from the viewport-home phase: any link into the
 * workshop can still open the outliner/viewport/inspector reading of one
 * artifact, which is the bench's deep view rather than the landing surface.
 *
 * (This route used to redirect to `/bots`. Everything that meant "take me to the
 * fleet" now says `/bots` directly; the nested `/dashboard/*` bot pages are
 * unchanged and still reached from there.)
 */
export default async function DashboardPage({ searchParams }) {
  const { ref } = await searchParams;
  // Both readings wear the workshop shell — the strip is the page's only nav
  // (AuthNav stands down on all of /dashboard), so the auth flag enters the
  // same way it does on `/`.
  const authEnabled = isAuthEnabled();
  return ref ? <ViewportHome authEnabled={authEnabled} /> : <SplayedFloor authEnabled={authEnabled} />;
}
