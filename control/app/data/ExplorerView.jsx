'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

function toUTCParam(localDateStr) {
  if (!localDateStr) return '';
  const d = new Date(localDateStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function durationLabel(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function ExplorerView() {
  const t = useTranslations('data.explorer');
  const tTable = useTranslations('data.table');
  const tFleet = useTranslations('data.fleet');
  const tPag = useTranslations('data.explorer.pagination');

  const [searchId, setSearchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const PAGE = 50;

  async function fetchPage(nextOffset = 0) {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('limit', String(PAGE));
      qs.set('offset', String(nextOffset));
      if (searchId) qs.set('conversationId', searchId);
      if (startDate) qs.set('startDate', toUTCParam(startDate));
      if (endDate) qs.set('endDate', toUTCParam(endDate));
      const res = await fetch(`/api/data/conversations?${qs.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setResults(body);
      setOffset(nextOffset);
    } catch (e) {
      setError(e.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  function submit(e) {
    e.preventDefault();
    fetchPage(0);
  }

  const hasParams = searchId || startDate || endDate;

  return (
    <div className="space-y-4">
      <form
        onSubmit={submit}
        className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
      >
        <label className="block text-xs">
          <span className="text-[color:var(--text-muted)]">
            {t('filters.conversationId')}
          </span>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="conv-..."
            className="mt-1 w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/40 px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block text-xs">
          <span className="text-[color:var(--text-muted)]">
            {t('filters.startDate')}
          </span>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/40 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-[color:var(--text-muted)]">
            {t('filters.endDate')}
          </span>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/40 px-3 py-2 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !hasParams}
            className="rounded-lg px-4 py-2 bg-[color:var(--brand-teal)] text-[color:var(--brand-navy)] font-semibold hover:bg-[color:var(--brand-teal-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {loading ? t('searching') : t('search')}
          </button>
          {hasParams && (
            <button
              type="button"
              onClick={() => {
                setSearchId('');
                setStartDate('');
                setEndDate('');
                setResults(null);
                setOffset(0);
              }}
              className="rounded-lg px-3 py-2 text-sm border border-[color:var(--border-color)]"
            >
              {t('clear')}
            </button>
          )}
        </div>
      </form>

      {!hasParams && !results && (
        <p className="text-xs text-[color:var(--text-muted)]">
          {t('hint')}
        </p>
      )}

      {results?.fleet?.unreachableCount > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {tFleet('unreachableBanner', {
            unreachable: results.fleet.unreachableCount,
            total: results.fleet.totalCount,
          })}
        </div>
      )}
      {results?.pagination?.truncated && (
        <div className="rounded-md border border-[color:var(--border-color)] bg-[color:var(--surface-elevated)]/30 px-3 py-2 text-xs text-[color:var(--text-muted)]">
          {tPag('truncatedNotice')}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {results && (
        <div className="rounded-xl border border-[color:var(--border-color)] bg-[color:var(--surface-primary)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-elevated)]/30 text-xs uppercase text-[color:var(--text-muted)]">
              <tr>
                <th className="text-left px-3 py-2">{tTable('headers.bot')}</th>
                <th className="text-left px-3 py-2">{tTable('headers.started')}</th>
                <th className="text-left px-3 py-2">{tTable('headers.duration')}</th>
                <th className="text-right px-3 py-2">{tTable('headers.turns')}</th>
                <th className="text-left px-3 py-2">{tTable('headers.conversationId')}</th>
              </tr>
            </thead>
            <tbody>
              {results.conversations.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[color:var(--text-muted)]"
                  >
                    {t('noConversations')}
                  </td>
                </tr>
              ) : (
                results.conversations.map((c) => (
                  <tr
                    key={`${c.deploymentId}:${c.conversationId}`}
                    className="border-t border-[color:var(--border-color)]/60"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/deployments/${c.deploymentId}/conversations?id=${encodeURIComponent(c.conversationId)}`}
                        className="hover:underline"
                      >
                        {c.botName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)] font-mono text-xs">
                      {c.startedAt || '—'}
                    </td>
                    <td className="px-3 py-2 text-[color:var(--text-muted)]">
                      {durationLabel(c.startedAt, c.lastActivity)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {c.turnCount}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[color:var(--text-muted)]">
                      {c.conversationId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-3 py-2 text-xs text-[color:var(--text-muted)] border-t border-[color:var(--border-color)]/60">
            <span>
              {tPag('showing', {
                start: results.conversations.length ? offset + 1 : 0,
                end: offset + results.conversations.length,
                total: results.pagination.total,
              })}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchPage(Math.max(0, offset - PAGE))}
                disabled={offset === 0 || loading}
                className="rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs disabled:opacity-40"
              >
                {tPag('previous')}
              </button>
              <button
                type="button"
                onClick={() => fetchPage(offset + PAGE)}
                disabled={!results.pagination.hasMore || loading}
                className="rounded-md border border-[color:var(--border-color)] px-2 py-1 text-xs disabled:opacity-40"
              >
                {tPag('next')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
