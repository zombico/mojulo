'use client';

/**
 * /maker/worlds — the Worlds rail of Mojulo Maker: traversable three.js
 * cityscapes and transportation hubs (the box-world kinds). Same gallery
 * component as the other concerns, filtered to the `world` bucket. A world is
 * the same sketch primitive as a diagram or illustration — only the bucket
 * differs; it is the "moved through" concern (vs illustration's "looked at").
 * See components/SketchGallery.jsx (which previews world kinds via the baked PNG
 * and links to the live /world traversal).
 */

import { useTranslations } from 'next-intl';
import SketchGallery from '@/components/SketchGallery';

export default function MakerWorldsPage() {
  const t = useTranslations('maker.worlds');
  return <SketchGallery bucket="world" heading={t('title')} subtitle={t('subtitle')} />;
}
