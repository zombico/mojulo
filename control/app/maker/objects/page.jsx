'use client';

/**
 * /maker/objects — the Objects rail of Mojulo Maker: orbit-only 3D artifacts
 * and studies (workbench parts, assembler compositions, polygomers, vehicles,
 * planets, science/math views). Same gallery component as the other concerns,
 * filtered to the `object` bucket. An object is the same sketch primitive as a
 * world — both render through the three.js /world route; the bucket splits the
 * "turned and looked at" concern from worlds' "moved through" (the `walk` flag
 * in lib/graph/worlds/world-kinds.js). See components/SketchGallery.jsx.
 */

import { useTranslations } from 'next-intl';
import SketchGallery from '@/components/SketchGallery';

export default function MakerObjectsPage() {
  const t = useTranslations('maker.objects');
  return <SketchGallery bucket="object" heading={t('title')} subtitle={t('subtitle')} />;
}
