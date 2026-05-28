'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import ModularChatInput from '@/components/ModularChat/ModularChatInput';

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

const KIND_KEY = {
  link: 'kindLink',
  article: 'kindArticle',
  summary: 'kindSummary',
  screencap: 'kindScreencap',
  note: 'kindNote',
  quote: 'kindQuote',
  snippet: 'kindSnippet',
};

const STATUS_STYLES = {
  open: 'border-teal-500 text-teal-300 bg-teal-900/30',
  archived: 'border-gray-600 text-gray-400 bg-gray-700/40',
};

export default function ResearchPage() {
  const t = useTranslations('research');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [book, setBook] = useState(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [composerValue, setComposerValue] = useState('');

  const kindLabel = useCallback((k) => (k && KIND_KEY[k] ? t(KIND_KEY[k]) : k), [t]);
  const statusLabel = useCallback((s) => (s === 'archived' ? t('statusArchived') : t('statusOpen')), [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/research');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedRef) {
      setBook(null);
      return;
    }
    let cancelled = false;
    setBookLoading(true);
    fetch(`/api/research/${encodeURIComponent(selectedRef)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBook(data && !data.error ? data : null);
      })
      .catch(() => {
        if (!cancelled) setBook(null);
      })
      .finally(() => {
        if (!cancelled) setBookLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRef]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) => s.title?.toLowerCase().includes(q) || s.researchRef?.toLowerCase().includes(q),
    );
  }, [sessions, query]);

  // Stub composer: the UI is a view for now — binding happens through the host
  // agent. Sending just clears the input.
  const onComposerSend = useCallback(() => {
    setComposerValue('');
  }, []);

  return (
    <div className="h-[calc(100vh-66px)] flex flex-col bg-gray-900">
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('title')}</h1>
          <p className="text-xs text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <span className="text-sm text-gray-400">{t('total', { count: sessions.length })}</span>
      </div>

      {error && (
        <div className="mx-8 mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-4 gap-6 px-8 py-4 overflow-hidden">
        {/* Left: inbox of books */}
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
              ? t('filteredCount', { count: filtered.length, total: sessions.length })
              : t('count', { count: filtered.length })}
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {loading && sessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {sessions.length === 0 ? t('emptyState') : t('noMatch')}
              </div>
            ) : (
              filtered.map((s) => {
                const isSelected = s.researchRef === selectedRef;
                return (
                  <button
                    key={s.researchRef}
                    type="button"
                    onClick={() => setSelectedRef(s.researchRef)}
                    className={`w-full text-left border rounded-lg p-3 cursor-pointer transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-900/30'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-sm font-semibold text-gray-200 truncate">{s.title}</span>
                      <span className="text-xs text-gray-500 shrink-0">{timeAgo(s.updatedAt)}</span>
                    </div>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                        STATUS_STYLES[s.status] || STATUS_STYLES.open
                      }`}
                    >
                      {statusLabel(s.status)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: notebook space */}
        <div className="col-span-3 flex flex-col overflow-hidden">
          {!selectedRef ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          ) : bookLoading && !book ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">{t('loading')}</p>
            </div>
          ) : book ? (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <Notebook book={book} t={t} kindLabel={kindLabel} statusLabel={statusLabel} />
              </div>
              {/* Stubbed composer — like the chat builder bottom bar. */}
              <div className="shrink-0">
                <div className="px-4 pt-2 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    {t('composerHeading')}
                  </span>
                  <span className="text-[11px] text-gray-600">{t('composerStub')}</span>
                </div>
                <ModularChatInput
                  value={composerValue}
                  onChange={setComposerValue}
                  onSend={onComposerSend}
                  showAttachButton
                  placeholder={t('composerPlaceholder')}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Notebook({ book, t, kindLabel, statusLabel }) {
  const session = book.session || {};
  const items = Array.isArray(book.items) ? book.items : [];
  const abstracts = Array.isArray(book.abstracts) ? book.abstracts : [];

  return (
    <div className="space-y-4">
      {/* Book header */}
      <div className="border border-gray-700 rounded-lg p-6 bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-100 truncate">{session.title}</h2>
            <p className="font-mono text-xs text-gray-500 mt-1">{session.researchRef}</p>
          </div>
          <span
            className={`text-xs uppercase tracking-wide px-2 py-1 rounded border shrink-0 ${
              STATUS_STYLES[session.status] || STATUS_STYLES.open
            }`}
          >
            {statusLabel(session.status)}
          </span>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span>{t('itemsCount', { count: items.length })}</span>
          <span>{t('createdAt', { timestamp: formatTimestamp(session.createdAt) })}</span>
          <span>{t('updatedAt', { timestamp: formatTimestamp(session.updatedAt) })}</span>
        </div>
      </div>

      {/* Items — links to storage / sources, mirroring get_research */}
      <Section title={t('itemsHeading')}>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">{t('itemsEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="border border-gray-700 rounded-md p-3 bg-gray-900/60">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-600 text-gray-300">
                    {kindLabel(it.kind)}
                  </span>
                  {it.title && (
                    <span className="text-sm font-medium text-gray-200 truncate">{it.title}</span>
                  )}
                  <span className="text-[11px] text-gray-600 ml-auto shrink-0">
                    {timeAgo(it.createdAt)}
                  </span>
                </div>
                {it.body && (
                  <p className="text-xs text-gray-400 whitespace-pre-wrap line-clamp-3">{it.body}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  {it.sourceUrl && (
                    <a
                      href={it.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-teal-400 hover:text-teal-300 truncate"
                    >
                      {t('openSource')} ↗
                    </a>
                  )}
                  {it.mediaRef && (
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      <span className="font-mono">{it.mediaRef}</span>
                      <span className="text-gray-600">· {t('viewStorage')}</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Abstracts — syntheses, with plan links when forged */}
      <Section title={t('abstractsHeading')}>
        {abstracts.length === 0 ? (
          <p className="text-sm text-gray-500">{t('abstractsEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {abstracts.map((a) => {
              const rec = a.assessment?.recommendation;
              const missing = Array.isArray(a.assessment?.missing) ? a.assessment.missing : [];
              return (
                <li key={a.id} className="border border-gray-700 rounded-md p-3 bg-gray-900/60">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                    <span className="text-gray-600">
                      {t('synthesizedAt', { timestamp: formatTimestamp(a.createdAt) })}
                    </span>
                    <span className="text-gray-600">
                      {t('snapshotItems', { count: a.itemCount })}
                    </span>
                    {a.planRef ? (
                      <a
                        href="/plan"
                        className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
                      >
                        {t('forgedPlan')}: <span className="font-mono">{a.planRef}</span> ↗
                      </a>
                    ) : rec === 'keep_researching' ? (
                      <span className="text-amber-400">{t('keepResearching')}</span>
                    ) : null}
                  </div>
                  {!a.planRef && missing.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('missingLabel')}: {missing.join('; ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
      <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}
