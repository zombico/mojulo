'use client';

/**
 * /stashes/[ref] — stash detail page with structural-edit affordances.
 *
 * Header has inline title rename + status toggle. Drawer rail has "+ New
 * drawer" inline input and per-drawer rename. Each item card has a move-to-
 * drawer dropdown and an archive button (with the two-step confirm flow for
 * cook-cited items). No content edit (update_item) yet — that ships with the
 * gather UI in step 5.
 *
 * Renderers shipped: text / markdown / image / svg / link. Script and pointer
 * fall to small placeholder cards. See
 * lite-template/integration/app-system/0601/STASH_VIEW_LAYER.md.
 */

import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'isomorphic-dompurify';

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

const ROOT_KEY = '__root__';

export default function StashDetailPage({ params }) {
  const { ref } = use(params);
  const t = useTranslations('stashes');
  const tDetail = useTranslations('stashes.detail');
  const tTypes = useTranslations('stashes.detail.itemTypes');
  const tActions = useTranslations('stashes.actions');

  const [stash, setStash] = useState(null);
  const [drawers, setDrawers] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState(ROOT_KEY);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(ref)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStash(data.stash || null);
      setDrawers(Array.isArray(data.drawers) ? data.drawers : []);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [ref]);

  useEffect(() => {
    load();
  }, [load]);

  const itemsByDrawer = useMemo(() => {
    const map = new Map();
    map.set(ROOT_KEY, []);
    for (const d of drawers) map.set(d.name, []);
    for (const it of items) {
      const key = it.drawer || ROOT_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    return map;
  }, [drawers, items]);

  // If the selected drawer was renamed, follow it. If it was removed (not yet
  // possible — we don't support drawer delete here), fall back to root.
  useEffect(() => {
    if (selectedDrawer === ROOT_KEY) return;
    if (!drawers.some((d) => d.name === selectedDrawer)) {
      setSelectedDrawer(ROOT_KEY);
    }
  }, [drawers, selectedDrawer]);

  const visibleItems = itemsByDrawer.get(selectedDrawer) || [];

  if (notFound) {
    return (
      <div className="min-h-[calc(100vh-66px)] bg-gray-900">
        <div className="px-8 pt-6 pb-4 max-w-3xl mx-auto">
          <Link href="/stashes" className="text-xs text-teal-400 hover:text-teal-300">
            ← {tDetail('back')}
          </Link>
          <div className="mt-6 border border-gray-700 rounded-lg p-8 bg-gray-800 text-center">
            <h1 className="text-lg font-semibold text-gray-100">{tDetail('notFoundTitle')}</h1>
            <p className="text-sm text-gray-400 mt-2">{tDetail('notFoundBody')}</p>
            <p className="font-mono text-[11px] text-gray-600 mt-3">{ref}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-66px)] bg-gray-900">
      <div className="px-8 pt-6 pb-12 max-w-6xl mx-auto">
        <Link href="/stashes" className="text-xs text-teal-400 hover:text-teal-300">
          ← {tDetail('back')}
        </Link>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        {loading && !stash ? (
          <div className="mt-8 text-center text-gray-500 text-sm">{tDetail('loading')}</div>
        ) : stash ? (
          <>
            <Header
              stash={stash}
              drawerCount={drawers.length}
              itemCount={items.length}
              t={t}
              tActions={tActions}
              onUpdated={(next) => setStash(next)}
            />

            <div className="mt-6 grid gap-6 grid-cols-[240px_minmax(0,1fr)]">
              <DrawerRail
                stashRef={ref}
                drawers={drawers}
                itemsByDrawer={itemsByDrawer}
                selected={selectedDrawer}
                onSelect={setSelectedDrawer}
                onChanged={load}
                tDetail={tDetail}
                tActions={tActions}
              />
              <ItemList
                items={visibleItems}
                stashRef={ref}
                drawers={drawers}
                onChanged={load}
                tDetail={tDetail}
                tTypes={tTypes}
                tActions={tActions}
                isEmpty={items.length === 0}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Header({ stash, drawerCount, itemCount, t, tActions, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stash.title || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setErr(tActions('titleEmpty'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(stash.stashRef)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tActions('renameFailed'));
      onUpdated(body.stash);
      setEditing(false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [draft, stash.stashRef, tActions, onUpdated]);

  const toggleStatus = useCallback(async () => {
    const nextStatus = stash.status === 'open' ? 'archived' : 'open';
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(stash.stashRef)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tActions('statusChangeFailed'));
      onUpdated(body.stash);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [stash.status, stash.stashRef, tActions, onUpdated]);

  return (
    <div className="mt-4 border border-gray-700 rounded-lg p-6 bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  else if (e.key === 'Escape') {
                    setEditing(false);
                    setDraft(stash.title || '');
                    setErr('');
                  }
                }}
                disabled={busy}
                className="flex-1 px-3 py-1.5 border border-gray-600 rounded text-base font-semibold bg-gray-900 text-gray-100 focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="px-3 py-1.5 text-xs border border-teal-500 rounded bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {tActions('save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(stash.title || '');
                  setErr('');
                }}
                disabled={busy}
                className="px-3 py-1.5 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 disabled:opacity-50"
              >
                {tActions('cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing(true);
                setDraft(stash.title || '');
              }}
              className="text-left group inline-flex items-center gap-2 max-w-full"
            >
              <h1 className="text-xl font-bold text-gray-100 truncate group-hover:text-teal-300">
                {stash.title}
              </h1>
              <span className="text-[11px] text-gray-500 group-hover:text-teal-300">
                ({tActions('rename')})
              </span>
            </button>
          )}
          <p className="font-mono text-xs text-gray-500 mt-1">{stash.stashRef}</p>
        </div>
        <button
          type="button"
          onClick={toggleStatus}
          disabled={busy}
          className={`text-xs uppercase tracking-wide px-2 py-1 rounded border shrink-0 hover:bg-gray-700/40 transition disabled:opacity-50 ${
            STATUS_STYLES[stash.status] || STATUS_STYLES.open
          }`}
        >
          {stash.status === 'archived' ? tActions('unarchive') : tActions('archive')}
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
        <span>{t('itemCount', { count: itemCount })}</span>
        <span>{t('drawerCount', { count: drawerCount })}</span>
        <span>{t('createdAt', { timestamp: formatTimestamp(stash.createdAt) })}</span>
        <span>{t('updatedAt', { timestamp: formatTimestamp(stash.updatedAt) })}</span>
      </div>
    </div>
  );
}

function DrawerRail({
  stashRef,
  drawers,
  itemsByDrawer,
  selected,
  onSelect,
  onChanged,
  tDetail,
  tActions,
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [renamingName, setRenamingName] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameErr, setRenameErr] = useState('');

  const mintDrawer = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/stashes/${encodeURIComponent(stashRef)}/drawers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tDetail('drawerSaveError'));
      setNewName('');
      setShowNew(false);
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [newName, stashRef, tDetail, onChanged]);

  const renameDrawer = useCallback(async () => {
    const trimmed = renameDraft.trim();
    if (!trimmed || !renamingName) return;
    if (trimmed === renamingName) {
      setRenamingName(null);
      setRenameDraft('');
      return;
    }
    setBusy(true);
    setRenameErr('');
    try {
      const res = await fetch(
        `/api/stashes/${encodeURIComponent(stashRef)}/drawers/${encodeURIComponent(renamingName)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tDetail('drawerRenameError'));
      // If the rail had this drawer selected, swing the selection to its new name.
      if (selected === renamingName) onSelect(trimmed);
      setRenamingName(null);
      setRenameDraft('');
      await onChanged();
    } catch (e) {
      setRenameErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [renameDraft, renamingName, stashRef, selected, onSelect, tDetail, onChanged]);

  const rows = [
    { key: ROOT_KEY, label: tDetail('rootDrawer'), renamable: false },
    ...drawers.map((d) => ({ key: d.name, label: d.name, renamable: true })),
  ];

  return (
    <aside className="border border-gray-700 rounded-lg bg-gray-800/60 p-2 self-start">
      <ul className="space-y-1">
        {rows.map((row) => {
          const count = (itemsByDrawer.get(row.key) || []).length;
          const isActive = selected === row.key;
          const isRenaming = renamingName === row.key;

          if (isRenaming) {
            return (
              <li key={row.key} className="px-2 py-1.5 border border-teal-500 rounded-md bg-gray-900">
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') renameDrawer();
                      else if (e.key === 'Escape') {
                        setRenamingName(null);
                        setRenameDraft('');
                        setRenameErr('');
                      }
                    }}
                    disabled={busy}
                    className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-600 rounded bg-gray-900 text-gray-100 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={renameDrawer}
                    disabled={busy}
                    className="px-2 py-1 text-[11px] border border-teal-500 rounded bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"
                  >
                    {tActions('save')}
                  </button>
                </div>
                {renameErr && <p className="text-[11px] text-red-400 mt-1">{renameErr}</p>}
              </li>
            );
          }

          return (
            <li key={row.key} className="relative group">
              <button
                type="button"
                onClick={() => onSelect(row.key)}
                className={`w-full text-left px-3 py-2 rounded-md transition flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-teal-900/30 border border-teal-500 text-teal-200'
                    : 'border border-transparent text-gray-300 hover:bg-gray-700 hover:text-gray-100'
                }`}
              >
                <span className="text-sm truncate pr-12">{row.label}</span>
                <span className="text-[11px] text-gray-500 shrink-0">
                  {tDetail('drawerItemCount', { count })}
                </span>
              </button>
              {row.renamable && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingName(row.key);
                    setRenameDraft(row.key);
                    setRenameErr('');
                  }}
                  disabled={busy}
                  className="absolute right-12 top-1.5 px-1.5 py-0.5 text-[10px] border border-gray-600 rounded bg-gray-900/80 text-gray-400 opacity-0 group-hover:opacity-100 transition hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
                  title={tDetail('renameDrawerLabel')}
                >
                  {tActions('rename')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 border-t border-gray-700 pt-2">
        {showNew ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') mintDrawer();
                  else if (e.key === 'Escape') {
                    setShowNew(false);
                    setNewName('');
                    setErr('');
                  }
                }}
                disabled={busy}
                placeholder={tDetail('newDrawerPlaceholder')}
                className="flex-1 min-w-0 px-2 py-1 text-xs border border-gray-600 rounded bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
              />
              <button
                type="button"
                onClick={mintDrawer}
                disabled={busy || !newName.trim()}
                className="px-2 py-1 text-[11px] border border-teal-500 rounded bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {tActions('save')}
              </button>
            </div>
            {err && <p className="text-[11px] text-red-400">{err}</p>}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="w-full px-3 py-1.5 text-xs text-gray-400 border border-dashed border-gray-700 rounded hover:border-teal-500 hover:text-teal-300 transition"
          >
            + {tDetail('newDrawer')}
          </button>
        )}
      </div>
    </aside>
  );
}

function ItemList({ items, stashRef, drawers, onChanged, tDetail, tTypes, tActions, isEmpty }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm border border-dashed border-gray-700 rounded-lg">
        {isEmpty ? tDetail('noItemsInStash') : tDetail('noItemsInDrawer')}
      </div>
    );
  }
  return (
    <div className="space-y-4 min-w-0">
      {items.map((it) => (
        <ItemCard
          key={it.id}
          item={it}
          stashRef={stashRef}
          drawers={drawers}
          onChanged={onChanged}
          tDetail={tDetail}
          tTypes={tTypes}
          tActions={tActions}
        />
      ))}
    </div>
  );
}

function ItemCard({ item, stashRef, drawers, onChanged, tDetail, tTypes, tActions }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pendingArchive, setPendingArchive] = useState(null);

  const moveTo = useCallback(async (drawerName) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/stashes/${encodeURIComponent(stashRef)}/items/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drawer: drawerName }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tDetail('moveError'));
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [item.id, stashRef, onChanged, tDetail]);

  const archive = useCallback(async (confirm) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(
        `/api/stashes/${encodeURIComponent(stashRef)}/items/${item.id}/archive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirm }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || tDetail('archiveError'));
      if (body.pendingConfirm) {
        setPendingArchive(body);
        return;
      }
      setPendingArchive(null);
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [item.id, stashRef, onChanged, tDetail]);

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-700 bg-gray-800/80">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-600 text-gray-300">
            {tTypes(item.type)}
          </span>
          {item.title && (
            <span className="text-sm font-medium text-gray-200 truncate">{item.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DrawerSelect
            value={item.drawer || ''}
            drawers={drawers}
            disabled={busy}
            onChange={(v) => moveTo(v || null)}
            tDetail={tDetail}
          />
          <button
            type="button"
            onClick={() => archive(false)}
            disabled={busy}
            className="px-2 py-1 text-[11px] border border-gray-600 rounded text-gray-300 hover:border-red-500 hover:text-red-300 disabled:opacity-50"
          >
            {tDetail('archive')}
          </button>
          <span className="text-[11px] text-gray-500 font-mono">#{item.id}</span>
        </div>
      </div>
      {(err || pendingArchive) && (
        <div className="px-4 py-2 bg-red-900/20 border-b border-red-700/40">
          {err && <p className="text-xs text-red-400">{err}</p>}
          {pendingArchive && (
            <div className="text-xs text-amber-300 space-y-2">
              <p>
                {tDetail('archiveWarning', { cookCount: pendingArchive.references?.cookCount || 0 })}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => archive(true)}
                  disabled={busy}
                  className="px-2 py-1 border border-red-500 rounded bg-red-900/40 text-red-200 hover:bg-red-900/60 disabled:opacity-50"
                >
                  {tDetail('archiveProceed')}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingArchive(null)}
                  disabled={busy}
                  className="px-2 py-1 border border-gray-600 rounded text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                >
                  {tDetail('archiveCancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="p-4 min-w-0">
        <ItemBody item={item} stashRef={stashRef} tDetail={tDetail} />
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-3 text-xs text-teal-400 hover:text-teal-300 truncate max-w-full"
          >
            {tDetail('openSource')}: {item.sourceUrl} ↗
          </a>
        )}
      </div>
    </div>
  );
}

function DrawerSelect({ value, drawers, disabled, onChange, tDetail }) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1 text-[11px] border border-gray-600 rounded bg-gray-900 text-gray-300 hover:border-teal-500 disabled:opacity-50 focus:outline-none focus:border-teal-500"
    >
      <option value="">{tDetail('rootDrawer')}</option>
      {drawers.map((d) => (
        <option key={d.name} value={d.name}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

function ItemBody({ item, stashRef, tDetail }) {
  switch (item.type) {
    case 'text':
      return <TextBody body={item.body} />;
    case 'markdown':
      return <MarkdownBody body={item.bodyMd} />;
    case 'image':
      return <ImageBody item={item} stashRef={stashRef} tDetail={tDetail} />;
    case 'svg':
      return <SvgBody body={item.body} tDetail={tDetail} />;
    case 'link':
      return <LinkBody item={item} tDetail={tDetail} />;
    case 'script':
      return <ScriptStub item={item} tDetail={tDetail} />;
    case 'pointer':
      return <PointerStub item={item} tDetail={tDetail} />;
    default:
      return <p className="text-xs text-gray-500">{tDetail('deferredRenderer')}</p>;
  }
}

function TextBody({ body }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-200 leading-relaxed">
      {body || ''}
    </pre>
  );
}

function MarkdownBody({ body }) {
  return (
    <div className="markdown-body text-sm text-gray-200 leading-relaxed space-y-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-gray-100" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-semibold text-gray-100 mt-3" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-semibold text-gray-100 mt-2" {...props} />,
          p: ({ node, ...props }) => <p className="text-sm" {...props} />,
          a: ({ node, ...props }) => (
            <a className="text-teal-400 hover:text-teal-300 underline" target="_blank" rel="noreferrer" {...props} />
          ),
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code className="font-mono text-[12px] bg-gray-900/80 border border-gray-700 px-1 py-0.5 rounded text-teal-300" {...props} />
            ) : (
              <code className="font-mono text-[12px]" {...props} />
            ),
          pre: ({ node, ...props }) => (
            <pre className="bg-gray-900/80 border border-gray-700 rounded p-3 overflow-x-auto text-[12px]" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-2 border-teal-700 pl-3 text-gray-300 italic" {...props} />
          ),
          table: ({ node, ...props }) => (
            <table className="border-collapse text-[12px] my-2" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="border border-gray-700 px-2 py-1 text-left bg-gray-800/80" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-gray-700 px-2 py-1 align-top" {...props} />
          ),
        }}
      >
        {body || ''}
      </ReactMarkdown>
    </div>
  );
}

function ImageBody({ item, stashRef, tDetail }) {
  const [failed, setFailed] = useState(false);
  const meta = item.metadata || {};
  if (failed) {
    return (
      <div className="text-xs text-gray-500">
        <p>{tDetail('imageFailed')}</p>
        <p className="font-mono mt-1">{item.mediaRef}</p>
      </div>
    );
  }
  return (
    <figure className="space-y-2">
      <img
        src={`/api/stashes/${encodeURIComponent(stashRef)}/media/${item.id}`}
        alt={item.title || meta.alt || tDetail('imageAlt')}
        onError={() => setFailed(true)}
        className="max-w-full h-auto rounded border border-gray-700 bg-gray-900"
      />
      {(meta.width || meta.height || meta.mime) && (
        <figcaption className="text-[11px] text-gray-500 font-mono">
          {tDetail('imageMetaLine', {
            width: meta.width || '?',
            height: meta.height || '?',
            mime: meta.mime || 'image/?',
          })}
        </figcaption>
      )}
    </figure>
  );
}

function SvgBody({ body, tDetail }) {
  const sanitized = useMemo(() => {
    if (!body) return '';
    return DOMPurify.sanitize(body, {
      USE_PROFILES: { svg: true, svgFilters: true },
    });
  }, [body]);
  return (
    <div
      role="img"
      aria-label={tDetail('svgPreview')}
      className="max-w-full overflow-x-auto bg-gray-900 border border-gray-700 rounded p-2"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

function LinkBody({ item, tDetail }) {
  const meta = item.metadata || {};
  return (
    <div className="space-y-1">
      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-teal-400 hover:text-teal-300 font-medium break-all"
      >
        {tDetail('linkOpen')} ↗
      </a>
      {meta.description && (
        <p className="text-xs text-gray-400">{meta.description}</p>
      )}
    </div>
  );
}

function ScriptStub({ item, tDetail }) {
  const meta = item.metadata || {};
  const bytes = (item.body || '').length;
  return (
    <div className="text-xs text-gray-400 space-y-1">
      <p className="text-gray-300">{tDetail('stubScriptTitle')}</p>
      <p>{tDetail('stubScriptHint', { language: meta.language || '?', bytes })}</p>
      <p className="text-gray-500">{tDetail('deferredRenderer')}</p>
    </div>
  );
}

function PointerStub({ item, tDetail }) {
  const meta = item.metadata || {};
  return (
    <div className="text-xs text-gray-400 space-y-1">
      <p className="text-gray-300">
        {tDetail('stubPointerTitle')}
        {meta.label ? <span className="ml-2 text-gray-200">{meta.label}</span> : null}
      </p>
      <p className="font-mono">
        {tDetail('stubPointerHint', { nodeRef: meta.node_ref || '?' })}
      </p>
      <p className="text-gray-500">{tDetail('deferredRenderer')}</p>
    </div>
  );
}
