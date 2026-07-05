'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

function fmtMs(v) {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`;
}

function fmtAgo(startedAt) {
  if (!startedAt) return '—';
  const diff = Date.now() - startedAt;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLES = {
  ok: 'border-emerald-500 text-emerald-300 bg-emerald-900/30',
  error: 'border-red-500 text-red-300 bg-red-900/30',
  timeout: 'border-amber-500 text-amber-300 bg-amber-900/30',
  late_settle: 'border-sky-500 text-sky-300 bg-sky-900/30',
};

function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || 'border-gray-600 text-gray-300 bg-gray-700/40';
  return <span className={`inline-block rounded px-2 py-0.5 text-xs border ${cls}`}>{status}</span>;
}

const WINDOWS = [
  { days: 1, key: 'window1d' },
  { days: 7, key: 'window7d' },
  { days: 30, key: 'window30d' },
];

export default function ObservabilityPage() {
  const t = useTranslations('observability');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sinceDays, setSinceDays] = useState(7);
  const [selectedTool, setSelectedTool] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/mcp-telemetry?sinceDays=${sinceDays}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'load failed');
      setData(await res.json());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [sinceDays]);

  useEffect(() => {
    load();
  }, [load]);

  const openTool = useCallback(async (tool) => {
    setSelectedTool(tool);
    setDetail(null);
    try {
      const res = await fetch(`/api/mcp-telemetry?tool=${encodeURIComponent(tool)}&limit=100`);
      if (res.ok) setDetail(await res.json());
    } catch {
      /* soft-fail: the table view stays usable */
    }
  }, []);

  const aggregates = data?.aggregates || [];
  const errors = data?.errors || [];
  const recent = data?.recent || [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 text-[color:var(--text-primary)]">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1 max-w-2xl">{t('subtitle')}</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg px-4 py-2 border border-[color:var(--border-color)] hover:border-[color:var(--text-muted)] transition text-sm flex-shrink-0"
        >
          {t('refresh')}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6 text-sm">
        <span className="text-[color:var(--text-muted)]">{t('windowLabel')}:</span>
        {WINDOWS.map((w) => (
          <button
            key={w.days}
            onClick={() => setSinceDays(w.days)}
            className={`rounded-lg px-3 py-1 border transition ${
              sinceDays === w.days
                ? 'border-[color:var(--brand-teal)] text-[color:var(--brand-teal)]'
                : 'border-[color:var(--border-color)] hover:border-[color:var(--text-muted)]'
            }`}
          >
            {t(w.key)}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 text-sm text-red-400">{t('error')}: {error}</div>}
      {loading && <div className="text-sm text-[color:var(--text-muted)]">{t('loading')}</div>}

      {!loading && !error && aggregates.length === 0 && (
        <div className="text-sm text-[color:var(--text-muted)] border border-[color:var(--border-color)] rounded-lg p-6">
          {t('empty')}
        </div>
      )}

      {!loading && aggregates.length > 0 && (
        <>
          {/* Per-tool aggregates */}
          <section className="mb-8">
            <h2 className="text-lg font-medium mb-3">{t('aggregatesTitle')}</h2>
            <div className="overflow-x-auto border border-[color:var(--border-color)] rounded-lg">
              <table className="w-full text-sm">
                <thead className="text-[color:var(--text-muted)] text-left">
                  <tr className="border-b border-[color:var(--border-color)]">
                    <th className="px-3 py-2">{t('table.tool')}</th>
                    <th className="px-3 py-2 text-right">{t('table.calls')}</th>
                    <th className="px-3 py-2 text-right">{t('table.errorRate')}</th>
                    <th className="px-3 py-2 text-right">{t('table.p50')}</th>
                    <th className="px-3 py-2 text-right">{t('table.p95')}</th>
                    <th className="px-3 py-2 text-right">{t('table.lastCalled')}</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.map((a) => (
                    <tr
                      key={a.tool}
                      onClick={() => openTool(a.tool)}
                      className="border-b border-[color:var(--border-color)] last:border-0 cursor-pointer hover:bg-[color:var(--bg-hover,rgba(255,255,255,0.03))]"
                    >
                      <td className="px-3 py-2 font-mono">{a.tool}</td>
                      <td className="px-3 py-2 text-right">{a.calls}</td>
                      <td className={`px-3 py-2 text-right ${a.errorRate > 0 ? 'text-red-400' : ''}`}>
                        {Math.round(a.errorRate * 100)}%
                      </td>
                      <td className="px-3 py-2 text-right">{fmtMs(a.p50)}</td>
                      <td className="px-3 py-2 text-right">{fmtMs(a.p95)}</td>
                      <td className="px-3 py-2 text-right text-[color:var(--text-muted)]">{fmtAgo(a.lastCalledAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Tool drilldown */}
          {selectedTool && (
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium font-mono">{selectedTool}</h2>
                <button
                  onClick={() => { setSelectedTool(null); setDetail(null); }}
                  className="text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] underline decoration-dotted"
                >
                  {t('backToObservability')}
                </button>
              </div>
              <CallTable rows={detail?.recent || []} t={t} />
            </section>
          )}

          {/* Recent errors */}
          <section className="mb-8">
            <h2 className="text-lg font-medium mb-3">{t('recentErrorsTitle')}</h2>
            {errors.length === 0 ? (
              <div className="text-sm text-[color:var(--text-muted)]">{t('noErrors')}</div>
            ) : (
              <div className="space-y-1">
                {errors.map((c) => (
                  <div key={c.id} className="text-sm border border-[color:var(--border-color)] rounded px-3 py-2">
                    <span className="font-mono">{c.tool}</span>{' '}
                    <span className="text-[color:var(--text-muted)]">({fmtAgo(c.startedAt)})</span>
                    <span className="text-red-400"> — {c.errorMessage || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent calls tail */}
          <section>
            <h2 className="text-lg font-medium mb-3">{t('recentCallsTitle')}</h2>
            <CallTable rows={recent} t={t} showTool />
          </section>
        </>
      )}

      <div className="mt-10 text-xs text-[color:var(--text-muted)]">
        <Link href="/bots" className="underline decoration-dotted underline-offset-2 hover:text-[color:var(--text-primary)]">
          ← /bots
        </Link>
      </div>
    </div>
  );
}

function CallTable({ rows, t, showTool = false }) {
  if (!rows.length) return <div className="text-sm text-[color:var(--text-muted)]">—</div>;
  return (
    <div className="overflow-x-auto border border-[color:var(--border-color)] rounded-lg">
      <table className="w-full text-sm">
        <thead className="text-[color:var(--text-muted)] text-left">
          <tr className="border-b border-[color:var(--border-color)]">
            {showTool && <th className="px-3 py-2">{t('table.tool')}</th>}
            <th className="px-3 py-2">{t('table.status')}</th>
            <th className="px-3 py-2 text-right">{t('table.duration')}</th>
            <th className="px-3 py-2">{t('table.via')}</th>
            <th className="px-3 py-2 text-right">{t('table.when')}</th>
            <th className="px-3 py-2">{t('table.message')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-[color:var(--border-color)] last:border-0">
              {showTool && <td className="px-3 py-2 font-mono">{c.tool}</td>}
              <td className="px-3 py-2"><StatusPill status={c.status} /></td>
              <td className="px-3 py-2 text-right">{fmtMs(c.durationMs)}</td>
              <td className="px-3 py-2 text-[color:var(--text-muted)]">{c.via}</td>
              <td className="px-3 py-2 text-right text-[color:var(--text-muted)]">{fmtAgo(c.startedAt)}</td>
              <td className="px-3 py-2 text-[color:var(--text-muted)] max-w-xs truncate">{c.errorMessage || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
