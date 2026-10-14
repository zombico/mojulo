'use client';

/**
 * /stashes — inbox of stashes.
 *
 * Stashes are minted via the `mint_stash` MCP tool (title-at-moment-of-intent
 * belongs in the agent flow per
 * lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md). The page is
 * view-only: rename and archive go through the agent over MCP.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import WorkshopShell from '@/components/WorkshopShell';

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

const STATUS_STYLES = {
  open: 'border-teal-500 text-teal-300 bg-teal-900/30',
  archived: 'border-gray-600 text-gray-400 bg-gray-700/40',
};

const STATUS_FILTERS = ['open', 'archived', 'all'];

export default function StashesBody({ authEnabled = false }) {
  const t = useTranslations('stashes');
  const [stashes, setStashes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stashes?status=${encodeURIComponent(statusFilter)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStashes(data.stashes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stashes;
    return stashes.filter(
      (s) => s.title?.toLowerCase().includes(q) || s.stashRef?.toLowerCase().includes(q),
    );
  }, [stashes, query]);

  const statusLabel = (s) => {
    if (s === 'archived') return t('statusArchived');
    if (s === 'all') return t('statusAll');
    return t('statusOpen');
  };

  return (
    <WorkshopShell posture="pinned" width={1400} authEnabled={authEnabled} crumb={t('title')}>
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-8 pt-6 pb-4 max-w-5xl mx-auto">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{t('title')}</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">{t('subtitle')}</p>
          </div>
          <span className="text-sm text-gray-400 shrink-0">
            {t('total', { count: stashes.length })}
          </span>
        </div>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 min-w-[200px] max-w-md px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
          />
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 uppercase tracking-wide mr-1">
              {t('filterStatusLabel')}
            </span>
            {STATUS_FILTERS.map((s) => {
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded border transition ${
                    isActive
                      ? 'border-teal-500 bg-teal-900/30 text-teal-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                  }`}
                >
                  {statusLabel(s)}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4 mb-3">
          {query
            ? t('filteredCount', { count: filtered.length, total: stashes.length })
            : t('count', { count: filtered.length })}
        </p>

        <div className="space-y-2">
          {loading && stashes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {stashes.length === 0 ? (
                <div className="space-y-2">
                  <p>{t('empty')}</p>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">{t('emptyHint')}</p>
                </div>
              ) : (
                <p>{t('noMatch')}</p>
              )}
            </div>
          ) : (
            filtered.map((s) => (
              <StashRow
                key={s.stashRef}
                stash={s}
                statusLabel={statusLabel(s.status)}
                t={t}
              />
            ))
          )}
        </div>
      </div>
    </div>
    </WorkshopShell>
  );
}

function StashRow({ stash, statusLabel, t }) {
  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800 hover:border-gray-600 hover:bg-gray-700 transition">
      <Link
        href={`/stashes/${encodeURIComponent(stash.stashRef)}`}
        className="block p-4 hover:bg-gray-700/40 rounded-lg transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-200 truncate">{stash.title}</span>
              <span
                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${
                  STATUS_STYLES[stash.status] || STATUS_STYLES.open
                }`}
              >
                {statusLabel}
              </span>
            </div>
            <p className="font-mono text-[11px] text-gray-500 truncate">{stash.stashRef}</p>
          </div>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
            {t('updatedAt', { timestamp: formatTimestamp(stash.updatedAt) })}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
          <span>{t('itemCount', { count: stash.itemCount })}</span>
          <span>{t('drawerCount', { count: stash.drawerCount })}</span>
        </div>
      </Link>
    </div>
  );
}
