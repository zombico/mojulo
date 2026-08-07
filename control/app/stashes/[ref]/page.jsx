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
 * fall to small placeholder cards. text / markdown / svg / link items have an
 * inline edit affordance that PATCHes /api/stashes/[ref]/items/[id] with
 * content fields; the per-type contract gate re-runs on the merged state
 * server-side. Image edits stay agent-only (binary re-upload). See
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
              <div className="min-w-0 space-y-4">
                <GatherPanel
                  stashRef={ref}
                  currentDrawer={selectedDrawer === ROOT_KEY ? null : selectedDrawer}
                  onChanged={load}
                  tDetail={tDetail}
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
  const tPanel = useTranslations('stashes.detail.panel');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pendingArchive, setPendingArchive] = useState(null);
  const [editing, setEditing] = useState(false);

  const editable = item.type === 'text' || item.type === 'markdown' || item.type === 'svg';

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
            disabled={busy || editing}
            onChange={(v) => moveTo(v || null)}
            tDetail={tDetail}
          />
          {editable && !editing && (
            <button
              type="button"
              onClick={() => {
                setErr('');
                setPendingArchive(null);
                setEditing(true);
              }}
              disabled={busy}
              className="px-2 py-1 text-[11px] border border-gray-600 rounded text-gray-300 hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
            >
              {tActions('edit')}
            </button>
          )}
          <button
            type="button"
            onClick={() => archive(false)}
            disabled={busy || editing}
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
        {editing ? (
          <ItemEditor
            item={item}
            stashRef={stashRef}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              await onChanged();
            }}
            tPanel={tPanel}
          />
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ItemEditor — inline edit for text / markdown / svg items.
// Type is immutable; we PATCH /api/stashes/[ref]/items/[id] with the typed
// body field (`body` for text, `body_md` for markdown, `body_svg` for svg)
// plus title + source_url, and the substrate contract gate re-runs on the
// merged state. Metadata stays MCP-only (image content_hash and friends).
// ---------------------------------------------------------------------------

function ItemEditor({ item, stashRef, onCancel, onSaved, tPanel }) {
  const initialBody = item.type === 'markdown' ? item.bodyMd || '' : item.body || '';
  const [title, setTitle] = useState(item.title || '');
  const [sourceUrl, setSourceUrl] = useState(item.sourceUrl || '');
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const cap =
    item.type === 'markdown'
      ? SIZE_CAPS.markdown_body
      : item.type === 'svg'
        ? SIZE_CAPS.svg_body
        : SIZE_CAPS.text_body;
  const tooLong = body.length > cap;
  const badSvgShape =
    item.type === 'svg' && body.length > 0 && !/^\s*<(\?xml|svg)\b/i.test(body);
  const canSubmit = !busy && body.trim().length > 0 && !tooLong && !badSvgShape;

  const sanitizedSvg = useMemo(() => {
    if (item.type !== 'svg' || !body || badSvgShape) return '';
    return DOMPurify.sanitize(body, { USE_PROFILES: { svg: true, svgFilters: true } });
  }, [item.type, body, badSvgShape]);

  const save = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const trimmedTitle = title.trim();
      const payload = {
        title: trimmedTitle ? trimmedTitle : null,
        source_url: sourceUrl || null,
      };
      if (item.type === 'text') payload.body = body;
      else if (item.type === 'markdown') payload.body_md = body;
      else if (item.type === 'svg') payload.body_svg = body;
      const res = await fetch(
        `/api/stashes/${encodeURIComponent(stashRef)}/items/${item.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || tPanel('saveError'));
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [body, title, sourceUrl, item, stashRef, onSaved, tPanel]);

  let inlineError = err;
  if (!inlineError && tooLong) inlineError = tPanel('tooLong', { limit: cap });
  else if (!inlineError && badSvgShape) inlineError = tPanel('svgBadShape');

  return (
    <PanelShell
      tPanel={tPanel}
      onCancel={onCancel}
      onSubmit={save}
      canSubmit={canSubmit}
      busy={busy}
      error={inlineError}
    >
      <TitleField value={title} onChange={setTitle} tPanel={tPanel} disabled={busy} />
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('bodyLabel')}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={busy}
          rows={item.type === 'markdown' ? 12 : 10}
          className={`w-full px-3 py-2 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 focus:outline-none focus:border-teal-500 ${
            item.type === 'svg' || item.type === 'markdown' ? 'font-mono' : ''
          }`}
        />
        <p className="text-[11px] text-gray-600 mt-1 font-mono">
          {body.length.toLocaleString()} / {cap.toLocaleString()}
        </p>
      </div>

      {item.type === 'markdown' && body.length > 0 && (
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            {tPanel('preview')}
          </label>
          <div className="p-3 border border-gray-700 rounded text-sm bg-gray-900/60 overflow-auto max-h-64">
            <MarkdownBody body={body} />
          </div>
        </div>
      )}

      {item.type === 'svg' && sanitizedSvg && (
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            {tPanel('preview')}
          </label>
          <div className="border border-gray-700 rounded p-2 bg-gray-900 max-h-64 overflow-auto">
            <div
              role="img"
              aria-label={tPanel('preview')}
              dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
            />
          </div>
        </div>
      )}

      <SourceUrlField
        value={sourceUrl}
        onChange={setSourceUrl}
        tPanel={tPanel}
        disabled={busy}
      />
    </PanelShell>
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
    case 'sketch':
      return <SketchBody item={item} tDetail={tDetail} />;
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

function SketchBody({ item, tDetail }) {
  const [failed, setFailed] = useState(false);
  const meta = item.metadata || {};
  const sketchRef = meta.sketch_ref;
  if (!sketchRef) {
    return <p className="text-xs text-gray-500">{tDetail('sketchFailed')}</p>;
  }
  // The sketches API renders a self-contained SVG with CSS variables already
  // inlined — fine as an <img src>. Resolution is live: edits to the source
  // sketch propagate immediately (no snapshot, citable-atoms posture). A
  // deleted source surfaces as the failed-load fallback below.
  return (
    <figure className="space-y-2">
      {failed ? (
        <div className="text-xs text-gray-500">
          <p>{tDetail('sketchFailed')}</p>
          <p className="font-mono mt-1">{sketchRef}</p>
        </div>
      ) : (
        <img
          src={`/api/sketches/${encodeURIComponent(sketchRef)}/svg?inline=1`}
          alt={meta.label || sketchRef}
          onError={() => setFailed(true)}
          className="max-w-full h-auto rounded border border-gray-700 bg-gray-900"
        />
      )}
      <figcaption className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
        <a
          href={`/sketches/${encodeURIComponent(sketchRef)}`}
          target="_blank"
          rel="noreferrer"
          className="text-teal-400 hover:text-teal-300"
        >
          {tDetail('openSketch')} ↗
        </a>
        <span>{sketchRef}</span>
        {meta.label && <span className="font-sans text-gray-400">· {meta.label}</span>}
      </figcaption>
    </figure>
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

// ---------------------------------------------------------------------------
// Gather UI — `+ Add` picker + 4 typed panels.
// Scope follows lite-template/integration/app-system/0602/STASH_RELATIONAL_ATOMS.md:
// text/markdown share a single "text block" panel (format toggle maps to
// substrate types); image / svg / link each get their own. Script and pointer
// stay agent-only. Browser pre-validates for UX, the substrate gate stays the
// single point of truth.
// ---------------------------------------------------------------------------

const SIZE_CAPS = {
  text_body: 64 * 1024,
  markdown_body: 256 * 1024,
  svg_body: 128 * 1024,
  image_bytes: 10 * 1024 * 1024,
};

function GatherPanel({ stashRef, currentDrawer, onChanged, tDetail }) {
  const [mode, setMode] = useState('closed'); // 'closed' | 'picker' | 'text' | 'image' | 'svg' | 'link'
  const tPanel = useTranslations('stashes.detail.panel');
  const tPicker = useTranslations('stashes.detail.picker');

  const close = useCallback(() => setMode('closed'), []);
  const finished = useCallback(async () => {
    await onChanged();
    setMode('closed');
  }, [onChanged]);

  if (mode === 'closed') {
    return (
      <div className="border border-dashed border-gray-700 rounded-lg p-3">
        <button
          type="button"
          onClick={() => setMode('picker')}
          className="text-sm text-gray-300 hover:text-teal-300"
        >
          {tDetail('addItem')}
        </button>
        <p className="text-[11px] text-gray-600 mt-1">{tDetail('agentTypesFooter')}</p>
      </div>
    );
  }

  if (mode === 'picker') {
    return (
      <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
        <div className="grid grid-cols-2 gap-2">
          {(['text', 'image', 'svg', 'link', 'sketch']).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className="px-3 py-3 text-sm border border-gray-700 rounded hover:border-teal-500 hover:text-teal-300 transition text-left"
            >
              {tPicker(k)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          className="mt-3 text-[11px] text-gray-500 hover:text-gray-300"
        >
          {tPanel('cancel')}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-teal-500 rounded-lg p-4 bg-gray-800">
      {mode === 'text' && (
        <TextBlockPanel
          stashRef={stashRef}
          drawer={currentDrawer}
          onCancel={close}
          onSaved={finished}
          tPanel={tPanel}
        />
      )}
      {mode === 'image' && (
        <ImagePanel
          stashRef={stashRef}
          drawer={currentDrawer}
          onCancel={close}
          onSaved={finished}
          tPanel={tPanel}
        />
      )}
      {mode === 'svg' && (
        <SvgPanel
          stashRef={stashRef}
          drawer={currentDrawer}
          onCancel={close}
          onSaved={finished}
          tPanel={tPanel}
        />
      )}
      {mode === 'link' && (
        <LinkPanel
          stashRef={stashRef}
          drawer={currentDrawer}
          onCancel={close}
          onSaved={finished}
          tPanel={tPanel}
        />
      )}
      {mode === 'sketch' && (
        <SketchPickerPanel
          stashRef={stashRef}
          drawer={currentDrawer}
          onCancel={close}
          onSaved={finished}
          tPanel={tPanel}
        />
      )}
    </div>
  );
}

function PanelShell({ tPanel, onCancel, onSubmit, canSubmit, busy, error, children }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy && canSubmit) onSubmit();
      }}
      className="space-y-3"
    >
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 text-xs border border-gray-600 rounded text-gray-300 hover:bg-gray-700 disabled:opacity-50"
        >
          {tPanel('cancel')}
        </button>
        <button
          type="submit"
          disabled={busy || !canSubmit}
          className="px-3 py-1.5 text-xs border border-teal-500 rounded bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50"
        >
          {busy ? tPanel('saving') : tPanel('save')}
        </button>
      </div>
    </form>
  );
}

function TitleField({ value, onChange, tPanel, disabled }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        {tPanel('titleLabel')}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={tPanel('titlePlaceholder')}
        className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
      />
    </div>
  );
}

function SourceUrlField({ value, onChange, tPanel, disabled }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        {tPanel('sourceUrlLabel')}
      </label>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={tPanel('sourceUrlPlaceholder')}
        className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
      />
    </div>
  );
}

function postJson(stashRef, payload) {
  return fetch(`/api/stashes/${encodeURIComponent(stashRef)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}));
  return body.error || fallback;
}

function TextBlockPanel({ stashRef, drawer, onCancel, onSaved, tPanel }) {
  const [format, setFormat] = useState('markdown'); // markdown | html | plain
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const cap = format === 'plain' ? SIZE_CAPS.text_body : SIZE_CAPS.markdown_body;
  const tooLong = body.length > cap;
  const canSubmit = body.trim().length > 0 && !tooLong;

  const submit = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      let payload;
      if (format === 'plain') {
        payload = { type: 'text', body, title: title || undefined, drawer: drawer || undefined, source_url: sourceUrl || undefined };
      } else {
        payload = {
          type: 'markdown',
          body_md: body,
          title: title || undefined,
          drawer: drawer || undefined,
          source_url: sourceUrl || undefined,
        };
        if (format === 'html') payload.metadata = { format: 'html' };
      }
      const res = await postJson(stashRef, payload);
      if (!res.ok) throw new Error(await readError(res, tPanel('saveError')));
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [body, format, title, sourceUrl, drawer, stashRef, onSaved, tPanel]);

  const preview = useMemo(() => {
    if (format === 'plain') return null;
    if (format === 'html') return DOMPurify.sanitize(body, { USE_PROFILES: { html: true } });
    return null;
  }, [body, format]);

  return (
    <PanelShell
      tPanel={tPanel}
      onCancel={onCancel}
      onSubmit={submit}
      canSubmit={canSubmit}
      busy={busy}
      error={err || (tooLong ? tPanel('tooLong', { limit: cap }) : '')}
    >
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('format')}
        </label>
        <div className="flex items-center gap-2 text-xs">
          {[
            { key: 'markdown', label: tPanel('formatMarkdown') },
            { key: 'html', label: tPanel('formatHtml') },
            { key: 'plain', label: tPanel('formatPlain') },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFormat(opt.key)}
              className={`px-2.5 py-1 rounded border transition ${
                format === opt.key
                  ? 'border-teal-500 bg-teal-900/30 text-teal-300'
                  : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <TitleField value={title} onChange={setTitle} tPanel={tPanel} disabled={busy} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            {tPanel('bodyLabel')}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={busy}
            placeholder={tPanel('bodyPlaceholder')}
            rows={10}
            className="w-full px-3 py-2 border border-gray-600 rounded text-sm font-mono bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
            {tPanel('preview')}
          </label>
          <div className="min-h-[200px] p-3 border border-gray-700 rounded text-sm bg-gray-900/60 overflow-auto">
            {body.length === 0 ? (
              <p className="text-xs text-gray-600">{tPanel('previewEmpty')}</p>
            ) : format === 'plain' ? (
              <pre className="whitespace-pre-wrap font-sans text-gray-200">{body}</pre>
            ) : format === 'html' ? (
              <div
                className="text-gray-200 space-y-2"
                dangerouslySetInnerHTML={{ __html: preview || '' }}
              />
            ) : (
              <MarkdownBody body={body} />
            )}
          </div>
        </div>
      </div>
      <SourceUrlField value={sourceUrl} onChange={setSourceUrl} tPanel={tPanel} disabled={busy} />
    </PanelShell>
  );
}

function ImagePanel({ stashRef, drawer, onCancel, onSaved, tPanel }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [dims, setDims] = useState(null);
  const [title, setTitle] = useState('');
  const [alt, setAlt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      setDims(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    const img = new window.Image();
    img.onload = () => setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setErr(tPanel('imageBadDimensions'));
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, tPanel]);

  const handlePick = useCallback((selected) => {
    setErr('');
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.type?.startsWith('image/')) {
      setErr(tPanel('imageBadMime', { mime: selected.type || '?' }));
      return;
    }
    if (selected.size > SIZE_CAPS.image_bytes) {
      setErr(tPanel('imageTooLarge', { limit: SIZE_CAPS.image_bytes / (1024 * 1024) }));
      return;
    }
    setFile(selected);
  }, [tPanel]);

  const submit = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (title) fd.append('title', title);
      if (alt) fd.append('alt', alt);
      if (sourceUrl) fd.append('sourceUrl', sourceUrl);
      if (drawer) fd.append('drawer', drawer);
      const res = await fetch(`/api/stashes/${encodeURIComponent(stashRef)}/items`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) throw new Error(await readError(res, tPanel('saveError')));
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [file, title, alt, sourceUrl, drawer, stashRef, onSaved, tPanel]);

  return (
    <PanelShell
      tPanel={tPanel}
      onCancel={onCancel}
      onSubmit={submit}
      canSubmit={!!file && !!dims}
      busy={busy}
      error={err}
    >
      <label
        className="flex flex-col items-center justify-center gap-2 border border-dashed border-gray-600 rounded p-6 cursor-pointer hover:border-teal-500 transition"
      >
        <span className="text-sm text-gray-300">{tPanel('imagePick')}</span>
        <span className="text-[11px] text-gray-500">{tPanel('imageDrop')}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => handlePick(e.target.files?.[0] || null)}
          disabled={busy}
          className="hidden"
        />
      </label>
      {previewUrl && (
        <div className="space-y-1">
          <img
            src={previewUrl}
            alt={alt || tPanel('altPlaceholder')}
            className="max-h-48 rounded border border-gray-700"
          />
          {dims && (
            <p className="text-[11px] text-gray-500 font-mono">
              {dims.w}×{dims.h} · {file?.type || ''} · {Math.round((file?.size || 0) / 1024)} KB
            </p>
          )}
        </div>
      )}
      <TitleField value={title} onChange={setTitle} tPanel={tPanel} disabled={busy} />
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('altLabel')}
        </label>
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          disabled={busy}
          placeholder={tPanel('altPlaceholder')}
          className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
      </div>
      <SourceUrlField value={sourceUrl} onChange={setSourceUrl} tPanel={tPanel} disabled={busy} />
    </PanelShell>
  );
}

function SvgPanel({ stashRef, drawer, onCancel, onSaved, tPanel }) {
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const tooLong = body.length > SIZE_CAPS.svg_body;
  const badShape = body.length > 0 && !/^\s*<(\?xml|svg)\b/i.test(body);
  const canSubmit = body.trim().length > 0 && !tooLong && !badShape;

  const sanitizedPreview = useMemo(() => {
    if (!body || badShape) return '';
    return DOMPurify.sanitize(body, { USE_PROFILES: { svg: true, svgFilters: true } });
  }, [body, badShape]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    setErr('');
    try {
      const text = await file.text();
      setBody(text);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await postJson(stashRef, {
        type: 'svg',
        body_svg: body,
        title: title || undefined,
        drawer: drawer || undefined,
        source_url: sourceUrl || undefined,
      });
      if (!res.ok) throw new Error(await readError(res, tPanel('saveError')));
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [body, title, sourceUrl, drawer, stashRef, onSaved, tPanel]);

  let inlineError = err;
  if (!inlineError && tooLong) inlineError = tPanel('tooLong', { limit: SIZE_CAPS.svg_body });
  else if (!inlineError && badShape) inlineError = tPanel('svgBadShape');

  return (
    <PanelShell
      tPanel={tPanel}
      onCancel={onCancel}
      onSubmit={submit}
      canSubmit={canSubmit}
      busy={busy}
      error={inlineError}
    >
      <TitleField value={title} onChange={setTitle} tPanel={tPanel} disabled={busy} />
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('svgPaste')}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={busy}
          rows={8}
          className="w-full px-3 py-2 border border-gray-600 rounded text-xs font-mono bg-gray-900 text-gray-100 focus:outline-none focus:border-teal-500"
        />
        <label className="inline-block mt-2 text-[11px] text-teal-400 hover:text-teal-300 cursor-pointer">
          {tPanel('svgUpload')}
          <input
            type="file"
            accept=".svg,image/svg+xml"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
            disabled={busy}
            className="hidden"
          />
        </label>
      </div>
      {sanitizedPreview && (
        <div className="border border-gray-700 rounded p-2 bg-gray-900 max-h-64 overflow-auto">
          <div
            role="img"
            aria-label={tPanel('preview')}
            dangerouslySetInnerHTML={{ __html: sanitizedPreview }}
          />
        </div>
      )}
      <SourceUrlField value={sourceUrl} onChange={setSourceUrl} tPanel={tPanel} disabled={busy} />
    </PanelShell>
  );
}

function SketchPickerPanel({ stashRef, drawer, onCancel, onSaved, tPanel }) {
  const [sketches, setSketches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/sketches');
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setSketches(Array.isArray(data.sketches) ? data.sketches : []);
      } catch (e) {
        if (!cancelled) setErr(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sketches;
    return sketches.filter(
      (s) => s.title?.toLowerCase().includes(q) || s.ref?.toLowerCase().includes(q),
    );
  }, [sketches, query]);

  const submit = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setErr('');
    try {
      const res = await postJson(stashRef, {
        type: 'sketch',
        drawer: drawer || undefined,
        title: selected.title || undefined,
        metadata: { sketch_ref: selected.ref, label: selected.title || selected.ref },
      });
      if (!res.ok) throw new Error(await readError(res, tPanel('saveError')));
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [selected, drawer, stashRef, onSaved, tPanel]);

  return (
    <PanelShell
      tPanel={tPanel}
      onCancel={onCancel}
      onSubmit={submit}
      canSubmit={!!selected}
      busy={busy}
      error={err}
    >
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={busy}
        placeholder={tPanel('sketchSearchPlaceholder')}
        className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
      />
      <div className="border border-gray-700 rounded bg-gray-900/60 max-h-72 overflow-auto divide-y divide-gray-800">
        {loading ? (
          <p className="px-3 py-4 text-xs text-gray-500 text-center">…</p>
        ) : sketches.length === 0 ? (
          <p className="px-3 py-6 text-xs text-gray-500 text-center">{tPanel('sketchEmpty')}</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-6 text-xs text-gray-500 text-center">{tPanel('sketchNoMatch')}</p>
        ) : (
          filtered.map((s) => {
            const isSelected = selected?.ref === s.ref;
            return (
              <button
                key={s.ref}
                type="button"
                onClick={() => setSelected(s)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${
                  isSelected ? 'bg-teal-900/30 text-teal-200' : 'hover:bg-gray-800 text-gray-200'
                }`}
              >
                <img
                  src={`/api/sketches/${encodeURIComponent(s.ref)}/svg?inline=1`}
                  alt=""
                  className="h-10 w-16 object-contain shrink-0 bg-gray-900 border border-gray-700 rounded"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{s.title || s.ref}</p>
                  <p className="font-mono text-[11px] text-gray-500 truncate">{s.ref}</p>
                </div>
                {isSelected && (
                  <span className="text-[10px] uppercase tracking-wide text-teal-300 shrink-0">
                    {tPanel('sketchPicked')}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </PanelShell>
  );
}

function LinkPanel({ stashRef, drawer, onCancel, onSaved, tPanel }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const urlOk = useMemo(() => {
    if (!url) return null;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, [url]);
  const canSubmit = !!url && urlOk === true && title.trim().length > 0;

  let inlineError = err;
  if (!inlineError && urlOk === false) inlineError = tPanel('urlInvalid');
  else if (!inlineError && url && title.trim().length === 0) inlineError = tPanel('urlTitleRequired');

  const submit = useCallback(async () => {
    setBusy(true);
    setErr('');
    try {
      const payload = {
        type: 'link',
        source_url: url,
        title: title.trim(),
        drawer: drawer || undefined,
      };
      if (description) payload.metadata = { description };
      const res = await postJson(stashRef, payload);
      if (!res.ok) throw new Error(await readError(res, tPanel('saveError')));
      await onSaved();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [url, title, description, drawer, stashRef, onSaved, tPanel]);

  return (
    <PanelShell
      tPanel={tPanel}
      onCancel={onCancel}
      onSubmit={submit}
      canSubmit={canSubmit}
      busy={busy}
      error={inlineError}
    >
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('urlLabel')}
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
          placeholder={tPanel('urlPlaceholder')}
          className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('titleLabel')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          placeholder={tPanel('titlePlaceholder')}
          className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
      </div>
      <div>
        <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {tPanel('descriptionLabel')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          rows={3}
          placeholder={tPanel('descriptionPlaceholder')}
          className="w-full px-3 py-1.5 border border-gray-600 rounded text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
      </div>
    </PanelShell>
  );
}
