import HomeLauncher from '@/components/HomeLauncher';
import { isAuthEnabled } from '@/lib/auth/session';

export default function HomePage() {
  return <HomeLauncher authEnabled={isAuthEnabled()} />;
}
