/**
 * /data — fleet data explorer, worn inside the workshop shell (AuthNav and the
 * breadcrumb bar stand down here), so the auth flag enters server-side the
 * same way it does on `/` and `/dashboard`.
 */

import DataBody from './data-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function DataPage() {
  return <DataBody authEnabled={isAuthEnabled()} />;
}
