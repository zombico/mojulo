'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

function StatusPill({ status, t }) {
  const palette = {
    running: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    crashed: 'bg-red-500/15 text-red-300 border-red-500/40',
    stopped: 'bg-[color:var(--surface-elevated)]/40 text-[color:var(--text-muted)] border-[color:var(--border-color)]',
    unknown: 'bg-[color:var(--surface-elevated)]/40 text-[color:var(--text-muted)] border-[color:var(--border-color)]',
  };
  const cls = palette[status] || palette.unknown;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {t(`status.${status}`)}
    </span>
  );
}

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

export default function AppsListPage() {
  const t = useTranslations('apps');
  const tTable = useTranslations('apps.table');
  const tCommon = useTranslations('common');

  const [apps, setApps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionRef, setActionRef] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/apps');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setApps(body.apps || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function startApp(ref) {
    setActionRef(ref);
    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(ref)}/start`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionRef(null);
    }
  }

  async function stopApp(ref) {
    setActionRef(ref);
    try {
      const res = await fetch(`/api/apps/${encodeURIComponent(ref)}/stop`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionRef(null);
    }
  }

  return (
    <main className="min-h-[calc(100vh-66px)] p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{t('title')}</h1>
            <p className="text-[color:var(--text-secondary)] mt-2">{t('subtitle')}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href="/map"
              className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm hover:border-[color:var(--text-muted)] transition"
            >
              {tCommon('servicesMap')}
            </Link>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg px-3 py-2 border border-[color:var(--border-color)] text-sm disabled:opacity-50"
            >
              {loading ? t('loading') : t('refresh')}
            </button>
          </div>
        </header>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {apps !== null && apps.length === 0 && !error && (
          <div className="rounded-xl border border-dashed border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-12 text-center text-[color:var(--text-muted)]">
            {t('empty')}
          </div>
        )}

        {apps !== null && apps.length > 0 && (
          <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[color:var(--surface-elevated)]/30 text-xs uppercase text-[color:var(--text-muted)]">
                <tr>
                  <th className="text-left px-3 py-2">{tTable('headers.name')}</th>
                  <th className="text-left px-3 py-2">{tTable('headers.materialized')}</th>
                  <th className="text-left px-3 py-2">{tTable('headers.runner')}</th>
                  <th className="text-left px-3 py-2">{tTable('headers.status')}</th>
                  <th className="text-right px-3 py-2">{tTable('headers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => {
                  const status = app.runtime?.status || 'stopped';
                  const isRunning = status === 'running';
                  const acting = actionRef === app.ref;
                  return (
                    <tr key={app.ref} className="border-t border-[color:var(--border-color)]/60">
                      <td className="px-3 py-2">
                        <Link
                          href={`/apps/${encodeURIComponent(app.ref)}`}
                          className="hover:underline font-medium"
                        >
                          {app.name}
                        </Link>
                        <div className="text-xs text-[color:var(--text-muted)] font-mono mt-0.5">
                          {app.locator}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[color:var(--text-muted)] font-mono text-xs">
                        {formatTimestamp(app.materializedAt)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {app.bindings.runner?.implementation || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusPill status={status} t={t} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2 items-center">
                          {isRunning && app.runtime?.url && (
                            <a
                              href={app.runtime.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs underline text-[color:var(--brand-teal)]"
                            >
                              {t('openPreview')}
                            </a>
                          )}
                          {isRunning ? (
                            <button
                              type="button"
                              onClick={() => stopApp(app.ref)}
                              disabled={acting}
                              className="rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {acting ? t('actions.stopping') : t('actions.stop')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startApp(app.ref)}
                              disabled={acting}
                              className="rounded-md bg-[color:var(--brand-teal)] text-[color:var(--brand-navy)] font-semibold px-2 py-1 text-xs disabled:opacity-50"
                            >
                              {acting ? t('actions.starting') : t('actions.start')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
