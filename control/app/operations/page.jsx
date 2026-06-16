'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

const STATUS_STYLES = {
  active: 'border-teal-500/60 text-teal-300 bg-teal-900/30',
  archived: 'border-gray-600 text-gray-400 bg-gray-700/40',
};

const STATUS_KEY = {
  active: 'statusActive',
  archived: 'statusArchived',
};

const MEMBER_KIND_KEY = {
  bot: 'memberBot',
  app: 'memberApp',
  mcp_orbit: 'memberMcpOrbit',
  cook: 'memberCook',
  catalyst: 'memberCatalyst',
  trigger: 'memberTrigger',
  stash: 'memberStash',
  motion: 'memberMotion',
};

function MapIcon({ className = 'h-12 w-12' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}

export default function OperationsPage() {
  const t = useTranslations('operations');
  const tCommon = useTranslations('common');
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(null);

  const statusLabel = useCallback((s) => (STATUS_KEY[s] ? t(STATUS_KEY[s]) : s), [t]);
  const kindLabel = useCallback(
    (k) => (MEMBER_KIND_KEY[k] ? t(MEMBER_KIND_KEY[k]) : k),
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/operations');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTags(data.tags || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (ref) => {
    if (!ref) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/operations/${encodeURIComponent(ref)}`);
      const data = await res.json();
      setDetail(data && !data.error ? data : null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedRef) {
      setDetail(null);
      return;
    }
    loadDetail(selectedRef);
  }, [selectedRef, loadDetail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter(
      (tag) =>
        tag.title?.toLowerCase().includes(q) ||
        tag.tagRef?.toLowerCase().includes(q),
    );
  }, [tags, query]);

  const activeFiltered = useMemo(() => filtered.filter((tag) => tag.status === 'active'), [filtered]);
  const archivedFiltered = useMemo(() => filtered.filter((tag) => tag.status === 'archived'), [filtered]);

  const handleSelect = useCallback((ref) => {
    setSelectedRef((cur) => (cur === ref ? null : ref));
  }, []);

  const handleSaved = useCallback(
    async (tagRef) => {
      setModal(null);
      await load();
      if (tagRef) {
        setSelectedRef(tagRef);
        loadDetail(tagRef);
      } else if (selectedRef) {
        loadDetail(selectedRef);
      }
    },
    [load, loadDetail, selectedRef],
  );

  const handleToggleArchive = useCallback(async () => {
    if (!detail) return;
    const nextStatus = detail.status === 'active' ? 'archived' : 'active';
    try {
      const res = await fetch(`/api/operations/${encodeURIComponent(detail.tagRef)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await load();
      await loadDetail(detail.tagRef);
    } catch (e) {
      setError(e.message);
    }
  }, [detail, load, loadDetail]);

  const hasAnyTags = tags.length > 0;
  const hasMatches = filtered.length > 0;

  return (
    <main className="min-h-[calc(100vh-66px)] bg-gray-900">
      <div className="px-8 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col items-center text-center select-none">
            <MapIcon className="h-14 w-14 text-teal-300/80" />
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-gray-100">
              {t('title')}
            </h1>
            <p className="mt-2 text-sm text-gray-400 max-w-xl">{t('subtitle')}</p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-700 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={() => setModal({ mode: 'new' })}
              className="px-3 py-2 text-sm border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600 whitespace-nowrap"
            >
              {t('newTag')}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {query
              ? t('filteredCount', { count: filtered.length, total: tags.length })
              : t('count', { count: filtered.length })}
          </p>

          {error && (
            <div className="mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="mt-8">
            {loading && tags.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">{t('loading')}</div>
            ) : !hasMatches ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                {hasAnyTags ? t('noMatch') : t('emptyState')}
              </div>
            ) : (
              <>
                {activeFiltered.length === 0 && archivedFiltered.length > 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    {t('allArchived')}
                  </div>
                )}

                {activeFiltered.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
                    {activeFiltered.map((tag) => (
                      <ConcernCard
                        key={tag.tagRef}
                        tag={tag}
                        isSelected={tag.tagRef === selectedRef}
                        onSelect={handleSelect}
                        statusLabel={statusLabel}
                        t={t}
                      />
                    ))}
                  </div>
                )}

                {archivedFiltered.length > 0 && (
                  <div className="mt-8 border-t border-gray-800 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowArchived((v) => !v)}
                      className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2"
                    >
                      {showArchived
                        ? t('hideArchived', { count: archivedFiltered.length })
                        : t('showArchived', { count: archivedFiltered.length })}
                    </button>
                    {showArchived && (
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-8">
                        {archivedFiltered.map((tag) => (
                          <ConcernCard
                            key={tag.tagRef}
                            tag={tag}
                            isSelected={tag.tagRef === selectedRef}
                            onSelect={handleSelect}
                            statusLabel={statusLabel}
                            t={t}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {selectedRef && (
            <div className="mt-10 border border-teal-500/40 rounded-lg bg-gray-900/60 shadow-lg">
              {detailLoading || !detail ? (
                <div className="px-6 py-10 text-center text-sm text-gray-500">
                  {t('loading')}
                </div>
              ) : (
                <ConcernDetail
                  detail={detail}
                  statusLabel={statusLabel}
                  kindLabel={kindLabel}
                  t={t}
                  tCommon={tCommon}
                  onEdit={() => setModal({ mode: 'edit', tag: detail })}
                  onToggleArchive={handleToggleArchive}
                  onClose={() => setSelectedRef(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {modal && (
        <TagModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? modal.tag : null}
          t={t}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}

function ConcernCard({ tag, isSelected, onSelect, statusLabel, t }) {
  const statusStyle = STATUS_STYLES[tag.status] || 'border-gray-600 text-gray-300 bg-gray-700/40';
  return (
    <button
      type="button"
      onClick={() => onSelect(tag.tagRef)}
      className="group flex flex-col items-center gap-3 text-center"
      aria-pressed={isSelected}
    >
      <div
        className={`relative flex items-center justify-center aspect-square w-full max-w-[160px] rounded-xl border transition ${
          isSelected
            ? 'border-teal-400 bg-teal-900/20 shadow-[0_0_0_2px_rgba(45,212,191,0.25)]'
            : 'border-gray-700 bg-gray-800/50 hover:border-teal-500/60 hover:bg-gray-800'
        }`}
      >
        <span
          className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded border ${statusStyle}`}
        >
          {statusLabel(tag.status)}
        </span>
        <MapIcon
          className={`h-14 w-14 transition ${
            isSelected ? 'text-teal-300' : 'text-gray-500 group-hover:text-teal-300'
          }`}
        />
      </div>
      <div className="w-full max-w-[160px]">
        <div
          className={`text-sm font-medium truncate transition ${
            isSelected ? 'text-gray-100' : 'text-gray-300 group-hover:text-gray-100'
          }`}
        >
          {tag.title}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {t('memberCount', { count: tag.memberTotal })}
        </div>
      </div>
    </button>
  );
}

function ConcernDetail({
  detail,
  statusLabel,
  kindLabel,
  t,
  tCommon,
  onEdit,
  onToggleArchive,
  onClose,
}) {
  const statusStyle = STATUS_STYLES[detail.status] || 'border-gray-600 text-gray-300 bg-gray-700/40';
  const memberGroups = useMemo(() => {
    const groups = {};
    for (const m of detail.members || []) {
      if (!groups[m.memberKind]) groups[m.memberKind] = [];
      groups[m.memberKind].push(m);
    }
    return groups;
  }, [detail.members]);
  const kinds = Object.keys(memberGroups).sort();

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-gray-100 truncate">{detail.title}</h2>
            <span className={`text-xs px-2 py-0.5 rounded border ${statusStyle}`}>
              {statusLabel(detail.status)}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1 font-mono truncate">{detail.tagRef}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {t('createdAt', { timestamp: formatTimestamp(detail.createdAt) })} ·{' '}
            {t('updatedAt', { timestamp: formatTimestamp(detail.updatedAt) })}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs px-2 py-1 border border-gray-600 rounded text-gray-300 hover:border-teal-500 hover:text-teal-300"
          >
            {t('edit')}
          </button>
          <button
            type="button"
            onClick={onToggleArchive}
            className="text-xs px-2 py-1 border border-gray-600 rounded text-gray-300 hover:border-amber-500 hover:text-amber-300"
          >
            {detail.status === 'active' ? t('archive') : t('unarchive')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 border border-gray-600 rounded text-gray-300 hover:border-gray-400 hover:text-gray-100"
            aria-label={tCommon('close')}
          >
            {tCommon('close')}
          </button>
        </div>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-2">{t('descriptorHeading')}</h3>
        <div className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800/50 border border-gray-700 rounded-md px-3 py-2">
          {detail.descriptorMd}
        </div>
        <p className="text-[11px] text-gray-500 mt-1 italic">{t('descriptorNote')}</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-2">
          {t('membersHeading', { count: (detail.members || []).length })}
        </h3>
        <p className="text-[11px] text-gray-500 mb-2 italic">{t('membersNote')}</p>
        {kinds.length === 0 ? (
          <div className="text-sm text-gray-500 italic">{t('membersEmpty')}</div>
        ) : (
          <div className="space-y-4">
            {kinds.map((k) => (
              <div key={k}>
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
                  {kindLabel(k)} · {memberGroups[k].length}
                </div>
                <ul className="space-y-1">
                  {memberGroups[k].map((m) => (
                    <li
                      key={`${m.memberKind}:${m.memberRef}`}
                      className="text-xs text-gray-300 bg-gray-800/40 border border-gray-800 rounded px-2 py-1 font-mono flex items-center justify-between"
                    >
                      <span className="truncate">{m.memberRef}</span>
                      <span className="text-[10px] text-gray-500 ml-2 shrink-0">
                        {formatTimestamp(m.boundAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-200 mb-2">{t('howToHeading')}</h3>
        <p className="text-xs text-gray-400">{t('howToBody')}</p>
      </section>
    </div>
  );
}

function TagModal({ mode, initial, t, onClose, onSaved }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [descriptor, setDescriptor] = useState(initial?.descriptorMd || '');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  const isEdit = mode === 'edit';

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setModalError('');
      const trimmedTitle = title.trim();
      const trimmedDescriptor = descriptor.trim();
      if (!trimmedTitle) {
        setModalError(t('errorTitleRequired'));
        return;
      }
      if (!trimmedDescriptor) {
        setModalError(t('errorDescriptorRequired'));
        return;
      }
      setSaving(true);
      try {
        const url = isEdit
          ? `/api/operations/${encodeURIComponent(initial.tagRef)}`
          : '/api/operations';
        const method = isEdit ? 'PATCH' : 'POST';
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: trimmedTitle, descriptor: trimmedDescriptor }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        onSaved(data.tagRef);
      } catch (err) {
        setModalError(err.message);
      } finally {
        setSaving(false);
      }
    },
    [title, descriptor, isEdit, initial, onSaved, t],
  );

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg max-w-xl w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-1">
          {isEdit ? t('editTagTitle') : t('newTagTitle')}
        </h2>
        <p className="text-xs text-gray-400 mb-4">{t('modalIntro')}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1" htmlFor="ops-title">
              {t('titleLabel')}
            </label>
            <input
              id="ops-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
              autoFocus={!isEdit}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1" htmlFor="ops-descriptor">
              {t('descriptorLabel')}
            </label>
            <textarea
              id="ops-descriptor"
              value={descriptor}
              onChange={(e) => setDescriptor(e.target.value)}
              placeholder={t('descriptorPlaceholder')}
              rows={6}
              className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500 font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1 italic">{t('descriptorHint')}</p>
          </div>

          {modalError && (
            <div className="text-xs text-red-400 bg-red-900/30 border border-red-700 rounded px-2 py-1">
              {modalError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-sm border border-gray-600 rounded-md text-gray-300 hover:border-gray-500 disabled:opacity-50"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-sm border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"
            >
              {saving ? t('saving') : isEdit ? t('saveChanges') : t('forgeTag')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
