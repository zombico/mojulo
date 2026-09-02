'use client';

/**
 * /map's client body — the connected-services map inside the workshop shell.
 * page.jsx resolves the auth flag server-side and hands it down for the
 * strip's sign-out. Pinned posture: the shell is the viewport-height
 * instrument and the map pane scrolls inside it (min-h-0 flex-1 chain).
 *
 * Blocked per 3d-factory-ui.plan.md §7c: the shell is the page's one frame,
 * and the header, the readouts, the legend and the map pane are its regions,
 * divided by hairlines they share (`moj-part-b`) — no floating boxes, padding
 * on the regions rather than gutters between them. The ground plane carries
 * NO latent field: running processes are not mintable space (§7c dropped it
 * from the fleet map by name), so the empty state is plain words.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import WorkshopShell from '@/components/WorkshopShell';
import CreationMap from '@/components/graph/CreationMap';

function CountStat({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[22px] font-semibold tabular-nums leading-none text-[color:var(--ink-primary)]">
        {value}
      </span>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
        {label}
      </span>
    </div>
  );
}

function LegendChip({ swatchClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--ink-muted)]">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${swatchClass}`} aria-hidden />
      {label}
    </span>
  );
}

export default function MapBody({ authEnabled = false }) {
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
    <WorkshopShell posture="pinned" width={1400} crumb={t('title')} authEnabled={authEnabled}>
      <header className="moj-part-b flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[color:var(--ink-primary)]">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-[color:var(--ink-secondary)]">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-secondary)] transition-colors duration-100 hover:text-[color:var(--ink-primary)] disabled:opacity-50"
        >
          {loading ? t('loading') : t('refresh')}
        </button>
      </header>

      {counts && (
        <div className="moj-part-b flex flex-wrap gap-x-10 gap-y-4 px-5 py-4">
          <CountStat label={t('counts.bots')} value={counts.bots} />
          <CountStat label={t('counts.apps')} value={counts.apps} />
          <CountStat label={t('counts.servers')} value={counts.servers} />
          <CountStat label={t('counts.services')} value={counts.services} />
        </div>
      )}

      {/* The key — air and ground read as one labelled line, the rule §7c put
          between the planes instead of a field under the ground. */}
      <div className="moj-part-b flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
          {t('legend.air')}
        </span>
        <LegendChip swatchClass="bg-[color:var(--brand-teal)]/40" label={t('legend.servers')} />
        <LegendChip swatchClass="bg-transparent border border-dashed border-[color:var(--bay-rail-lit)]" label={t('legend.services')} />
        <span className="text-[color:var(--ink-muted)]/40">·</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
          {t('legend.ground')}
        </span>
        <LegendChip swatchClass="bg-slate-400/40" label={t('legend.apps')} />
        <LegendChip swatchClass="bg-purple-400/40" label={t('legend.bots')} />
      </div>

      {error && (
        <p className="moj-part-b px-5 py-2.5 text-[13px] text-[color:var(--fault)]">
          {t('error')}: {error}
        </p>
      )}

      {empty && !error && (
        <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-[color:var(--ink-muted)]">
          {t('empty')}
        </div>
      )}

      {manifest && (
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div style={{ width: `${manifest.viewBox.width}px` }}>
            <CreationMap
              manifest={manifest}
              compact
              onNodeClick={(s) => s.href && router.push(s.href)}
            />
          </div>
        </div>
      )}
    </WorkshopShell>
  );
}
