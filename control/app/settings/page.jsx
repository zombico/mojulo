/**
 * /settings — worn inside the workshop shell (AuthNav and the breadcrumb bar
 * stand down here), so the auth flag enters server-side the same way it does
 * on `/` and `/dashboard`.
 */

import SettingsBody from './settings-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function SettingsPage() {
  return <SettingsBody authEnabled={isAuthEnabled()} />;
}
