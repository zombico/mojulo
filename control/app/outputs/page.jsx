'use client';

/**
 * /outputs — inbox of materialized publications ("output artifacts").
 *
 * Surface-facing name is "Outputs" / "Output Artifacts"; the internal
 * substrate verb is still `cook` (DB table `stash_cooks`, MCP tool `cook`,
 * file paths `app/api/cooks/`, component `CooksIndexPage`). The route was
 * renamed to keep the operator vocabulary independent of the substrate
 * vocabulary — see COOKS_UI.plan.md.
 *
 * Output artifacts are created via the `cook` MCP tool; this page links out
 * to the static `/outcomes/<cook_ref>/` page for each one. The load-bearing
 * affordance is the per-row publication-kind chip — the publisher refactor
 * (see lib/outcomes/PUBLISHER.plan.md) earns this here on the operator side.
 * Per-stash lineage (the reverse direction) lands in a separate PR on the
 * /stashes/[ref] detail page.
 *
 * Renders state; offers no chat. The operator drives cook() from their host
 * agent per the dashboard golden rule.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

const KIND_FILTERS = [
  'all', 'essay', 'picture_book', 'slide_deck',
  'flyer', 'brief', 'resume', 'newsletter', 'field_guide', 'pamphlet',
  'textbook', 'novel', 'visual_guide',
];

const STATUS_FILTERS = ['open', 'archived', 'all'];

const KIND_STYLES = {
  essay: 'border-sky-500 text-sky-300 bg-sky-900/30',
  picture_book: 'border-amber-500 text-amber-300 bg-amber-900/30',
  slide_deck: 'border-violet-500 text-violet-300 bg-violet-900/30',
  flyer: 'border-rose-500 text-rose-300 bg-rose-900/30',
  brief: 'border-blue-500 text-blue-300 bg-blue-900/30',
  resume: 'border-emerald-500 text-emerald-300 bg-emerald-900/30',
  newsletter: 'border-orange-500 text-orange-300 bg-orange-900/30',
  field_guide: 'border-lime-500 text-lime-300 bg-lime-900/30',
  pamphlet: 'border-fuchsia-500 text-fuchsia-300 bg-fuchsia-900/30',
  textbook: 'border-indigo-500 text-indigo-300 bg-indigo-900/30',
  novel: 'border-red-500 text-red-300 bg-red-900/30',
  visual_guide: 'border-yellow-500 text-yellow-300 bg-yellow-900/30',
  unknown: 'border-gray-600 text-gray-400 bg-gray-700/40',
};

export default function CooksIndexPage() {
  const t = useTranslations('cooks');
  const [cooks, setCooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('open');
  const [rowBusy, setRowBusy] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `/api/cooks?kind=${encodeURIComponent(kindFilter)}&status=${encodeURIComponent(statusFilter)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCooks(data.cooks || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [kindFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const toggleArchive = useCallback(async (cookRef, currentlyArchived) => {
    setRowBusy(cookRef);
    try {
      const res = await fetch(`/api/cooks/${encodeURIComponent(cookRef)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: !currentlyArchived }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to update');
      // Refetch so row drops/appears according to the active status filter.
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRowBusy(null);
    }
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cooks;
    return cooks.filter(
      (c) => (c.aim || '').toLowerCase().includes(q) || c.cookRef.toLowerCase().includes(q),
    );
  }, [cooks, query]);

  const kindLabel = (k) => {
    switch (k) {
      case 'essay': return t('kindEssay');
      case 'picture_book': return t('kindPictureBook');
      case 'slide_deck': return t('kindSlideDeck');
      case 'flyer': return t('kindFlyer');
      case 'brief': return t('kindBrief');
      case 'resume': return t('kindResume');
      case 'newsletter': return t('kindNewsletter');
      case 'field_guide': return t('kindFieldGuide');
      case 'pamphlet': return t('kindPamphlet');
      case 'textbook': return t('kindTextbook');
      case 'novel': return t('kindNovel');
      case 'visual_guide': return t('kindVisualGuide');
      case 'all': return t('kindAll');
      default: return t('kindUnknown');
    }
  };

  const statusLabel = (s) => {
    if (s === 'archived') return t('statusArchived');
    if (s === 'all') return t('statusAll');
    return t('statusOpen');
  };

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-900">
      <div className="px-8 pt-6 pb-4 max-w-5xl mx-auto">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">{t('title')}</h1>
            <p className="text-xs text-gray-400 mt-1 max-w-2xl">{t('subtitle')}</p>
          </div>
          <span className="text-sm text-gray-400 shrink-0">
            {t('total', { count: cooks.length })}
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

        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs">
          <span className="text-gray-500 uppercase tracking-wide mr-1">
            {t('filterKindLabel')}
          </span>
          {KIND_FILTERS.map((k) => {
            const isActive = kindFilter === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKindFilter(k)}
                className={`px-2.5 py-1 rounded border transition ${
                  isActive
                    ? 'border-teal-500 bg-teal-900/30 text-teal-300'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                {kindLabel(k)}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-500 mt-4 mb-3">
          {query
            ? t('filteredCount', { count: filtered.length, total: cooks.length })
            : t('count', { count: filtered.length })}
        </p>

        <div className="space-y-2">
          {loading && cooks.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">{t('loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {cooks.length === 0 ? (
                <div className="space-y-2">
                  <p>{t('empty')}</p>
                  <p className="text-xs text-gray-600 max-w-md mx-auto">{t('emptyHint')}</p>
                </div>
              ) : (
                <p>{t('noMatch')}</p>
              )}
            </div>
          ) : (
            filtered.map((cook) => (
              <CookRow
                key={cook.cookRef}
                cook={cook}
                kindLabel={kindLabel(cook.publicationKind)}
                t={t}
                onToggleArchive={() => toggleArchive(cook.cookRef, !!cook.archivedAt)}
                rowBusy={rowBusy === cook.cookRef}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CookRow({ cook, kindLabel, t, onToggleArchive, rowBusy }) {
  const kindStyle = KIND_STYLES[cook.publicationKind] || KIND_STYLES.unknown;
  const archived = !!cook.archivedAt;
  return (
    <div className={`group relative border rounded-lg transition p-4 ${
      archived
        ? 'border-gray-800 bg-gray-800/40 hover:border-gray-700'
        : 'border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-700/30'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${kindStyle}`}
            >
              {kindLabel}
            </span>
            {archived && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 bg-gray-700/40 shrink-0">
                {t('statusArchived')}
              </span>
            )}
            <Link
              href={cook.outcomeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm font-semibold truncate ${archived ? 'text-gray-400 hover:text-teal-300' : 'text-gray-200 hover:text-teal-300'}`}
            >
              {cook.aim || t('untitledAim')}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            {cook.stashes.length > 0 && (
              <span className="inline-flex items-center gap-1 flex-wrap">
                <span className="text-gray-500">{t('sourceLabel')}:</span>
                {cook.stashes.map((s, idx) => (
                  <span key={s.stashRef} className="inline-flex items-center gap-1">
                    {idx > 0 && <span className="text-gray-600">·</span>}
                    <StashChip stash={s} t={t} />
                  </span>
                ))}
              </span>
            )}
            {cook.suggestedLens && (
              <span className="inline-flex items-center gap-1">
                <span className="text-gray-600">·</span>
                <span className="text-gray-500">{t('lensLabel')}:</span>
                <span className="text-gray-300 font-mono text-[11px]">{cook.suggestedLens}</span>
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
          {formatTimestamp(cook.createdAt)}
        </span>
      </div>
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition">
        <button
          type="button"
          onClick={onToggleArchive}
          disabled={rowBusy}
          className="px-2 py-1 text-[11px] border border-gray-600 rounded bg-gray-900/80 text-gray-300 hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
        >
          {archived ? t('actions.unarchive') : t('actions.archive')}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 pt-2 border-t border-gray-700/60">
        <p className="font-mono text-[11px] text-gray-500 truncate">{cook.cookRef}</p>
        <Link
          href={cook.outcomeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-teal-400/80 hover:text-teal-300 whitespace-nowrap"
        >
          {t('viewOutcome')} →
        </Link>
      </div>
    </div>
  );
}

function StashChip({ stash, t }) {
  if (stash.title === null) {
    return (
      <span className="text-gray-500 italic" title={stash.stashRef}>
        {t('sourceUnknown')}
      </span>
    );
  }
  return (
    <Link
      href={`/stashes/${encodeURIComponent(stash.stashRef)}`}
      className="text-gray-300 hover:text-teal-300 underline decoration-gray-600 hover:decoration-teal-400 underline-offset-2"
    >
      {stash.title}
    </Link>
  );
}
