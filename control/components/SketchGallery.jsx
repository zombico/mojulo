'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';
import { sketchRenderMode } from '@/lib/graph/sketch-manifest';

// Preview body for one sketch, dispatched on its renderer mode so scene /
// illustration kinds (fractal-city, turntables, …) render via their /scene or
// /svg endpoint and never fall through to <CreationMap> (which assumes a diagram
// `viewBox` and throws on a scene manifest). Shared by the split-view preview and
// the full-view modal so the dispatch lives in exactly one place.
function SketchPreviewBody({ sketch, t, fit = false }) {
  if (!sketch?.manifest) return <p className="text-sm text-red-400">{t('invalidManifest')}</p>;
  const ref = encodeURIComponent(sketch.ref);
  const mode = sketchRenderMode(sketch.manifest);
  if (mode === 'svg') {
    return (
      <img
        src={`/api/sketches/${ref}/svg?inline=1`}
        alt={sketch.title || sketch.ref}
        className="max-w-full max-h-full block"
      />
    );
  }
  if (mode === 'world' || mode === 'scene') {
    // The 3D kinds (navigable three.js worlds, CSS-3D turntables) render hard
    // live, so the gallery previews a baked PNG instead of standing up a 3D
    // context per card. scale=1 keeps the (rasterization-heavy) first bake quick;
    // the full-res 2× image is the "Download PNG" target. The live, traversable
    // view is one click away via "Open in New Tab".
    return (
      <img
        src={`/api/sketches/${ref}/png?inline=1&scale=1`}
        alt={sketch.title || sketch.ref}
        className="max-w-full max-h-full block"
      />
    );
  }
  return <CreationMap manifest={sketch.manifest} technical={false} fit={fit} />;
}

// The shared download/open affordances for a previewed sketch, used by both the
// split-view header and the full-view modal. Every kind offers "Download PNG";
// SVG download is offered only for kinds that have a vector form (illustration
// SVGs + CreationMap diagrams) — the 3D world/scene kinds have no SVG to export,
// so their only still export is the baked PNG.
function SketchDownloads({ sketch, t }) {
  const ref = encodeURIComponent(sketch.ref);
  const mode = sketchRenderMode(sketch.manifest);
  const hasSvg = mode === 'svg' || mode === 'diagram';
  return (
    <div className="flex items-center gap-2">
      <a
        href={`/sketches/${ref}`}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
      >
        <ExternalLinkIcon />
        {t('openNewTab')}
      </a>
      {hasSvg && (
        <a
          href={`/api/sketches/${ref}/svg`}
          className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
        >
          <DownloadIcon />
          {t('downloadSvg')}
        </a>
      )}
      <a
        href={`/api/sketches/${ref}/png`}
        className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
      >
        <DownloadIcon />
        {t('downloadPng')}
      </a>
    </div>
  );
}

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function associationTagLabel(tag, t) {
  const label = t(`associationTags.${tag.kind}`);
  return tag.count > 1 ? `${label} ${tag.count}` : label;
}

// The shared two-pane sketch gallery, mounted by both sibling concerns:
// /sketches (the Sketches/diagram concern) and /maker/illustrations (the Maker
// illustration concern). `bucket` ('diagram' | 'illustration' | null) narrows
// the list to one concern; null shows every sketch. `heading`/`subtitle`
// override the default copy. A diagram and an illustration are the same sketch
// primitive — this only changes which bucket the list is filtered to.
export default function SketchGallery({ bucket = null, heading, subtitle } = {}) {
  const t = useTranslations('sketchesIndex');
  const tFolder = useTranslations('sketchesIndex.folder');
  const tSelect = useTranslations('sketchesIndex.select');
  const [sketches, setSketches] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState('');

  // Folder context: null = root; a non-null fld_… puts the sidebar into a
  // folder view and pins the New-sketch starter prompt to that folder.
  const [currentFolderRef, setCurrentFolderRef] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderActionError, setFolderActionError] = useState('');

  // Multi-select mode for bulk move-to-folder. selectedSet holds the refs
  // currently checked; togging select mode off clears the set.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSet, setSelectedSet] = useState(() => new Set());
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Full folder view is a dedicated management surface: hides the preview
  // pane, shows sketches as a selectable grid, surfaces bulk move/delete
  // in a sticky action bar, and pops a modal for preview-on-demand. Split
  // view (default) is the original two-pane UI.
  const [viewMode, setViewMode] = useState('split');
  const fullView = viewMode === 'full';
  const [previewRef, setPreviewRef] = useState(null);
  const previewSketch = useMemo(
    () => (previewRef ? sketches.find((s) => s.ref === previewRef) || null : null),
    [previewRef, sketches],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(bucket ? `/api/sketches?bucket=${bucket}` : '/api/sketches');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const nextSketches = data.sketches || [];
      const nextFolders = data.folders || [];
      setSketches(nextSketches);
      setFolders(nextFolders);
      return { sketches: nextSketches, folders: nextFolders };
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  useEffect(() => {
    load();
  }, [load]);

  // If the folder we're viewing got deleted from under us (e.g. via DELETE),
  // bounce back to root so the sidebar doesn't show a stale "empty folder".
  useEffect(() => {
    if (!currentFolderRef) return;
    if (!folders.some((f) => f.ref === currentFolderRef)) {
      setCurrentFolderRef(null);
    }
  }, [folders, currentFolderRef]);

  const currentFolder = useMemo(
    () => folders.find((f) => f.ref === currentFolderRef) || null,
    [folders, currentFolderRef],
  );

  const folderByRef = useMemo(() => {
    const m = new Map();
    for (const f of folders) m.set(f.ref, f);
    return m;
  }, [folders]);

  const trimmedQuery = query.trim();
  const searching = trimmedQuery.length > 0;

  // What appears in the left rail. When searching, results span all folders
  // (the user said: "Search sketch results is separate") so folder context
  // is bypassed and folder rows are hidden. Otherwise we render the sketches
  // for the current folder context only.
  const visibleSketches = useMemo(() => {
    if (searching) {
      const q = trimmedQuery.toLowerCase();
      return sketches.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.ref?.toLowerCase().includes(q),
      );
    }
    return sketches.filter((s) => (s.folderRef || null) === currentFolderRef);
  }, [sketches, currentFolderRef, searching, trimmedQuery]);

  // Folder rows only appear in the root view. Once you've entered a folder
  // (or you're searching), the sidebar is just sketches — no sibling-folder
  // clutter at the top of the list.
  const visibleFolders = searching || currentFolderRef ? [] : folders;

  // In full folder view, selection is always available — checkboxes show
  // unconditionally and the bulk action bar is always present.
  const selecting = fullView || selectMode;

  // Selection state. Reset whenever we leave select mode or the folder
  // context changes — picking a fresh batch from a fresh view is the
  // expected affordance.
  useEffect(() => {
    if (!selecting) {
      setSelectedSet(new Set());
      setShowMovePicker(false);
      setMoveError('');
      setDeleteError('');
    }
  }, [selecting]);
  useEffect(() => {
    if (selecting) {
      setSelectedSet(new Set());
      setShowMovePicker(false);
    }
  }, [currentFolderRef, selecting]);
  // Switching view modes is a fresh start: clear pending selection so the
  // user doesn't act on rows they last saw in the other layout.
  useEffect(() => {
    setSelectedSet(new Set());
    setShowMovePicker(false);
    setMoveError('');
    setDeleteError('');
  }, [viewMode]);

  const toggleSelected = useCallback((ref) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedSet(new Set(visibleSketches.map((s) => s.ref)));
  }, [visibleSketches]);

  const clearSelection = useCallback(() => {
    setSelectedSet(new Set());
  }, []);

  const selected = sketches.find((s) => s.ref === selectedRef) || null;

  // Exit rename mode whenever the selected sketch changes, so we don't carry
  // a stale draft title across selections.
  useEffect(() => {
    setEditingTitle(false);
    setDraftTitle('');
    setRenameError('');
  }, [selectedRef]);

  const startRename = useCallback(() => {
    if (!selected) return;
    setDraftTitle(selected.title || '');
    setRenameError('');
    setEditingTitle(true);
  }, [selected]);

  const cancelRename = useCallback(() => {
    setEditingTitle(false);
    setDraftTitle('');
    setRenameError('');
  }, []);

  const saveRename = useCallback(async () => {
    if (!selected) return;
    const next = draftTitle.trim();
    if (!next) {
      setRenameError(t('renameEmpty'));
      return;
    }
    if (next === selected.title) {
      cancelRename();
      return;
    }
    setRenameBusy(true);
    setRenameError('');
    try {
      const res = await fetch(`/api/sketches/${encodeURIComponent(selected.ref)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setEditingTitle(false);
      setDraftTitle('');
      await load();
    } catch (e) {
      setRenameError(e.message);
    } finally {
      setRenameBusy(false);
    }
  }, [cancelRename, draftTitle, load, selected, t]);

  const saveAsNew = useCallback(async () => {
    if (!selected) return;
    const next = draftTitle.trim();
    if (!next) {
      setRenameError(t('renameEmpty'));
      return;
    }
    setRenameBusy(true);
    setRenameError('');
    try {
      const res = await fetch('/api/sketches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: next,
          manifest: selected.manifest,
          folder_ref: currentFolderRef,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const body = await res.json();
      setEditingTitle(false);
      setDraftTitle('');
      const next2 = await load();
      if (body?.ref && next2?.sketches?.some((s) => s.ref === body.ref)) {
        setSelectedRef(body.ref);
      }
    } catch (e) {
      setRenameError(e.message);
    } finally {
      setRenameBusy(false);
    }
  }, [currentFolderRef, draftTitle, load, selected, t]);

  const bulkMoveTo = useCallback(
    async (folderRef) => {
      if (selectedSet.size === 0) return;
      setMoveBusy(true);
      setMoveError('');
      try {
        const res = await fetch('/api/sketches/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refs: Array.from(selectedSet), folderRef }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        setShowMovePicker(false);
        setSelectedSet(new Set());
        if (!fullView) setSelectMode(false);
        await load();
      } catch (e) {
        setMoveError(tSelect('moveError', { error: e.message }));
      } finally {
        setMoveBusy(false);
      }
    },
    [fullView, load, selectedSet, tSelect],
  );

  const bulkDelete = useCallback(async () => {
    if (selectedSet.size === 0) return;
    const count = selectedSet.size;
    if (!window.confirm(tSelect('deleteConfirm', { count }))) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/sketches/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refs: Array.from(selectedSet) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // If the previewed sketch (in either view) was just deleted, clear it.
      if (selectedRef && selectedSet.has(selectedRef)) setSelectedRef(null);
      if (previewRef && selectedSet.has(previewRef)) setPreviewRef(null);
      setSelectedSet(new Set());
      if (!fullView) setSelectMode(false);
      await load();
    } catch (e) {
      setDeleteError(tSelect('deleteError', { error: e.message }));
    } finally {
      setDeleteBusy(false);
    }
  }, [fullView, load, previewRef, selectedRef, selectedSet, tSelect]);

  const createFolder = useCallback(
    async (name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return null;
      setFolderBusy(true);
      setFolderActionError('');
      try {
        const res = await fetch('/api/sketches/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const body = await res.json();
        await load();
        setShowNewFolder(false);
        return body?.folder?.ref || null;
      } catch (e) {
        setFolderActionError(e.message);
        return null;
      } finally {
        setFolderBusy(false);
      }
    },
    [load],
  );

  const renameFolder = useCallback(
    async (ref, name) => {
      const trimmed = (name || '').trim();
      if (!ref || !trimmed) return;
      setFolderBusy(true);
      setFolderActionError('');
      try {
        const res = await fetch(`/api/sketches/folders/${encodeURIComponent(ref)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        await load();
      } catch (e) {
        setFolderActionError(e.message);
      } finally {
        setFolderBusy(false);
      }
    },
    [load],
  );

  const deleteFolder = useCallback(
    async (ref) => {
      if (!ref) return;
      if (!window.confirm(tFolder('deleteConfirm'))) return;
      setFolderBusy(true);
      setFolderActionError('');
      try {
        const res = await fetch(`/api/sketches/folders/${encodeURIComponent(ref)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        setCurrentFolderRef(null);
        await load();
      } catch (e) {
        setFolderActionError(e.message);
      } finally {
        setFolderBusy(false);
      }
    },
    [load, tFolder],
  );

  return (
    <div className="h-[calc(100vh-66px)] flex flex-col bg-gray-900">
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{heading || t('title')}</h1>
          <p className="text-xs text-gray-400 mt-1">{subtitle || t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {t('total', { count: sketches.length })}
          </span>
          <div
            role="group"
            aria-label={t('viewToggle.full')}
            className="inline-flex rounded-md border border-gray-600 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 text-xs ${
                !fullView
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {t('viewToggle.split')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('full')}
              className={`px-3 py-1.5 text-xs border-l border-gray-600 ${
                fullView
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
              }`}
            >
              {t('viewToggle.full')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-teal-500 bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-600"
          >
            <FolderPlusIcon />
            {tFolder('newFolderButton')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-8 mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}
      {folderActionError && (
        <div className="mx-8 mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
          {folderActionError}
        </div>
      )}

      {fullView ? (
        <FullFolderView
          t={t}
          tFolder={tFolder}
          tSelect={tSelect}
          query={query}
          setQuery={setQuery}
          loading={loading}
          sketches={sketches}
          visibleSketches={visibleSketches}
          visibleFolders={visibleFolders}
          searching={searching}
          currentFolder={currentFolder}
          setCurrentFolderRef={setCurrentFolderRef}
          folderByRef={folderByRef}
          selectedSet={selectedSet}
          toggleSelected={toggleSelected}
          selectAllVisible={selectAllVisible}
          clearSelection={clearSelection}
          setShowMovePicker={setShowMovePicker}
          bulkDelete={bulkDelete}
          moveBusy={moveBusy}
          deleteBusy={deleteBusy}
          moveError={moveError}
          deleteError={deleteError}
          folderBusy={folderBusy}
          renameFolder={renameFolder}
          deleteFolder={deleteFolder}
          openPreview={(ref) => setPreviewRef(ref)}
        />
      ) : (
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

          {/* Folder breadcrumb + select-mode toggle */}
          <div className="mb-3 flex items-center justify-between gap-2">
            {searching ? (
              <p className="text-xs text-gray-400">
                {t('filteredCount', { count: visibleSketches.length, total: sketches.length })}
              </p>
            ) : currentFolder ? (
              <button
                type="button"
                onClick={() => setCurrentFolderRef(null)}
                className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200"
              >
                <ChevronLeftIcon />
                {tFolder('rootCrumb')}
              </button>
            ) : (
              <p className="text-xs text-gray-400">
                {t('count', { count: visibleSketches.length })}
              </p>
            )}
            <button
              type="button"
              onClick={() => setSelectMode((v) => !v)}
              className={`px-2 py-1 text-[11px] border rounded ${
                selectMode
                  ? 'border-teal-500 bg-teal-700 text-white hover:bg-teal-600'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {selectMode ? tSelect('exit') : tSelect('enter')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 border-y border-gray-800">
            {loading && sketches.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">{t('loading')}</div>
            ) : (
              <>
                {/* Folder rows: root view only, hidden during search. */}
                {visibleFolders.length > 0 && (
                  <div className="py-1">
                    {visibleFolders.map((f) => (
                      <button
                        key={f.ref}
                        type="button"
                        onClick={() => {
                          setCurrentFolderRef(f.ref);
                          setSelectedRef(null);
                        }}
                        className="group w-full text-left border-b border-gray-800 px-2 py-1.5 cursor-pointer transition hover:bg-gray-800/80"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-400/80 group-hover:text-amber-300" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-gray-200">
                              {f.name}
                            </div>
                            <p className="text-[10px] text-gray-500">
                              {tFolder('sketchCount', { count: f.sketchCount })}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {visibleSketches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {sketches.length === 0
                      ? t('emptyState')
                      : searching
                      ? t('noMatch')
                      : currentFolder
                      ? tFolder('emptyFolder')
                      : t('noMatch')}
                  </div>
                ) : (
                  visibleSketches.map((s) => {
                    const isSelected = s.ref === selectedRef;
                    const isChecked = selectedSet.has(s.ref);
                    const sourceFolder = s.folderRef ? folderByRef.get(s.folderRef) : null;
                    const showSourceTag = searching && (s.folderRef || null) !== currentFolderRef;
                    return (
                      <div
                        key={s.ref}
                        className={`group w-full border-b px-2 py-1.5 transition flex items-center gap-2 ${
                          isSelected
                            ? 'border-teal-500/40 bg-teal-950/40'
                            : 'border-gray-800 hover:bg-gray-800/80'
                        }`}
                      >
                        {selectMode && (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelected(s.ref)}
                            className="h-3.5 w-3.5 shrink-0 accent-teal-500"
                            aria-label={s.title}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (selectMode) {
                              toggleSelected(s.ref);
                              return;
                            }
                            setSelectedRef(s.ref);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileIcon
                              className={`h-3.5 w-3.5 shrink-0 ${
                                isSelected ? 'text-teal-300' : 'text-gray-500 group-hover:text-gray-400'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-medium text-gray-200">
                                {s.title}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {showSourceTag && (
                                  <span className="rounded border border-amber-500/25 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-200">
                                    {sourceFolder
                                      ? tFolder('moveSourceFolder', { name: sourceFolder.name })
                                      : tFolder('moveSourceRoot')}
                                  </span>
                                )}
                                {s.associations?.map((tag) => (
                                  <span
                                    key={`${s.ref}-${tag.kind}`}
                                    className="rounded border border-teal-500/25 bg-teal-950/30 px-1.5 py-0.5 text-[10px] font-medium leading-none text-teal-200"
                                  >
                                    {associationTagLabel(tag, t)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>

          {/* Multi-select bottom action bar */}
          {selectMode && (
            <div className="mt-3 border-t border-gray-700 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-300">
                  {tSelect('count', { count: selectedSet.size })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="text-teal-300 hover:text-teal-200"
                  >
                    {tSelect('selectAll')}
                  </button>
                  <span className="text-gray-600">·</span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    {tSelect('clear')}
                  </button>
                </div>
              </div>
              <button
                type="button"
                disabled={selectedSet.size === 0 || moveBusy}
                onClick={() => setShowMovePicker(true)}
                className="w-full px-3 py-1.5 text-xs border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50 disabled:hover:bg-teal-700"
              >
                {tSelect('moveTo')}
              </button>
              {moveError && <p className="text-xs text-red-400">{moveError}</p>}
            </div>
          )}
        </div>

        {/* Right: preview pane. Flex column with min-h-0 so the map block
            (flex-1) consumes the leftover vertical space and the sketch
            renders viewport-fit by default. The folder + title cards
            shrink to their natural height. */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          {currentFolder && !searching && (
            <div className="shrink-0 border border-gray-700 bg-gray-800 rounded-lg px-5 py-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FolderIcon className="h-4 w-4 text-amber-400/80" />
                  <h2 className="text-base font-semibold text-gray-100 truncate">
                    {currentFolder.name}
                  </h2>
                  <span className="text-xs text-gray-500">
                    {tFolder('sketchCount', { count: currentFolder.sketchCount })}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-gray-500 truncate">
                  {currentFolder.ref}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {tFolder('inFolderHint')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt(tFolder('rename'), currentFolder.name);
                    if (next && next.trim() && next.trim() !== currentFolder.name) {
                      renameFolder(currentFolder.ref, next.trim());
                    }
                  }}
                  disabled={folderBusy}
                  className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <PencilIcon className="h-3 w-3" />
                  {tFolder('rename')}
                </button>
                <button
                  type="button"
                  onClick={() => deleteFolder(currentFolder.ref)}
                  disabled={folderBusy}
                  className="px-3 py-1.5 text-xs border border-red-700 rounded-md bg-red-900/30 text-red-300 hover:bg-red-900/60 disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <TrashIcon className="h-3 w-3" />
                  {tFolder('delete')}
                </button>
              </div>
            </div>
          )}
          {selected ? (
            <div className="flex flex-1 flex-col gap-4 min-h-0">
              <div className="shrink-0 border border-gray-700 rounded-lg p-6 bg-gray-800 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {editingTitle ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              saveRename();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelRename();
                            }
                          }}
                          disabled={renameBusy}
                          autoFocus
                          className="flex-1 min-w-0 px-3 py-1.5 text-base font-semibold bg-gray-900 border border-gray-600 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500 disabled:opacity-60"
                          placeholder={t('renamePlaceholder')}
                          aria-label={t('renameLabel')}
                        />
                        <button
                          type="button"
                          onClick={saveRename}
                          disabled={renameBusy || !draftTitle.trim()}
                          aria-label={t('renameSave')}
                          title={t('renameSave')}
                          className="h-8 w-8 inline-flex items-center justify-center border border-teal-600 rounded-md bg-teal-700 text-teal-50 hover:bg-teal-600 disabled:opacity-50 disabled:hover:bg-teal-700"
                        >
                          <DiskIcon />
                        </button>
                        <button
                          type="button"
                          onClick={saveAsNew}
                          disabled={renameBusy || !draftTitle.trim()}
                          aria-label={t('renameSaveNew')}
                          title={t('renameSaveNew')}
                          className="h-8 inline-flex items-center justify-center gap-0.5 px-1.5 border border-gray-500 rounded-md bg-gray-700 text-gray-100 hover:bg-gray-600 disabled:opacity-50 disabled:hover:bg-gray-700"
                        >
                          <PlusIcon className="h-3 w-3" />
                          <DiskIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={renameBusy}
                          aria-label={t('renameCancel')}
                          title={t('renameCancel')}
                          className="h-8 w-8 inline-flex items-center justify-center border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                        >
                          <CloseIcon />
                        </button>
                      </div>
                      {renameError && (
                        <p className="text-xs text-red-400">{renameError}</p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startRename}
                      title={t('renameLabel')}
                      className="group flex items-center gap-2 text-left max-w-full"
                    >
                      <h2 className="text-xl font-bold text-gray-100 truncate group-hover:text-teal-300">
                        {selected.title}
                      </h2>
                      <PencilIcon className="h-3.5 w-3.5 shrink-0 text-gray-500 group-hover:text-teal-300" />
                    </button>
                  )}
                  <p className="font-mono text-xs text-gray-500 mt-1">{selected.ref}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {t('mintedAt', { timestamp: formatTimestamp(selected.createdAt) })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRef(null)}
                    aria-label={t('close')}
                    title={t('close')}
                    className="h-8 w-8 inline-flex items-center justify-center border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600"
                  >
                    <CloseIcon />
                  </button>
                  <SketchDownloads sketch={selected} t={t} />
                </div>
              </div>

              <div className="flex-1 min-h-0 border border-gray-700 rounded-lg p-4 bg-gray-800 flex items-center justify-center overflow-hidden">
                <SketchPreviewBody sketch={selected} t={t} fit />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-500">{t('selectPrompt')}</p>
            </div>
          )}
        </div>
      </div>
      )}

      {showNewFolder && (
        <NewFolderModal
          tFolder={tFolder}
          busy={folderBusy}
          onCancel={() => setShowNewFolder(false)}
          onCreate={(name) => createFolder(name)}
        />
      )}

      {showMovePicker && (
        <MoveToFolderModal
          tFolder={tFolder}
          tSelect={tSelect}
          folders={folders}
          currentFolderRef={currentFolderRef}
          count={selectedSet.size}
          busy={moveBusy}
          onCancel={() => setShowMovePicker(false)}
          onChoose={(folderRef) => bulkMoveTo(folderRef)}
        />
      )}

      {previewSketch && (
        <SketchPreviewModal
          t={t}
          sketch={previewSketch}
          onClose={() => setPreviewRef(null)}
        />
      )}

    </div>
  );
}

function FullFolderView({
  t,
  tFolder,
  tSelect,
  query,
  setQuery,
  loading,
  sketches,
  visibleSketches,
  visibleFolders,
  searching,
  currentFolder,
  setCurrentFolderRef,
  folderByRef,
  selectedSet,
  toggleSelected,
  selectAllVisible,
  clearSelection,
  setShowMovePicker,
  bulkDelete,
  moveBusy,
  deleteBusy,
  moveError,
  deleteError,
  folderBusy,
  renameFolder,
  deleteFolder,
  openPreview,
}) {
  const busy = moveBusy || deleteBusy || folderBusy;
  const noneSelected = selectedSet.size === 0;
  return (
    <div className="flex-1 flex flex-col overflow-hidden px-8 py-4 gap-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 max-w-md px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
        {searching ? (
          <p className="text-xs text-gray-400">
            {t('filteredCount', {
              count: visibleSketches.length,
              total: sketches.length,
            })}
          </p>
        ) : currentFolder ? (
          <button
            type="button"
            onClick={() => setCurrentFolderRef(null)}
            className="inline-flex items-center gap-1.5 text-xs text-teal-300 hover:text-teal-200"
          >
            <ChevronLeftIcon />
            {tFolder('rootCrumb')}
          </button>
        ) : (
          <p className="text-xs text-gray-400">
            {t('count', { count: visibleSketches.length })}
          </p>
        )}
      </div>

      {currentFolder && !searching && (
        <div className="shrink-0 border border-gray-700 bg-gray-800 rounded-lg px-5 py-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <FolderIcon className="h-5 w-5 text-amber-400/80" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-100 truncate">
                {currentFolder.name}
              </h2>
              <p className="text-xs text-gray-500">
                {tFolder('sketchCount', { count: currentFolder.sketchCount })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = window.prompt(tFolder('rename'), currentFolder.name);
                if (next && next.trim() && next.trim() !== currentFolder.name) {
                  renameFolder(currentFolder.ref, next.trim());
                }
              }}
              disabled={folderBusy}
              className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <PencilIcon className="h-3 w-3" />
              {tFolder('rename')}
            </button>
            <button
              type="button"
              onClick={() => deleteFolder(currentFolder.ref)}
              disabled={folderBusy}
              className="px-3 py-1.5 text-xs border border-red-700 rounded-md bg-red-900/30 text-red-300 hover:bg-red-900/60 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <TrashIcon className="h-3 w-3" />
              {tFolder('delete')}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto border border-gray-800 rounded-lg bg-gray-900/40">
        {loading && sketches.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {t('loading')}
          </div>
        ) : visibleSketches.length === 0 && visibleFolders.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            {sketches.length === 0
              ? t('emptyState')
              : searching
              ? t('noMatch')
              : currentFolder
              ? tFolder('emptyFolder')
              : t('noMatch')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
            {visibleFolders.map((f) => (
              <button
                key={f.ref}
                type="button"
                onClick={() => setCurrentFolderRef(f.ref)}
                className="group relative border border-gray-700 rounded-lg bg-gray-800/40 hover:border-amber-500/50 hover:bg-gray-800/80 transition text-left flex items-center gap-3 px-3 py-3"
              >
                <div className="h-4 w-4 shrink-0" aria-hidden="true" />
                <FolderIcon className="h-5 w-5 shrink-0 text-amber-400/80 group-hover:text-amber-300" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-gray-100">
                    {f.name}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {tFolder('sketchCount', { count: f.sketchCount })}
                  </p>
                </div>
              </button>
            ))}

            {visibleSketches.map((s) => {
              const isChecked = selectedSet.has(s.ref);
              const sourceFolder = s.folderRef
                ? folderByRef.get(s.folderRef)
                : null;
              const showSourceTag = searching;
              return (
                <SketchTile
                  key={s.ref}
                  sketch={s}
                  isChecked={isChecked}
                  onToggle={() => toggleSelected(s.ref)}
                  onPreview={() => openPreview(s.ref)}
                  sourceFolder={sourceFolder}
                  showSourceTag={showSourceTag}
                  t={t}
                  tFolder={tFolder}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border border-gray-700 bg-gray-800/80 rounded-lg px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-gray-200">
          {tSelect('count', { count: selectedSet.size })}
        </span>
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={visibleSketches.length === 0}
          className="text-xs text-teal-300 hover:text-teal-200 disabled:opacity-40"
        >
          {tSelect('selectAll')}
        </button>
        <span className="text-gray-600 text-xs">·</span>
        <button
          type="button"
          onClick={clearSelection}
          disabled={noneSelected}
          className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-40"
        >
          {tSelect('clear')}
        </button>
        <div className="flex-1" />
        {(moveError || deleteError) && (
          <span className="text-xs text-red-400">
            {moveError || deleteError}
          </span>
        )}
        <button
          type="button"
          disabled={noneSelected || busy}
          onClick={() => setShowMovePicker(true)}
          className="px-3 py-1.5 text-xs border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50 disabled:hover:bg-teal-700"
        >
          {tSelect('moveTo')}
        </button>
        <button
          type="button"
          disabled={noneSelected || busy}
          onClick={bulkDelete}
          className="px-3 py-1.5 text-xs border border-red-700 rounded-md bg-red-900/40 text-red-200 hover:bg-red-900/70 disabled:opacity-50 disabled:hover:bg-red-900/40 inline-flex items-center gap-1.5"
        >
          <TrashIcon className="h-3 w-3" />
          {tSelect('delete')}
        </button>
      </div>
    </div>
  );
}

function SketchTile({
  sketch,
  isChecked,
  onToggle,
  onPreview,
  sourceFolder,
  showSourceTag,
  t,
  tFolder,
}) {
  return (
    <div
      onClick={onToggle}
      className={`group relative border rounded-lg cursor-pointer transition flex items-center gap-3 px-3 py-3 ${
        isChecked
          ? 'border-teal-500 ring-1 ring-teal-500/40 bg-teal-950/30'
          : 'border-gray-700 hover:border-gray-500 bg-gray-800/40 hover:bg-gray-800/70'
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 shrink-0 accent-teal-500 cursor-pointer"
        aria-label={sketch.title}
      />
      <FileIcon
        className={`h-5 w-5 shrink-0 ${
          isChecked ? 'text-teal-300' : 'text-gray-500 group-hover:text-gray-400'
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-gray-100">
          {sketch.title}
        </div>
        {(showSourceTag || (sketch.associations && sketch.associations.length > 0)) && (
          <div className="mt-1 flex flex-wrap gap-1 items-center">
            {showSourceTag && (
              <span className="rounded border border-amber-500/25 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-200">
                {sourceFolder
                  ? tFolder('moveSourceFolder', { name: sourceFolder.name })
                  : tFolder('moveSourceRoot')}
              </span>
            )}
            {sketch.associations?.map((tag) => (
              <span
                key={`${sketch.ref}-${tag.kind}`}
                className="rounded border border-teal-500/25 bg-teal-950/30 px-1.5 py-0.5 text-[10px] font-medium leading-none text-teal-200"
              >
                {associationTagLabel(tag, t)}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
        aria-label={t('viewToggle.openPreview')}
        title={t('viewToggle.openPreview')}
        className="shrink-0 h-7 w-7 inline-flex items-center justify-center bg-gray-900/60 hover:bg-gray-700 border border-gray-700 rounded-md text-gray-400 hover:text-teal-200"
      >
        <ZoomInIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function SketchPreviewModal({ sketch, t, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={sketch.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-700 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-100 truncate">
              {sketch.title}
            </h2>
            <p className="font-mono text-[11px] text-gray-500 mt-1 truncate">
              {sketch.ref}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t('mintedAt', { timestamp: formatTimestamp(sketch.createdAt) })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              title={t('close')}
              className="h-8 w-8 inline-flex items-center justify-center border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              <CloseIcon />
            </button>
            <SketchDownloads sketch={sketch} t={t} />
          </div>
        </div>
        <div className="flex-1 min-h-0 p-6 bg-gray-900 flex items-center justify-center overflow-hidden">
          <SketchPreviewBody sketch={sketch} t={t} fit />
        </div>
      </div>
    </div>
  );
}

function NewFolderModal({ tFolder, busy, onCancel, onCreate }) {
  const [name, setName] = useState('');
  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={tFolder('newFolderTitle')}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-100 mb-4">
          {tFolder('newFolderTitle')}
        </h2>
        <input
          type="text"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) {
              e.preventDefault();
              onCreate(name.trim());
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder={tFolder('namePlaceholder')}
          className="w-full px-3 py-2 mb-4 border border-gray-600 rounded-md text-sm bg-gray-900 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600"
          >
            {tFolder('cancel')}
          </button>
          <button
            type="button"
            disabled={!name.trim() || busy}
            onClick={() => onCreate(name.trim())}
            className="px-3 py-1.5 text-sm border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600 disabled:opacity-50 disabled:hover:bg-teal-700"
          >
            {tFolder('create')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveToFolderModal({
  tFolder,
  tSelect,
  folders,
  currentFolderRef,
  count,
  busy,
  onCancel,
  onChoose,
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={tSelect('moveTo')}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">{tSelect('moveTo')}</h2>
          <span className="text-xs text-gray-400">{tSelect('count', { count })}</span>
        </div>
        <div className="max-h-72 overflow-y-auto -mx-2 px-2 mb-4 border-y border-gray-700/60">
          {currentFolderRef !== null && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose(null)}
              className="w-full text-left border-b border-gray-800 px-2 py-2 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <FolderIcon className="h-3.5 w-3.5 text-gray-400" />
                {tSelect('moveToRoot')}
              </div>
            </button>
          )}
          {folders.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500">
              {tFolder('emptyFolder')}
            </p>
          ) : (
            folders
              .filter((f) => f.ref !== currentFolderRef)
              .map((f) => (
                <button
                  key={f.ref}
                  type="button"
                  disabled={busy}
                  onClick={() => onChoose(f.ref)}
                  className="w-full text-left border-b border-gray-800 px-2 py-2 hover:bg-gray-700 disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <FolderIcon className="h-3.5 w-3.5 text-amber-400/80" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-gray-200">
                        {f.name}
                      </div>
                      <p className="text-[10px] text-gray-500">
                        {tFolder('sketchCount', { count: f.sketchCount })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600"
          >
            {tFolder('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function FolderIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function FolderPlusIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M12 11v6" />
      <path d="M9 14h6" />
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

function ChevronLeftIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function DownloadIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function ExternalLinkIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14L21 3" />
    </svg>
  );
}

function PencilIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function DiskIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function ZoomInIcon({ className = 'h-3.5 w-3.5' }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function PlusIcon({ className = 'h-3.5 w-3.5' }) {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
