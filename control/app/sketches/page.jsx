'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function timeAgo(value) {
  if (!value) return '';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  const diffMs = Date.now() - ms;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function SketchesIndexPage() {
  const t = useTranslations('sketchesIndex');
  const [sketches, setSketches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/sketches');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSketches(data.sketches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-select the most recent sketch once the list arrives, but don't
  // override an existing selection if the user already clicked one (e.g.
  // after a refresh).
  useEffect(() => {
    if (!selectedRef && sketches.length > 0) {
      setSelectedRef(sketches[0].ref);
    }
  }, [sketches, selectedRef]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sketches;
    return sketches.filter(
      (s) =>
        s.title?.toLowerCase().includes(q) ||
        s.ref?.toLowerCase().includes(q),
    );
  }, [sketches, query]);

  const selected = sketches.find((s) => s.ref === selectedRef) || null;

  // Esc closes fullscreen; otherwise no global key handlers.
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  return (
    <div className="h-[calc(100vh-66px)] flex flex-col bg-gray-900">
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('title')}</h1>
          <p className="text-xs text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <span className="text-sm text-gray-400">
          {t('total', { count: sketches.length })}
        </span>
      </div>

      {error && (
        <div className="mx-8 mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-4 gap-6 px-8 py-4 overflow-hidden">
        {/* Left: searchable list */}
        <div className="col-span-1 border-r border-gray-700 pr-4 flex flex-col overflow-hidden">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 mb-3 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
          />
          <p className="text-xs text-gray-400 mb-3">
            {query
              ? t('filteredCount', { count: filtered.length, total: sketches.length })
              : t('count', { count: filtered.length })}
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {loading && sketches.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {sketches.length === 0 ? t('emptyState') : t('noMatch')}
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = s.ref === selectedRef;
                return (
                  <button
                    key={s.ref}
                    type="button"
                    onClick={() => setSelectedRef(s.ref)}
                    className={`w-full text-left border rounded-lg p-3 cursor-pointer transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-900/30'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-semibold text-gray-200 truncate">
                        {s.title}
                      </span>
                      <span className="text-xs text-gray-500 shrink-0">
                        {timeAgo(s.createdAt)}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-gray-500 truncate">{s.ref}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: preview pane */}
        <div className="col-span-3 overflow-y-auto">
          {selected ? (
            <div className="space-y-4">
              <div className="border border-gray-700 rounded-lg p-6 bg-gray-800 sticky top-0 z-10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-100 truncate">{selected.title}</h2>
                  <p className="font-mono text-xs text-gray-500 mt-1">{selected.ref}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {t('mintedAt', { timestamp: formatTimestamp(selected.createdAt) })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFullscreen(true)}
                    className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
                  >
                    <ExpandIcon />
                    {t('expand')}
                  </button>
                  <a
                    href={`/sketches/${encodeURIComponent(selected.ref)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600"
                  >
                    {t('openInNewTab')}
                  </a>
                </div>
              </div>

              <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
                {selected.manifest ? (
                  <CreationMap manifest={selected.manifest} technical={false} />
                ) : (
                  <p className="text-sm text-red-400">{t('invalidManifest')}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && selected?.manifest ? (
        <div
          className="fixed inset-0 z-50 bg-gray-900/95 backdrop-blur-sm flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
        >
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-100 truncate">{selected.title}</h2>
              <p className="font-mono text-xs text-gray-500 truncate">{selected.ref}</p>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="px-3 py-1.5 text-sm border border-gray-600 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700 inline-flex items-center gap-1.5"
              aria-label={t('close')}
            >
              <CloseIcon />
              {t('close')}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
            <div className="w-full max-w-[120rem]">
              <CreationMap manifest={selected.manifest} technical={false} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ExpandIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

function CloseIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
