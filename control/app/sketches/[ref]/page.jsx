'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';
import { sketchRenderMode } from '@/lib/graph/sketch-manifest';

function printFilename(data, fallbackRef) {
  if (typeof window === 'undefined') return 'sketch.pdf';
  const requested = new URLSearchParams(window.location.search).get('filename');
  const base = requested || [data?.title, data?.ref || fallbackRef]
    .filter(Boolean)
    .join(' ');
  const safe = base
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${safe || 'sketch'}.pdf`;
}

export default function SketchPage({ params }) {
  const { ref } = use(params);
  const t = useTranslations('sketches');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState('color');

  const load = useCallback(async () => {
    setError('');
    setNotFound(false);
    try {
      const res = await fetch(`/api/sketches/${encodeURIComponent(ref)}`);
      if (res.status === 404) {
        setNotFound(true);
        setData(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    setMode(search.get('mode') === 'wireframe' ? 'wireframe' : 'color');
  }, []);

  const manifest = data?.manifest;

  useEffect(() => {
    if (!manifest) return undefined;
    if (typeof window === 'undefined') return undefined;
    const search = new URLSearchParams(window.location.search);
    if (search.get('print') !== '1') return undefined;

    const originalTitle = document.title;
    document.title = printFilename(data, ref);
    const timer = window.setTimeout(() => window.print(), 250);
    return () => {
      window.clearTimeout(timer);
      document.title = originalTitle;
    };
  }, [data, manifest, ref]);

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">{t('notFoundTitle')}</h2>
          <p className="text-sm text-[color:var(--text-muted)]">{t('notFoundBody')}</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-sm text-red-400">{error}</p>
      </main>
    );
  }

  if (!manifest) {
    return <main className="min-h-screen" aria-hidden />;
  }

  // svg (rasterized <img>) | scene (live preserve-3d <iframe>) | diagram (CreationMap)
  // — centralized so scene/illustration kinds never fall through to <CreationMap>.
  const renderMode = sketchRenderMode(manifest);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-7xl">
        {renderMode === 'svg' ? (
          <img
            src={`/api/sketches/${encodeURIComponent(ref)}/svg?inline=1`}
            alt={data?.title || ref}
            className="w-full h-auto block"
          />
        ) : renderMode === 'world' || renderMode === 'scene' ? (
          <iframe
            src={`/api/sketches/${encodeURIComponent(ref)}/${renderMode}`}
            title={data?.title || ref}
            className="w-full block border-0"
            style={{ aspectRatio: '1120 / 780' }}
          />
        ) : (
          <CreationMap manifest={manifest} technical={false} mode={mode} />
        )}
      </div>
    </main>
  );
}
