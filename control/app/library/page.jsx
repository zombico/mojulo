'use client';

/**
 * /library — the one asset browser.
 *
 * Folds in what used to be four routes (/sketches, /maker/illustrations,
 * /maker/worlds, /maker/objects), which were the same gallery with a different
 * `bucket` prop and made the operator pick a concern before they could look at
 * anything. The bucket is now a filter chip, never a fork. Those four routes
 * redirect here with their shelf preselected; `/sketches/<ref>` detail pages are
 * untouched.
 *
 * Design: components/3d-factory-ui.plan.md §2.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import SketchGallery from '@/components/SketchGallery';
import { shelfByKey } from '@/lib/graph/sketch/library-shelves';

function LibraryBody() {
  const t = useTranslations('library');
  const params = useSearchParams();
  // shelfByKey falls back to `recent`, so a stale or hand-typed ?shelf= lands
  // somewhere real instead of on an empty page.
  const shelf = shelfByKey(params.get('shelf')).key;

  return (
    <SketchGallery
      shelves
      initialShelf={shelf}
      heading={t('title')}
      subtitle={t('subtitle')}
    />
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
      <LibraryBody />
    </Suspense>
  );
}
