'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';

function CountStat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">{label}</span>
    </div>
  );
}

function LegendChip({ swatchClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-muted)]">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${swatchClass}`} aria-hidden />
      {label}
    </span>
  );
}

export default function MapPage() {
  const t = useTranslations('map');
  const router = useRouter();

  const [manifest, setManifest] = useState(null);
  const [counts, setCounts] = useState(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/connected-services/graph?framing=mcp-skills');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setCounts(body.counts || null);
      setEmpty(Boolean(body.empty));
      setManifest(body.manifest || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-[calc(100vh-66px)] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-[color:var(--text-secondary)] mt-1">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm disabled:opacity-50"
          >
            {loading ? t('loading') : t('refresh')}
          </button>
        </header>

        {counts && (
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <CountStat label={t('counts.bots')} value={counts.bots} />
            <CountStat label={t('counts.apps')} value={counts.apps} />
            <CountStat label={t('counts.servers')} value={counts.servers} />
            <CountStat label={t('counts.services')} value={counts.services} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
            {t('legend.air')}
          </span>
          <LegendChip swatchClass="bg-[color:var(--brand-teal)]/40" label={t('legend.servers')} />
          <LegendChip swatchClass="bg-transparent border border-dashed border-[color:var(--border-color)]" label={t('legend.services')} />
          <span className="text-[color:var(--text-muted)]/40">·</span>
          <span className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
            {t('legend.ground')}
          </span>
          <LegendChip swatchClass="bg-slate-400/40" label={t('legend.apps')} />
          <LegendChip swatchClass="bg-purple-400/40" label={t('legend.bots')} />
        </div>

        {error && <p className="text-sm text-red-400">{t('error')}: {error}</p>}

        {empty && !error && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-12 text-center text-[color:var(--text-muted)]">
            {t('empty')}
          </div>
        )}

        {manifest && (
          <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4 overflow-x-auto">
            <div style={{ width: `${manifest.viewBox.width}px` }}>
              <CreationMap
                manifest={manifest}
                compact
                onNodeClick={(s) => s.href && router.push(s.href)}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
