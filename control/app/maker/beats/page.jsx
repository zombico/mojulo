'use client';

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
 */

import { useTranslations } from 'next-intl';
import SketchGallery from '@/components/SketchGallery';

export default function MakerBeatsPage() {
  const t = useTranslations('maker.beats');
  return <SketchGallery bucket="beats" heading={t('title')} subtitle={t('subtitle')} />;
}
