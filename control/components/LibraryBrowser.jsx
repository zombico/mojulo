'use client';

/**
 * /library as a folder list.
 *
 * Nothing renders here. A left rail lists All sketches, Unfiled and every folder,
 * then the shelves with their whole-store counts; the body is one table of rows
 * (name, kind, minted, ref) with open / move / delete on hover; the strip under
 * the table shows the focused row's facts and actions and turns into the bulk
 * bar when rows are checked. Seeing a sketch is what /sketches/<ref> is for.
 *
 * The shelf model is untouched: a shelf is still a FETCH SCOPE (library-shelves.js),
 * so every typed shelf lists its whole bucket and only `recent` is capped. The
 * folder rail's counts are tallied from the rows the shelf fetched, so they agree
 * with the table; the shelf counts are whole-store tallies from /api/sketches/counts.
 *
 * Search spans all folders (a row shows where it lives), as the gallery did.
 * SketchGallery keeps the beats route and lends its folder modals, download links
 * and icons.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import WorkshopShell from '@/components/WorkshopShell';
import MaterialShelf from '@/components/MaterialShelf';
import {
  CloseIcon,
  DiskIcon,
  ExternalLinkIcon,
  FileIcon,
  FolderIcon,
  FolderPlusIcon,
  MoveToFolderModal,
  NewFolderModal,
  PencilIcon,
  PlusIcon,
  SketchDownloads,
  TrashIcon,
} from '@/components/SketchGallery';
import {
  CHARACTER_KINDS,
  LIBRARY_SHELVES,
  TURNTABLE_KINDS,
  VIEW_KINDS,
  filterToShelf,
  shelfByKey,
  shelfFetchBucket,
} from '@/lib/graph/sketch/library-shelves';
import { kindOf } from '@/lib/graph/sketch/sketch-summary';

/** The folder-rail scope: null = every folder, UNFILED = root only, else a fld_ ref. */
const UNFILED = 'unfiled';

/**
 * Column sorting. Newest first is the default because "what did I just make" is
 * the common landing; a column's first click sorts the way that column reads
 * (names A to Z, kinds grouped, dates newest first) and a second click flips
 * it. Ties always break newest first, so a kind sort is still a recent list
 * within each kind. The last choice is a per-browser convenience in
 * localStorage; a missing or malformed value falls back to the default.
 */
const SORT_DEFAULT = { key: 'minted', dir: 'desc' };
const SORT_NATURAL_DIR = { name: 'asc', kind: 'asc', minted: 'desc' };
const SORT_STORAGE_KEY = 'mojulo.library.sort';

function readStoredSort() {
  try {
    const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (v && SORT_NATURAL_DIR[v.key] && (v.dir === 'asc' || v.dir === 'desc')) return v;
  } catch {
    // Private mode or blocked storage: the default is fine.
  }
  return SORT_DEFAULT;
}

function mintedMs(value) {
  if (!value) return 0;
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function sortRows(list, sort, kindLabel) {
  const newestFirst = (a, b) => mintedMs(b.createdAt) - mintedMs(a.createdAt);
  const sign = sort.dir === 'asc' ? 1 : -1;
  const compare =
    sort.key === 'name'
      ? (a, b) => sign * (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }) || newestFirst(a, b)
      : sort.key === 'kind'
      ? (a, b) => sign * kindLabel(a).localeCompare(kindLabel(b), undefined, { sensitivity: 'base' }) || newestFirst(a, b)
      : (a, b) => -sign * newestFirst(a, b) || (a.title || '').localeCompare(b.title || '');
  return [...list].sort(compare);
}

/** The colloquial kind for the Kind column: the shelf's word, not the bucket's. */
function kindKeyOf(sketch) {
  const kind = kindOf(sketch);
  if (CHARACTER_KINDS.includes(kind)) return 'character';
  if (TURNTABLE_KINDS.includes(kind)) return 'turntable';
  if (sketch.bucket === 'object' && VIEW_KINDS.includes(kind)) return 'view';
  switch (sketch.bucket) {
    case 'world': return 'scene';
    case 'object': return 'model';
    case 'illustration': return 'image';
    case 'diagram': return 'diagram';
    default: return null;
  }
}

function shortDate(value) {
  if (!value) return '';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
}

function longDate(value) {
  if (!value) return '';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : '';
}

function associationTagLabel(tag, t) {
  const base = t(`associationTags.${tag.kind}`);
  return tag.count > 1 ? `${base} ×${tag.count}` : base;
}

async function jsonOrThrow(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const railRow = (active) =>
  `flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-left text-[12.5px] leading-[30px] transition-colors duration-100 ${
    active
      ? 'bg-[color:var(--live)]/10 text-[color:var(--live)]'
      : 'text-[color:var(--ink-secondary)] hover:bg-[color:var(--bay-bench)] hover:text-[color:var(--ink-primary)]'
  }`;

const railLabel =
  'mt-3 mb-1 px-2.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[color:var(--ink-muted)] first:mt-0';

const iconButton =
  'inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-floor)] text-[color:var(--ink-secondary)] hover:border-[color:var(--live-idle)] hover:text-[color:var(--live)] disabled:opacity-50';

const button =
  'inline-flex h-[30px] items-center gap-1.5 rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] px-3 text-xs text-[color:var(--ink-primary)] hover:border-[color:var(--bay-rail-lit)] disabled:opacity-50';

const dangerButton =
  'inline-flex h-[30px] items-center gap-1.5 rounded-[var(--radius-control)] border border-red-900 bg-red-950/40 px-3 text-xs text-red-300 hover:bg-red-900/50 disabled:opacity-50';

function SortHeader({ col, label, sort, onSort, className }) {
  const active = sort.key === col;
  return (
    <span className={className} role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-[color:var(--ink-secondary)] ${
          active ? 'text-[color:var(--ink-primary)]' : ''
        }`}
      >
        {label}
        <span aria-hidden className={`text-[9px] ${active ? '' : 'invisible'}`}>{sort.dir === 'asc' ? '▲' : '▼'}</span>
      </button>
    </span>
  );
}

export default function LibraryBrowser({ initialShelf = 'recent', authEnabled = false }) {
  const t = useTranslations('sketchesIndex');
  const tFolder = useTranslations('sketchesIndex.folder');
  const tSelect = useTranslations('sketchesIndex.select');
  const tLibrary = useTranslations('library');
  const tShelves = useTranslations('library.shelves');

  const [shelf, setShelf] = useState(initialShelf);
  const [sketches, setSketches] = useState([]);
  const [folders, setFolders] = useState([]);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(SORT_DEFAULT);
  const [folderScope, setFolderScope] = useState(null);
  const [focusRef, setFocusRef] = useState(null);
  const [checked, setChecked] = useState(() => new Set());

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [moveRefs, setMoveRefs] = useState(null);   // refs the move picker acts on
  const [moveBusy, setMoveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState('');

  /* ── data ─────────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const scope = shelfFetchBucket(shelf);
      const data = await jsonOrThrow(await fetch(scope ? `/api/sketches?bucket=${scope}` : '/api/sketches'));
      setSketches(data.sketches || []);
      setFolders(data.folders || []);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [shelf]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let live = true;
    fetch('/api/sketches/counts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.counts) setCounts(d.counts); })
      .catch(() => {});
    return () => { live = false; };
  }, [sketches]);

  // The stored sort is read after mount so the server and first client render agree.
  useEffect(() => {
    setSort(readStoredSort());
  }, []);

  const changeSort = useCallback((key) => {
    setSort((prev) => {
      const next =
        prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: SORT_NATURAL_DIR[key] };
      try {
        window.localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable: the choice still holds for this page.
      }
      return next;
    });
  }, []);

  // A folder deleted from under us bounces the scope back to every folder.
  useEffect(() => {
    if (folderScope && folderScope !== UNFILED && !folders.some((f) => f.ref === folderScope)) {
      setFolderScope(null);
    }
  }, [folders, folderScope]);

  const onRegistryShelf = Boolean(shelfByKey(shelf).registry);
  const shelved = useMemo(() => filterToShelf(sketches, shelf), [sketches, shelf]);
  const folderByRef = useMemo(() => new Map(folders.map((f) => [f.ref, f])), [folders]);
  const currentFolder = folderScope && folderScope !== UNFILED ? folderByRef.get(folderScope) || null : null;

  // Rail counts, tallied from the shelf's own rows so they agree with the table.
  const railCounts = useMemo(() => {
    const m = new Map();
    let unfiled = 0;
    for (const s of shelved) {
      if (s.folderRef) m.set(s.folderRef, (m.get(s.folderRef) || 0) + 1);
      else unfiled += 1;
    }
    return { unfiled, byFolder: m };
  }, [shelved]);

  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;

  const rows = useMemo(() => {
    let list = shelved;
    if (searching) {
      list = list.filter(
        (s) => (s.title || '').toLowerCase().includes(trimmedQuery) || s.ref.toLowerCase().includes(trimmedQuery),
      );
    } else if (folderScope === UNFILED) {
      list = list.filter((s) => !s.folderRef);
    } else if (folderScope) {
      list = list.filter((s) => s.folderRef === folderScope);
    }
    const kindLabel = (s) => {
      const k = kindKeyOf(s);
      return k ? tLibrary(`kinds.${k}`) : '';
    };
    return sortRows(list, sort, kindLabel);
  }, [shelved, searching, trimmedQuery, folderScope, sort, tLibrary]);

  const focused = useMemo(() => rows.find((s) => s.ref === focusRef) || null, [rows, focusRef]);

  // Leaving the rows behind clears what pointed at them.
  useEffect(() => {
    setChecked(new Set());
    setFocusRef(null);
    setActionError('');
  }, [shelf, folderScope]);

  useEffect(() => {
    setEditingTitle(false);
    setDraftTitle('');
    setRenameError('');
  }, [focusRef]);

  const changeShelf = useCallback((next) => {
    setShelf(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next === 'recent') url.searchParams.delete('shelf');
      else url.searchParams.set('shelf', next);
      window.history.replaceState(null, '', url);
    }
  }, []);

  /* ── actions ──────────────────────────────────────────────────────────── */

  const toggleChecked = useCallback((ref) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  const createFolder = useCallback(
    async (name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;
      setFolderBusy(true);
      setActionError('');
      try {
        const body = await jsonOrThrow(
          await fetch('/api/sketches/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmed }),
          }),
        );
        await load();
        setShowNewFolder(false);
        return body?.folder?.ref || null;
      } catch (e) {
        setActionError(e.message);
        return null;
      } finally {
        setFolderBusy(false);
      }
    },
    [load],
  );

  const renameFolder = useCallback(
    async (folder) => {
      const next = window.prompt(tFolder('rename'), folder.name);
      if (!next || !next.trim() || next.trim() === folder.name) return;
      setFolderBusy(true);
      setActionError('');
      try {
        await jsonOrThrow(
          await fetch(`/api/sketches/folders/${encodeURIComponent(folder.ref)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: next.trim() }),
          }),
        );
        await load();
      } catch (e) {
        setActionError(e.message);
      } finally {
        setFolderBusy(false);
      }
    },
    [load, tFolder],
  );

  const deleteFolder = useCallback(
    async (folder) => {
      if (!window.confirm(tFolder('deleteConfirm'))) return;
      setFolderBusy(true);
      setActionError('');
      try {
        await jsonOrThrow(
          await fetch(`/api/sketches/folders/${encodeURIComponent(folder.ref)}`, { method: 'DELETE' }),
        );
        setFolderScope(null);
        await load();
      } catch (e) {
        setActionError(e.message);
      } finally {
        setFolderBusy(false);
      }
    },
    [load, tFolder],
  );

  const moveTo = useCallback(
    async (folderRef) => {
      if (!moveRefs || moveRefs.length === 0) return;
      setMoveBusy(true);
      setActionError('');
      try {
        await jsonOrThrow(
          await fetch('/api/sketches/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refs: moveRefs, folderRef }),
          }),
        );
        setMoveRefs(null);
        setChecked(new Set());
        await load();
      } catch (e) {
        setActionError(tSelect('moveError', { error: e.message }));
      } finally {
        setMoveBusy(false);
      }
    },
    [load, moveRefs, tSelect],
  );

  const deleteRefs = useCallback(
    async (refs) => {
      if (refs.length === 0) return;
      if (!window.confirm(tSelect('deleteConfirm', { count: refs.length }))) return;
      setDeleteBusy(true);
      setActionError('');
      try {
        await jsonOrThrow(
          await fetch('/api/sketches/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refs }),
          }),
        );
        if (focusRef && refs.includes(focusRef)) setFocusRef(null);
        setChecked((prev) => {
          const next = new Set(prev);
          for (const r of refs) next.delete(r);
          return next;
        });
        await load();
      } catch (e) {
        setActionError(tSelect('deleteError', { error: e.message }));
      } finally {
        setDeleteBusy(false);
      }
    },
    [focusRef, load, tSelect],
  );

  const startRename = useCallback(() => {
    if (!focused) return;
    setDraftTitle(focused.title || '');
    setRenameError('');
    setEditingTitle(true);
  }, [focused]);

  const cancelRename = useCallback(() => {
    setEditingTitle(false);
    setDraftTitle('');
    setRenameError('');
  }, []);

  const saveRename = useCallback(async () => {
    if (!focused) return;
    const next = draftTitle.trim();
    if (!next) {
      setRenameError(t('renameEmpty'));
      return;
    }
    if (next === focused.title) {
      cancelRename();
      return;
    }
    setRenameBusy(true);
    setRenameError('');
    try {
      await jsonOrThrow(
        await fetch(`/api/sketches/${encodeURIComponent(focused.ref)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: next }),
        }),
      );
      cancelRename();
      await load();
    } catch (e) {
      setRenameError(e.message);
    } finally {
      setRenameBusy(false);
    }
  }, [cancelRename, draftTitle, focused, load, t]);

  // Save-as-new: the row is a summary without the recipe, so read the whole
  // manifest by ref first, then mint a copy under the new title in the folder
  // the rail is showing (the root when it shows every folder or Unfiled).
  const saveAsNew = useCallback(async () => {
    if (!focused) return;
    const next = draftTitle.trim();
    if (!next) {
      setRenameError(t('renameEmpty'));
      return;
    }
    setRenameBusy(true);
    setRenameError('');
    try {
      const { manifest } = await jsonOrThrow(await fetch(`/api/sketches/${encodeURIComponent(focused.ref)}`));
      const body = await jsonOrThrow(
        await fetch('/api/sketches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: next, manifest, folder_ref: currentFolder?.ref || null }),
        }),
      );
      cancelRename();
      const data = await load();
      if (body?.ref && data?.sketches?.some((s) => s.ref === body.ref)) setFocusRef(body.ref);
    } catch (e) {
      setRenameError(e.message);
    } finally {
      setRenameBusy(false);
    }
  }, [cancelRename, currentFolder, draftTitle, focused, load, t]);

  /* ── render ───────────────────────────────────────────────────────────── */

  const heading = searching
    ? t('filteredCount', { count: rows.length, total: shelved.length })
    : folderScope === UNFILED
    ? tLibrary('rail.unfiled')
    : currentFolder
    ? currentFolder.name
    : tFolder('rootCrumb');

  const rail = (
    <nav
      aria-label={tLibrary('crumb')}
      className="flex w-[232px] shrink-0 flex-col overflow-y-auto border-r border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-2.5 py-4"
    >
      <div className={railLabel}>{tFolder('foldersHeader')}</div>
      <button type="button" onClick={() => setFolderScope(null)} className={railRow(!folderScope)}>
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--forge)]" />
        <span className="min-w-0 flex-1 truncate">{tFolder('rootCrumb')}</span>
        <span className="font-mono text-[10.5px] text-[color:var(--ink-muted)]">{shelved.length}</span>
      </button>
      <button type="button" onClick={() => setFolderScope(UNFILED)} className={railRow(folderScope === UNFILED)}>
        <FolderIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]" />
        <span className="min-w-0 flex-1 truncate">{tLibrary('rail.unfiled')}</span>
        <span className="font-mono text-[10.5px] text-[color:var(--ink-muted)]">{railCounts.unfiled}</span>
      </button>
      {folders.map((f) => (
        <button key={f.ref} type="button" onClick={() => setFolderScope(f.ref)} className={railRow(folderScope === f.ref)}>
          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-[color:var(--forge)]" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="font-mono text-[10.5px] text-[color:var(--ink-muted)]">{railCounts.byFolder.get(f.ref) || 0}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setShowNewFolder(true)}
        className={`${railRow(false)} text-[color:var(--live)] hover:text-[color:var(--live)]`}
      >
        <FolderPlusIcon className="h-3.5 w-3.5 shrink-0" />
        {tFolder('newFolderButton')}
      </button>

      <div className={railLabel}>{tLibrary('rail.shelves')}</div>
      {LIBRARY_SHELVES.map((s) => (
        <button
          key={s.key}
          type="button"
          aria-pressed={s.key === shelf}
          onClick={() => changeShelf(s.key)}
          className={railRow(s.key === shelf)}
        >
          <span className="min-w-0 flex-1 truncate">{tShelves(s.key)}</span>
          {counts?.[s.key] != null && (
            <span className="font-mono text-[10.5px] text-[color:var(--ink-muted)]">{counts[s.key]}</span>
          )}
        </button>
      ))}
    </nav>
  );

  const header = (
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-6 pb-3 pt-4">
      <h1 className="text-lg font-semibold text-[color:var(--ink-primary)]">{heading}</h1>
      <span className="text-xs text-[color:var(--ink-muted)]">· {tShelves(shelf)}</span>
      {currentFolder && !searching && (
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => renameFolder(currentFolder)} disabled={folderBusy} aria-label={tFolder('rename')} title={tFolder('rename')} className={iconButton}>
            <PencilIcon className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => deleteFolder(currentFolder)} disabled={folderBusy} aria-label={tFolder('delete')} title={tFolder('delete')} className={iconButton}>
            <TrashIcon className="h-3 w-3" />
          </button>
        </span>
      )}
      {!onRegistryShelf && (
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-[30px] w-60 rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-floor)] px-3 text-xs text-[color:var(--ink-primary)] placeholder-[color:var(--ink-muted)] focus:border-[color:var(--live)] focus:outline-none"
          />
        </div>
      )}
    </div>
  );

  const table = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[color:var(--bay-rail)]">
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-[color:var(--bay-rail-lit)] px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-[color:var(--ink-muted)]">
        <span className="w-4" />
        <span className="w-4" />
        <SortHeader col="name" label={tLibrary('columns.name')} sort={sort} onSort={changeSort} className="min-w-0 flex-1" />
        <SortHeader col="kind" label={tLibrary('columns.kind')} sort={sort} onSort={changeSort} className="w-24" />
        <SortHeader col="minted" label={tLibrary('columns.minted')} sort={sort} onSort={changeSort} className="w-24" />
        <span className="w-32">{tLibrary('columns.ref')}</span>
        <span className="w-24" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && sketches.length === 0 ? (
          <p className="py-8 text-center text-sm text-[color:var(--ink-muted)]">{t('loading')}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[color:var(--ink-muted)]">
            {shelved.length === 0 ? t('emptyState') : searching ? t('noMatch') : currentFolder ? tFolder('emptyFolder') : t('noMatch')}
          </p>
        ) : (
          rows.map((s) => {
            const isFocused = s.ref === focusRef;
            const isChecked = checked.has(s.ref);
            const kindKey = kindKeyOf(s);
            const home = s.folderRef ? folderByRef.get(s.folderRef) : null;
            return (
              <div
                key={s.ref}
                onClick={() => setFocusRef(isFocused ? null : s.ref)}
                className={`group flex h-9 cursor-pointer items-center gap-3 border-b border-[color:var(--bay-rail)] px-4 text-[13px] ${
                  isFocused
                    ? 'bg-[color:var(--live)]/[.07] shadow-[inset_2px_0_0_var(--live)]'
                    : 'hover:bg-[color:var(--bay-bench)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleChecked(s.ref)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={s.title}
                  className={`h-3.5 w-3.5 shrink-0 accent-teal-400 ${isChecked ? '' : 'opacity-30 group-hover:opacity-100'}`}
                />
                <FileIcon className={`h-3.5 w-3.5 shrink-0 ${isFocused ? 'text-[color:var(--live)]' : 'text-[color:var(--ink-muted)]'}`} />
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-[color:var(--ink-primary)]">{s.title}</span>
                  {searching && (
                    <span className="shrink-0 rounded border border-[color:var(--forge)]/30 px-1.5 text-[10px] leading-4 text-[color:var(--forge)]">
                      {home ? tFolder('moveSourceFolder', { name: home.name }) : tFolder('moveSourceRoot')}
                    </span>
                  )}
                  {s.associations?.map((tag) => (
                    <span key={`${s.ref}-${tag.kind}`} className="shrink-0 rounded border border-[color:var(--think)]/35 px-1.5 font-mono text-[10px] leading-4 text-[color:var(--think)]">
                      {associationTagLabel(tag, t)}
                    </span>
                  ))}
                </span>
                <span className="w-24 truncate text-xs text-[color:var(--ink-secondary)]">{kindKey ? tLibrary(`kinds.${kindKey}`) : ''}</span>
                <span className="w-24 text-xs tabular-nums text-[color:var(--ink-secondary)]">{shortDate(s.createdAt)}</span>
                <span className="w-32 truncate font-mono text-[11px] text-[color:var(--ink-muted)]">{s.ref}</span>
                <span className="flex w-24 justify-end gap-1 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                  <a href={`/sketches/${encodeURIComponent(s.ref)}`} target="_blank" rel="noreferrer" aria-label={t('openNewTab')} title={t('openNewTab')} className={iconButton}>
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                  <button type="button" onClick={() => setMoveRefs([s.ref])} aria-label={t('rowAction.move')} title={t('rowAction.move')} className={iconButton}>
                    <FolderIcon className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => deleteRefs([s.ref])} disabled={deleteBusy} aria-label={t('rowAction.delete')} title={t('rowAction.delete')} className={iconButton}>
                    <TrashIcon className="h-3 w-3" />
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const strip = (
    <div className="flex min-h-[64px] shrink-0 items-center gap-4 border-t border-[color:var(--bay-rail-lit)] bg-[color:var(--bay-bench)] px-6 py-3">
      {checked.size > 0 ? (
        <>
          <span className="text-sm text-[color:var(--ink-primary)]">{tSelect('count', { count: checked.size })}</span>
          <button type="button" onClick={() => setChecked(new Set(rows.map((s) => s.ref)))} className="text-xs text-[color:var(--live)]">
            {tSelect('selectAll')}
          </button>
          <button type="button" onClick={() => setChecked(new Set())} className="text-xs text-[color:var(--ink-secondary)]">
            {tSelect('clear')}
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" disabled={moveBusy} onClick={() => setMoveRefs(Array.from(checked))} className={button}>
              <FolderIcon className="h-3 w-3" />
              {tSelect('moveTo')}
            </button>
            <button type="button" disabled={deleteBusy} onClick={() => deleteRefs(Array.from(checked))} className={dangerButton}>
              <TrashIcon className="h-3 w-3" />
              {tSelect('delete')}
            </button>
          </div>
        </>
      ) : focused ? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelRename(); }
                  }}
                  disabled={renameBusy}
                  autoFocus
                  placeholder={t('renamePlaceholder')}
                  aria-label={t('renameLabel')}
                  className="h-8 min-w-0 flex-1 rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-floor)] px-3 text-sm font-medium text-[color:var(--ink-primary)] focus:border-[color:var(--live)] focus:outline-none disabled:opacity-60"
                />
                <button type="button" onClick={saveRename} disabled={renameBusy || !draftTitle.trim()} aria-label={t('renameSave')} title={t('renameSave')} className={iconButton}>
                  <DiskIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={saveAsNew} disabled={renameBusy || !draftTitle.trim()} aria-label={t('renameSaveNew')} title={t('renameSaveNew')} className={`${iconButton} w-auto gap-0.5 px-1.5`}>
                  <PlusIcon className="h-3 w-3" />
                  <DiskIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={cancelRename} disabled={renameBusy} aria-label={t('renameCancel')} title={t('renameCancel')} className={iconButton}>
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={startRename} title={t('renameLabel')} className="group flex max-w-full items-center gap-2 text-left">
                <span className="truncate text-sm font-medium text-[color:var(--ink-primary)] group-hover:text-[color:var(--live)]">{focused.title}</span>
                <PencilIcon className="h-3 w-3 shrink-0 text-[color:var(--ink-muted)] group-hover:text-[color:var(--live)]" />
              </button>
            )}
            {renameError && <p className="text-xs text-red-400">{renameError}</p>}
            <p className="truncate font-mono text-[11px] text-[color:var(--ink-muted)]">
              {focused.ref}
              {' · '}
              {kindKeyOf(focused) ? tLibrary(`kinds.${kindKeyOf(focused)}`) : focused.bucket}
              {' · '}
              {t('mintedAt', { timestamp: longDate(focused.createdAt) })}
              {' · '}
              {focused.folderRef && folderByRef.get(focused.folderRef)
                ? tLibrary('inspector.inFolder', { name: folderByRef.get(focused.folderRef).name })
                : tLibrary('inspector.unfiled')}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <SketchDownloads sketch={focused} t={t} />
            <button type="button" onClick={() => setMoveRefs([focused.ref])} disabled={moveBusy} className={button}>
              <FolderIcon className="h-3 w-3" />
              {tSelect('moveTo')}
            </button>
            <button type="button" onClick={() => deleteRefs([focused.ref])} disabled={deleteBusy} className={dangerButton}>
              <TrashIcon className="h-3 w-3" />
              {tSelect('delete')}
            </button>
          </div>
        </>
      ) : (
        <p className="text-xs text-[color:var(--ink-muted)]">{tLibrary('inspector.empty')}</p>
      )}
    </div>
  );

  return (
    <WorkshopShell posture="pinned" width={1600} authEnabled={authEnabled} crumb={tLibrary('crumb')}>
      <div className="flex min-h-0 flex-1">
        {rail}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {header}
          {(error || actionError) && (
            <div className="mx-6 mb-3 rounded border border-red-700 bg-red-900/30 px-4 py-2 text-sm text-red-400">
              {error || actionError}
            </div>
          )}
          {shelfByKey(shelf).capped && !searching && (
            <p className="px-6 pb-2 text-[11px] text-[color:var(--ink-muted)]">{tLibrary('recentNote')}</p>
          )}
          {onRegistryShelf ? (
            <div className="min-h-0 flex-1 overflow-y-auto border-t border-[color:var(--bay-rail)] px-6 py-4">
              <MaterialShelf />
            </div>
          ) : (
            <>
              {table}
              {strip}
            </>
          )}
        </div>
      </div>

      {showNewFolder && (
        <NewFolderModal tFolder={tFolder} busy={folderBusy} onCancel={() => setShowNewFolder(false)} onCreate={createFolder} />
      )}
      {moveRefs && (
        <MoveToFolderModal
          tFolder={tFolder}
          tSelect={tSelect}
          folders={folders}
          currentFolderRef={currentFolder?.ref || null}
          count={moveRefs.length}
          busy={moveBusy}
          onCancel={() => setMoveRefs(null)}
          onChoose={moveTo}
        />
      )}
    </WorkshopShell>
  );
}
