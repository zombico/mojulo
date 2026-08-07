'use client';

/**
 * /stashes — inbox of stashes.
 *
 * Stashes are minted via the `mint_stash` MCP tool (title-at-moment-of-intent
 * belongs in the agent flow per
 * lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md). Structural
 * edits on this page: rename + archive/unarchive (hover affordances on each
 * row). Detail-level edits (drawers, items) live on the detail page.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

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

export default function StashesIndexPage() {
  const t = useTranslations('stashes');
  const tActions = useTranslations('stashes.actions');
  const [stashes, setStashes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [editingRef, setEditingRef] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [rowBusy, setRowBusy] = useState(null);
  const [rowError, setRowError] = useState(null);

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

  const beginRename = useCallback((stashRef, currentTitle) => {
    setEditingRef(stashRef);
    setDraftTitle(currentTitle || '');
    setRowError(null);
  }, []);

  const cancelRename = useCallback(() => {
    setEditingRef(null);
    setDraftTitle('');
    setRowError(null);
  }, []);

  const saveRename = useCallback(async (stashRef) => {
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setRowError({ ref: stashRef, message: tActions('titleEmpty') });
      return;
    }
    setRowBusy(stashRef);
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(stashRef)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tActions('renameFailed'));
      setStashes((prev) =>
        prev.map((s) => (s.stashRef === stashRef ? { ...s, title: body.stash?.title || trimmed } : s)),
      );
      cancelRename();
    } catch (e) {
      setRowError({ ref: stashRef, message: e.message });
    } finally {
      setRowBusy(null);
    }
  }, [draftTitle, tActions, cancelRename]);

  const toggleStatus = useCallback(async (stashRef, currentStatus) => {
    const nextStatus = currentStatus === 'open' ? 'archived' : 'open';
    setRowBusy(stashRef);
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(stashRef)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tActions('statusChangeFailed'));
      // If the row no longer matches the active filter, the next refetch drops
      // it from view. Refetch to keep the filtered list honest.
      if (statusFilter !== 'all' && statusFilter !== nextStatus) {
        await load();
      } else {
        setStashes((prev) =>
          prev.map((s) => (s.stashRef === stashRef ? { ...s, status: nextStatus } : s)),
        );
      }
    } catch (e) {
      setRowError({ ref: stashRef, message: e.message });
    } finally {
      setRowBusy(null);
    }
  }, [statusFilter, tActions, load]);

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-900">
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
                editing={editingRef === s.stashRef}
                draftTitle={draftTitle}
                rowBusy={rowBusy === s.stashRef}
                rowError={rowError?.ref === s.stashRef ? rowError.message : null}
                onDraftChange={setDraftTitle}
                onBeginRename={() => beginRename(s.stashRef, s.title)}
                onSaveRename={() => saveRename(s.stashRef)}
                onCancelRename={cancelRename}
                onToggleStatus={() => toggleStatus(s.stashRef, s.status)}
                statusLabel={statusLabel(s.status)}
                t={t}
                tActions={tActions}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StashRow({
  stash,
  editing,
  draftTitle,
  rowBusy,
  rowError,
  onDraftChange,
  onBeginRename,
  onSaveRename,
  onCancelRename,
  onToggleStatus,
  statusLabel,
  t,
  tActions,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="border border-teal-500 rounded-lg p-4 bg-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveRename();
                else if (e.key === 'Escape') onCancelRename();
              }}
              disabled={rowBusy}
              className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-900 text-gray-100 focus:outline-none focus:border-teal-500"
            />
            <p className="font-mono text-[11px] text-gray-500 mt-2 truncate">{stash.stashRef}</p>
            {rowError && <p className="text-xs text-red-400 mt-1">{rowError}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onSaveRename}
              disabled={rowBusy}
              className="px-3 py-1.5 text-xs border border-teal-500 rounded bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {tActions('save')}
            </button>
            <button
              type="button"
              onClick={onCancelRename}
              disabled={rowBusy}
              className="px-3 py-1.5 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 disabled:opacity-50"
            >
              {tActions('cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative group border border-gray-700 rounded-lg bg-gray-800 hover:border-gray-600 hover:bg-gray-750 transition">
      <Link
        href={`/stashes/${encodeURIComponent(stash.stashRef)}`}
        className="block p-4 hover:bg-gray-700/40 rounded-lg transition"
      >
        <div className="flex items-start justify-between gap-3 pr-24">
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
      <div
        className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onBeginRename}
          disabled={rowBusy}
          className="px-2 py-1 text-[11px] border border-gray-600 rounded bg-gray-900/80 text-gray-300 hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
        >
          {tActions('rename')}
        </button>
        <button
          type="button"
          onClick={onToggleStatus}
          disabled={rowBusy}
          className="px-2 py-1 text-[11px] border border-gray-600 rounded bg-gray-900/80 text-gray-300 hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
        >
          {stash.status === 'archived' ? tActions('unarchive') : tActions('archive')}
        </button>
      </div>
      {rowError && (
        <p className="text-xs text-red-400 px-4 pb-3 -mt-2">{rowError}</p>
      )}
    </div>
  );
}
