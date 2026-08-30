import ViewportHome from '@/components/ViewportHome';
import { isAuthEnabled } from '@/lib/auth/session';

export default function HomePage() {
  return <ViewportHome authEnabled={isAuthEnabled()} />;
}
