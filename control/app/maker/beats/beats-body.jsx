'use client';

/**
 * /maker/beats' client body. The gallery mounts in shell mode — the workshop's
 * rounded frame with its top strip as the page's only nav — while page.jsx
 * resolves the auth flag server-side and hands it down for the strip's
 * sign-out.
 */

import { useTranslations } from 'next-intl';
import SketchGallery from '@/components/SketchGallery';

export default function MakerBeatsBody({ authEnabled = false }) {
  const t = useTranslations('maker.beats');
  return (
    <SketchGallery
      bucket="beats"
      shell
      authEnabled={authEnabled}
      shellCrumb={t('title')}
      shellWidth={1400}
      heading={t('title')}
      subtitle={t('subtitle')}
    />
  );
}
