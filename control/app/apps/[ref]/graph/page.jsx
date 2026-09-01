/**
 * /apps/[ref]/graph — the app's creation map, worn inside the workshop
 * shell. Auth flag resolved server-side; params promise handed to the
 * client body.
 */

import AppGraphBody from './app-graph-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function AppGraphPage({ params }) {
  return <AppGraphBody params={params} authEnabled={isAuthEnabled()} />;
}
