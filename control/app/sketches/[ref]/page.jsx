'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';

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
  const [glbStatus, setGlbStatus] = useState('idle'); // idle | preparing | unavailable | error
  const [htmlStatus, setHtmlStatus] = useState('idle'); // idle | preparing | unavailable | error

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

  // Fetch the .glb through the API (rather than a bare <a download>) so an ineligible
  // sketch — which 422s with a JSON body — surfaces a message instead of downloading JSON.
  const downloadGlb = useCallback(async () => {
    setGlbStatus('preparing');
    try {
      const res = await fetch(`/api/sketches/${encodeURIComponent(ref)}/model.glb`);
      if (res.status === 422) {
        setGlbStatus('unavailable');
        return;
      }
      if (!res.ok) {
        setGlbStatus('error');
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const base = (data?.title || ref).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${base || 'model'}.glb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setGlbStatus('idle');
    } catch {
      setGlbStatus('error');
    }
  }, [ref, data]);

  // Fetches the /world or /scene HTML with ?download=1, which asks the backend to bake
  // the render's own runtime (three.js for worlds) into the page as data: URLs — a
  // self-contained file that opens standalone, unlike the live iframe's server-relative
  // /vendor paths.
  const downloadHtml = useCallback(async () => {
    const mode = sketchRenderMode(data?.manifest);
    setHtmlStatus('preparing');
    try {
      const res = await fetch(`/api/sketches/${encodeURIComponent(ref)}/${mode}?download=1`);
      if (res.status === 422) {
        setHtmlStatus('unavailable');
        return;
      }
      if (!res.ok) {
        setHtmlStatus('error');
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const base = (data?.title || ref).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${base || mode}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setHtmlStatus('idle');
    } catch {
      setHtmlStatus('error');
    }
  }, [ref, data]);

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

  // Worlds and scenes carry exportable 3D geometry; offer a .glb download for them.
  const canExportGlb = renderMode === 'world' || renderMode === 'scene';

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-7xl">
        {canExportGlb && (
          <div className="mb-3 flex items-center justify-end gap-3">
            {glbStatus === 'unavailable' && (
              <span className="text-xs text-[color:var(--text-muted)]">{t('downloadGlbUnavailable')}</span>
            )}
            {glbStatus === 'error' && (
              <span className="text-xs text-red-400">{t('downloadGlbError')}</span>
            )}
            {htmlStatus === 'unavailable' && (
              <span className="text-xs text-[color:var(--text-muted)]">{t('downloadHtmlUnavailable')}</span>
            )}
            {htmlStatus === 'error' && (
              <span className="text-xs text-red-400">{t('downloadHtmlError')}</span>
            )}
            <button
              type="button"
              onClick={downloadHtml}
              disabled={htmlStatus === 'preparing'}
              className="text-xs px-3 py-1.5 rounded border border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            >
              {htmlStatus === 'preparing' ? t('downloadHtmlPreparing') : t('downloadHtml')}
            </button>
            <button
              type="button"
              onClick={downloadGlb}
              disabled={glbStatus === 'preparing'}
              className="text-xs px-3 py-1.5 rounded border border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            >
              {glbStatus === 'preparing' ? t('downloadGlbPreparing') : t('downloadGlb')}
            </button>
          </div>
        )}
        {renderMode === 'svg' ? (
          <img
            src={`/api/sketches/${encodeURIComponent(ref)}/svg?inline=1`}
            alt={data?.title || ref}
            className="w-full h-auto block"
          />
        ) : renderMode === 'world' || renderMode === 'scene' || renderMode === 'beats' || renderMode === 'game' ? (
          <iframe
            src={`/api/sketches/${encodeURIComponent(ref)}/${renderMode}`}
            title={data?.title || ref}
            className="w-full block border-0"
            style={{ aspectRatio: renderMode === 'beats' ? '760 / 640' : renderMode === 'game' ? '4 / 3' : '1120 / 780' }}
          />
        ) : (
          <CreationMap manifest={manifest} technical={false} mode={mode} />
        )}
      </div>
    </main>
  );
}
