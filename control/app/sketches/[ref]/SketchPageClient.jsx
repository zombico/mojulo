'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function SketchPageClient({ refId, initialData = null, initialNotFound = false }) {
  const ref = refId;
  const router = useRouter();
  const t = useTranslations('sketches');
  const [data, setData] = useState(initialData);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(initialNotFound);
  const [mode, setMode] = useState('color');
  // per-format model export status: idle | preparing | unavailable | error
  const [modelStatus, setModelStatus] = useState({ glb: 'idle', stl: 'idle' });
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

  // Beats artifacts have their own home — the studio. On the surface a beats
  // ref is never presented as a sketch; this page is the generic frame for
  // everything else (the /api/sketches aliases keep serving beats unchanged).
  useEffect(() => {
    if (data?.manifest && sketchRenderMode(data.manifest) === 'beats') {
      router.replace(`/beats/${encodeURIComponent(ref)}`);
    }
  }, [data, ref, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    setMode(search.get('mode') === 'wireframe' ? 'wireframe' : 'color');
  }, []);

  // Fetch a model export through the API (rather than a bare <a download>) so an ineligible
  // sketch — which 422s with a JSON body — surfaces a message instead of downloading JSON.
  // `format` is 'glb' (the faithful depiction capture) or 'stl' (the 3D-printing handoff).
  const downloadModel = useCallback(async (format) => {
    setModelStatus((s) => ({ ...s, [format]: 'preparing' }));
    try {
      const res = await fetch(`/api/sketches/${encodeURIComponent(ref)}/model.${format}`);
      if (res.status === 422) {
        setModelStatus((s) => ({ ...s, [format]: 'unavailable' }));
        return;
      }
      if (!res.ok) {
        setModelStatus((s) => ({ ...s, [format]: 'error' }));
        return;
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const base = (data?.title || ref).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = `${base || 'model'}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      setModelStatus((s) => ({ ...s, [format]: 'idle' }));
    } catch {
      setModelStatus((s) => ({ ...s, [format]: 'error' }));
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

  // beats redirect (above) is in flight — don't flash the player here.
  if (renderMode === 'beats') {
    return <main className="min-h-screen" aria-hidden />;
  }

  // Worlds and scenes carry exportable 3D geometry; offer .glb + .stl downloads for them.
  const canExportModel = renderMode === 'world' || renderMode === 'scene';

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-7xl">
        {canExportModel && (
          <div className="mb-3 flex items-center justify-end gap-3">
            {modelStatus.glb === 'unavailable' && (
              <span className="text-xs text-[color:var(--text-muted)]">{t('downloadGlbUnavailable')}</span>
            )}
            {modelStatus.glb === 'error' && (
              <span className="text-xs text-red-400">{t('downloadGlbError')}</span>
            )}
            {modelStatus.stl === 'unavailable' && (
              <span className="text-xs text-[color:var(--text-muted)]">{t('downloadStlUnavailable')}</span>
            )}
            {modelStatus.stl === 'error' && (
              <span className="text-xs text-red-400">{t('downloadStlError')}</span>
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
              onClick={() => downloadModel('glb')}
              disabled={modelStatus.glb === 'preparing'}
              className="text-xs px-3 py-1.5 rounded border border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            >
              {modelStatus.glb === 'preparing' ? t('downloadGlbPreparing') : t('downloadGlb')}
            </button>
            <button
              type="button"
              onClick={() => downloadModel('stl')}
              disabled={modelStatus.stl === 'preparing'}
              title={t('downloadStlHint')}
              className="text-xs px-3 py-1.5 rounded border border-[color:var(--border)] hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            >
              {modelStatus.stl === 'preparing' ? t('downloadStlPreparing') : t('downloadStl')}
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
