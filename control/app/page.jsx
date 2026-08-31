import SplayedFloor from '@/components/floor/SplayedFloor';
import ViewportHome from '@/components/ViewportHome';
import { isAuthEnabled } from '@/lib/auth/session';

/**
 * The front door is the splayed floor — the library sorted 3D / 2D, per
 * components/3d-factory-ui.plan.md §10. `?ref=` keeps its meaning from the
 * viewport-home phase: any link into the workshop can still open the
 * outliner/viewport/inspector reading of one artifact, which is now the
 * bench's deep view rather than the landing surface.
 */
export default async function HomePage({ searchParams }) {
  const { ref } = await searchParams;
  const authEnabled = isAuthEnabled();
  return ref ? <ViewportHome authEnabled={authEnabled} /> : <SplayedFloor authEnabled={authEnabled} />;
}
