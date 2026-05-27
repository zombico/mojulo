'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';

function formatTimestamp(value) {
  if (!value) return '—';
  try {
    const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
    if (!Number.isFinite(ms)) return '—';
    return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return '—';
  }
}

const TECHNICAL_STORAGE_KEY = 'mojulo.graph.technical';

export default function GraphPage() {
  const t = useTranslations('graph');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [technical, setTechnical] = useState(false);

  // Hydrate from localStorage on mount; persist on change. SSR-safe because
  // both effects run client-side only.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TECHNICAL_STORAGE_KEY);
      if (stored === 'true') setTechnical(true);
    } catch {
      // localStorage may be unavailable (privacy mode, SSR). Stay on default.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(TECHNICAL_STORAGE_KEY, technical ? 'true' : 'false');
    } catch {
      // ignore
    }
  }, [technical]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/graph/creation-map');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const manifest = data?.manifest;
  const validation = data?.validation;
  const overlay = data?.overlay;

  return (
    <main className="min-h-[calc(100vh-33px)] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t('title')}</h1>
            <p className="text-[color:var(--text-secondary)] mt-2">
              {technical ? t('subtitleTechnical') : t('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-2 text-sm text-[color:var(--text-secondary)] cursor-pointer select-none rounded-lg px-3 py-2 border border-[color:var(--border-color)] hover:bg-white/[0.03] transition-colors">
              <input
                type="checkbox"
                checked={technical}
                onChange={(e) => setTechnical(e.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--border-color)] bg-[color:var(--surface-primary)] accent-[color:var(--brand-teal)]"
              />
              {t('technicalToggle')}
            </label>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] text-sm text-[color:var(--text-secondary)] hover:bg-white/[0.03] hover:text-[color:var(--text-primary)] disabled:opacity-50 disabled:hover:bg-[color:var(--surface-primary)] transition-colors"
            >
              {loading ? t('loading') : t('refresh')}
            </button>
          </div>
        </header>

        {error ? (
          <section className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
            <span aria-hidden>✗</span>
            <span className="font-mono text-xs">{error}</span>
          </section>
        ) : null}

        {overlay ? (
          <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] px-4 py-3 text-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-[color:var(--text-secondary)]">
              <span>
                {t('overlay.appCount', { count: overlay.appCount })}
              </span>
              <span className="text-[color:var(--text-muted)]">·</span>
              <span className="font-mono text-xs">
                {t('overlay.lastMaterialized')}: {formatTimestamp(overlay.lastMaterializedAt)}
              </span>
            </div>
            <Link
              href="/apps"
              className="text-[color:var(--brand-teal)] hover:underline text-sm"
            >
              {t('overlay.viewApps')} →
            </Link>
          </section>
        ) : null}

        {validation ? (
          <section
            className={`rounded-xl border px-4 py-3 text-sm ${
              validation.ok
                ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-300'
                : 'border-red-500/40 bg-red-500/5 text-red-300'
            }`}
          >
            {validation.ok ? (
              <div className="flex items-center gap-2">
                <span aria-hidden>✓</span>
                <span>
                  {technical
                    ? t('validation.okTechnical', {
                        tools: validation.counts.toolsChecked,
                        nodeKinds: validation.counts.nodeKindsChecked,
                        edgeKinds: validation.counts.edgeKindsChecked,
                        sourceEvents: validation.counts.sourceEventsChecked,
                      })
                    : t('validation.ok')}
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="font-semibold flex items-center gap-2">
                  <span aria-hidden>✗</span>
                  <span>{t('validation.failed', { count: validation.problems.length })}</span>
                </div>
                <ul className="text-xs font-mono space-y-1 ml-6 list-disc">
                  {validation.problems.map((p, i) => (
                    <li key={i}>
                      <span className="text-red-200">[{p.kind}]</span> {p.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}

        {manifest ? (
          <section className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-5">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-[color:var(--border-color)]/60">
              <span className="text-xs uppercase tracking-[0.12em] text-[color:var(--text-muted)] font-medium">
                {manifest.title}
              </span>
            </div>
            <CreationMap manifest={manifest} technical={technical} />
            <div className="mt-5 pt-4 border-t border-[color:var(--border-color)]/60 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--text-secondary)]">
              <Legend swatch="rgba(255,255,255,0.02)" border="var(--border-color)" dashed>
                {technical ? t('legend.inputTechnical') : t('legend.input')}
              </Legend>
              <Legend swatch="rgba(20,184,166,0.08)" border="var(--brand-teal)">
                {technical ? t('legend.mcpToolTechnical') : t('legend.mcpTool')}
              </Legend>
              <Legend swatch="rgba(100,116,139,0.10)" border="rgba(148,163,184,0.6)">
                {technical ? t('legend.filesystemTechnical') : t('legend.filesystem')}
              </Legend>
              <Legend swatch="rgba(168,85,247,0.08)" border="rgba(168,85,247,0.7)">
                {technical ? t('legend.dbRowTechnical') : t('legend.dbRow')}
              </Legend>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Legend({ swatch, border, dashed, children }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block w-5 h-4 rounded shrink-0"
        style={{
          background: swatch,
          border: `1.4px ${dashed ? 'dashed' : 'solid'} ${border}`,
        }}
      />
      {children}
    </span>
  );
}
