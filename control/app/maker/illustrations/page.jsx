'use client';

/**
 * /maker/illustrations — the Illustrations rail of Mojulo Maker: landscapes,
 * figures, and complicated perspective / css3d / painterly renders. Same
 * gallery component as Drafts, filtered to the `illustration` bucket. An
 * illustration is the same sketch primitive as a diagram — only the bucket
 * differs. See components/SketchGallery.jsx.
 */

import { useTranslations } from 'next-intl';
import SketchGallery from '@/components/SketchGallery';

export default function MakerIllustrationsPage() {
  const t = useTranslations('maker.illustrations');
  return <SketchGallery bucket="illustration" heading={t('title')} subtitle={t('subtitle')} />;
}
