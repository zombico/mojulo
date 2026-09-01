/**
 * /outputs — inbox of materialized publications ("output artifacts").
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the inbox itself lives in outputs-body.jsx.
 */

import CooksIndexBody from './outputs-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function CooksIndexPage() {
  return <CooksIndexBody authEnabled={isAuthEnabled()} />;
}
