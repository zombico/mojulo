'use client';

/**
 * /apps/[ref]/graph's client body, inside the workshop shell (pinned
 * posture). The wide CreationMap scrolls inside its own pane.
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import WorkshopShell from '@/components/WorkshopShell';
import CreationMap from '@/components/graph/CreationMap';

export default function AppGraphBody({ params, authEnabled = false }) {
  const { ref } = use(params);
  const refDecoded = decodeURIComponent(ref);
  const t = useTranslations('apps');
  // apps.detail.backToApp never existed in en.json (pre-existing gap, visible
  // as a raw key on the old page too); common.back is the closest real string.
  const tCommon = useTranslations('common');

  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setNotFound(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/apps/${ref}/graph`);
      if (res.status === 404) {
        setNotFound(true);
        setManifest(null);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setManifest(body.manifest);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <WorkshopShell posture="pinned" width={1400} authEnabled={authEnabled} crumb={t('title')}>
      <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="flex items-center justify-between gap-4">
            <Link
              href={`/apps/${ref}`}
              className="inline-flex items-center text-sm text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            >
              ← {tCommon('back')}
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm disabled:opacity-50"
            >
              {loading ? t('loading') : t('refresh')}
            </button>
          </header>

          <div>
            <h1 className="text-2xl font-semibold">{manifest?.title || refDecoded}</h1>
            <p className="text-xs text-[color:var(--text-muted)] mt-1">{t('detail.graph.subtitle')}</p>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {notFound && (
            <div className="rounded-xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-12 text-center text-[color:var(--text-muted)]">
              {t('notFound')}
            </div>
          )}

          {manifest && (
            <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4 overflow-x-auto">
              <div style={{ width: `${manifest.viewBox.width}px` }}>
                <CreationMap manifest={manifest} compact />
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkshopShell>
  );
}
