'use client';

/**
 * /library's client body. The `?shelf=` read needs useSearchParams (hence the
 * Suspense boundary), and the gallery mounts in shell mode: the workshop's
 * rounded frame with its top strip as the page's only nav — page.jsx resolves
 * the auth flag server-side and hands it down for the strip's sign-out.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import SketchGallery from '@/components/SketchGallery';
import { shelfByKey } from '@/lib/graph/sketch/library-shelves';

function Body({ authEnabled }) {
  const t = useTranslations('library');
  const params = useSearchParams();
  // shelfByKey falls back to `recent`, so a stale or hand-typed ?shelf= lands
  // somewhere real instead of on an empty page.
  const shelf = shelfByKey(params.get('shelf')).key;

  return (
    <SketchGallery
      shell
      authEnabled={authEnabled}
      shelves
      initialShelf={shelf}
      heading={t('title')}
      subtitle={t('subtitle')}
    />
  );
}

export default function LibraryBody({ authEnabled = false }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
      <Body authEnabled={authEnabled} />
    </Suspense>
  );
}
