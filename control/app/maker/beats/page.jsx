/**
 * /maker/beats — the Beats shelf: browse-only gallery for the audio artifacts
 * (beats-ambient / beats-composition / beats-sfx, beats.plan.md). The audio
 * sibling of /maker/illustrations and /maker/worlds, mounted on the same shared
 * SketchGallery — selecting an artifact previews the live self-contained player
 * (/api/sketches/<ref>/beats).
 *
 * Deliberately a SHELF, not an editor: play, mute, browse. Authoring stays with
 * the operator's host agent via `create_beats` — the recipe is the only source
 * of truth (beats.plan.md → "Deliberately out").
 *
 * The page wears the workshop shell (AuthNav and the breadcrumb bar stand down
 * here), so the auth flag enters server-side, library-style.
 */

import MakerBeatsBody from './beats-body';
import { isAuthEnabled } from '@/lib/auth/session';

export default function MakerBeatsPage() {
  return <MakerBeatsBody authEnabled={isAuthEnabled()} />;
}
