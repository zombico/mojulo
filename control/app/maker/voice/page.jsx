/**
 * /maker/voice — the Voice shelf (kind `voice-register`, voice-worker.plan.md).
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side the same way it does on `/` and
 * `/dashboard`; the tunable register cards live in voice-body.jsx.
 */

import MakerVoiceBody from './voice-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function MakerVoicePage() {
  return <MakerVoiceBody authEnabled={isAuthEnabled()} />;
}
