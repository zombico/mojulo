'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import CreationMap from '@/components/graph/CreationMap';
import WorkshopShell from '@/components/WorkshopShell';
import DisplayModes, { useDisplayModeState } from '@/components/DisplayModes';
import MaterialShelf from '@/components/MaterialShelf';
import LibraryRoom from '@/components/rooms/LibraryRooms';
import TurntableThumb, { useTurntable } from '@/components/TurntableCard';
import { LIBRARY_SHELVES, filterToShelf, shelfByKey, shelfFetchBucket } from '@/lib/graph/sketch/library-shelves';
import { kindOf, renderModeOf } from '@/lib/graph/sketch/sketch-summary';

// Preview body for one sketch, dispatched on its renderer mode so scene /
// illustration kinds (fractal-city, turntables, …) render via their /scene or
// /svg endpoint and never fall through to <CreationMap> (which assumes a diagram
// `viewBox` and throws on a scene manifest). Shared by the split-view preview and
// the full-view modal so the dispatch lives in exactly one place.
//
// The list rows are SUMMARIES (sketch-summary.js): `renderMode` comes from the
// server and only diagram-mode rows carry a `manifest` — which is exactly the
// one branch here that renders from the recipe (CreationMap). Every other mode
// is an <img>/<iframe> on a by-ref endpoint.
function SketchPreviewBody({ sketch, t, fit = false, view = null }) {
  // Hooks run unconditionally, ahead of the early returns below. The live src
  // (whichever kind supplies one) drives the spinner — an iframe otherwise shows
  // nothing while its scene constructs, with no signal it is even trying.
  const mode = renderModeOf(sketch);
  const liveKind = view?.kind === 'iframe' || ['world', 'scene', 'beats', 'game'].includes(mode);
  const liveSrc = view?.kind === 'iframe'
    ? view.src
    : liveKind
      ? `/api/sketches/${encodeURIComponent(sketch?.ref || '')}/${mode}`
      : null;
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);
  useEffect(() => {
    setFrameLoaded(false);
    setFrameFailed(false);
  }, [liveSrc]);

  if (!mode) return <p className="text-sm text-red-400">{t('invalidManifest')}</p>;
  const invalid = <p className="text-sm text-red-400">{t('invalidManifest')}</p>;

  const frameProps = {
    onLoad: () => setFrameLoaded(true),
    onError: () => setFrameFailed(true),
  };
  const frameOverlay = (
    <>
      {!frameLoaded && !frameFailed && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--text-muted)] border-t-transparent motion-reduce:animate-none" />
        </div>
      )}
      {frameFailed && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-[color:var(--text-muted)]">{t('frameFailed')}</p>
        </div>
      )}
    </>
  );

  // When the artifact carries a display-mode control, the chosen mode decides what
  // renders; the dispatch below is the fallback for the kinds that don't (beats,
  // game), which have exactly one way of being experienced.
  if (view?.kind === 'img') {
    return (
      <img key={view.src} src={view.src} alt={sketch.title || sketch.ref} className="max-w-full max-h-full block" />
    );
  }
  if (view?.kind === 'iframe') {
    return (
      <div className="relative w-full h-full">
        <iframe
          key={view.src}
          src={view.src}
          title={sketch.title || sketch.ref}
          {...frameProps}
          className="absolute inset-0 w-full h-full border-0 block"
        />
        {frameOverlay}
      </div>
    );
  }
  if (view?.kind === 'diagram') {
    if (!sketch.manifest) return invalid;
    return (
      <CreationMap
        manifest={sketch.manifest}
        technical={false}
        mode={view.wireframe ? 'wireframe' : 'color'}
        fit={fit}
      />
    );
  }
  const ref = encodeURIComponent(sketch.ref);
  if (mode === 'svg') {
    return (
      <img
        src={`/api/sketches/${ref}/svg?inline=1`}
        alt={sketch.title || sketch.ref}
        className="max-w-full max-h-full block"
      />
    );
  }
  if (mode === 'world' || mode === 'scene' || mode === 'beats' || mode === 'game') {
    // The live kinds (navigable three.js worlds, CSS-3D turntables, beats audio
    // players, playable game shells) render live in the preview/modal — a single
    // mounted <iframe> on the same /world (or /scene, /beats, /game) endpoint
    // the detail page uses. Only one is ever mounted at a time (the selected
    // sketch), so there's no per-card live-context cost here.
    return (
      <div className="relative w-full h-full">
        <iframe
          src={liveSrc}
          title={sketch.title || sketch.ref}
          {...frameProps}
          className="absolute inset-0 w-full h-full border-0 block"
        />
        {frameOverlay}
      </div>
    );
  }
  if (!sketch.manifest) return invalid;
  return <CreationMap manifest={sketch.manifest} technical={false} fit={fit} />;
}

// The shared download/open affordances for a previewed sketch, used by both the
// split-view header and the full-view modal. SVG download is offered only for
// kinds that have a vector form (illustration SVGs + CreationMap diagrams), and
// the baked PNG is offered for those same still kinds. The 3D world/scene kinds
// render live inline (see SketchPreviewBody) and are traversed in a new tab, so
// they expose no still export here.
/**
 * The Library filter chips. Mojulo's buckets are load-bearing internally but are
 * not what a person asks for, so the chip carries the colloquial word and the
 * shelf model maps it back onto the bucket. A shelf with nothing on it still
 * shows, greyed with its zero — a chip that appears and disappears as you mint
 * things is a worse map of the workshop than one that admits it is empty.
 */
function ShelfChips({ shelf, counts, onChange }) {
  const t = useTranslations('library.shelves');
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-8 pt-1 pb-3">
      {LIBRARY_SHELVES.map((s) => {
        const isActive = s.key === shelf;
        const count = counts?.[s.key];
        const empty = count === 0;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(s.key)}
            className={`px-2.5 py-1 text-xs rounded-[var(--radius-control)] border transition-colors duration-100 ${
              isActive
                ? 'border-[color:var(--live)] bg-[color:var(--live)]/10 text-[color:var(--live)]'
                : empty
                ? 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)]/50 hover:text-[color:var(--ink-muted)]'
                : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:border-[color:var(--bay-rail-lit)] hover:text-[color:var(--ink-secondary)]'
            }`}
          >
            {t(s.key)}
            {count != null && (
              <span className="ml-1.5 font-mono text-[10px] opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SketchDownloads({ sketch, t }) {
  const ref = encodeURIComponent(sketch.ref);
  const mode = renderModeOf(sketch);
  const hasSvg = mode === 'svg' || mode === 'diagram';
  // world/scene render live (no still export); beats are audio-only (no still
  // form at all); a game is played, not pictured.
  const hasPng = mode !== 'world' && mode !== 'scene' && mode !== 'beats' && mode !== 'game';
  // beats export straight off the shelf: the .wav (audio) and — for the
  // musical kinds — the .mid score (sfx cues are foley choreography, wav-only).
  const hasWav = mode === 'beats';
  const hasMid = mode === 'beats' && kindOf(sketch) !== 'beats-sfx';
  return (
    <div className="flex items-center gap-2">
      <a
        href={mode === 'beats' ? `/beats/${ref}` : mode === 'game' ? `/api/sketches/${ref}/game` : `/sketches/${ref}`}
        target="_blank"
        rel="noreferrer"
        className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
      >
        <ExternalLinkIcon />
        {t('openNewTab')}
      </a>
      {hasWav && (
        <a
          href={`/api/beats/${ref}.wav`}
          className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
        >
          <DownloadIcon />
          {t('exportWav')}
        </a>
      )}
      {hasMid && (
        <a
          href={`/api/beats/${ref}.mid`}
          className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
        >
          <DownloadIcon />
          {t('exportMidi')}
        </a>
      )}
      {hasSvg && (
        <a
          href={`/api/sketches/${ref}/svg`}
          className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
        >
          <DownloadIcon />
          {t('downloadSvg')}
        </a>
      )}
      {hasPng && (
        <a
          href={`/api/sketches/${ref}/png`}
          className="px-3 py-1.5 text-xs border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600 inline-flex items-center gap-1.5"
        >
          <DownloadIcon />
          {t('downloadPng')}
        </a>
      )}
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
// illustration concern). `bucket` ('diagram' | 'illustration' | 'world' | 'object' | 'beats' | null) narrows
// the list to one concern; null shows every sketch. `heading`/`subtitle`
// override the default copy. A diagram and an illustration are the same sketch
// primitive — this only changes which bucket the list is filtered to.
// Strings that say "sketch" get a beats-worded override on the Beats shelf —
// on the surface a beats artifact is a track, not a sketch (the `sketches`
// table underneath is storage, not vocabulary).
const BEATS_NOUN_KEYS = new Set([
  'total', 'count', 'emptyState', 'noMatch', 'selectPrompt', 'invalidManifest',
  'openNewTab',
  'exportWav', 'exportMidi',
]);

// `shell` puts the gallery inside the workshop shell — the home/floor rounded
// frame whose top strip is the page's ONLY nav (AuthNav and the breadcrumb bar
// stand down on /library). Off (the beats rail), the gallery keeps its classic
// full-bleed layout under the global chrome.
export default function SketchGallery({ bucket = null, heading, subtitle, shelves = false, initialShelf = 'recent', shell = false, authEnabled = false, shellCrumb = null, shellWidth = 1600 } = {}) {
  const tBase = useTranslations('sketchesIndex');
  const tBeats = useTranslations('sketchesIndex.beatsNoun');
  const t = useCallback(
    (key, values) => (bucket === 'beats' && BEATS_NOUN_KEYS.has(key) ? tBeats(key, values) : tBase(key, values)),
    [bucket, tBase, tBeats],
  );
  const tFolder = useTranslations('sketchesIndex.folder');
  const tLibrary = useTranslations('library');
  const [sketches, setSketches] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);

  // Folder context: null = root; a non-null fld_… puts the sidebar into a
  // folder view.
  const [currentFolderRef, setCurrentFolderRef] = useState(null);

  // Full folder view hides the preview pane, shows sketches as a grid, and
  // pops a modal for preview-on-demand. Split view (default) is the original
  // two-pane UI.
  // Library shelf (the filter chips). Only meaningful in `shelves` mode; the
  // legacy bucket-per-route callers never leave 'recent'.
  const [shelf, setShelf] = useState(initialShelf);
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
      // Scope the read to the shelf's bucket. SketchRepository.list() caps an
      // unscoped read at rootLimit but scans the whole table for a bucket-scoped
      // one, so this is what keeps a shelf from silently truncating.
      const scope = shelves ? shelfFetchBucket(shelf) : bucket;
      const res = await fetch(scope ? `/api/sketches?bucket=${scope}` : '/api/sketches');
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
  }, [bucket, shelves, shelf]);

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

  // The active shelf, applied before folder/search narrowing so a chip and a
  // folder compose rather than fight. Outside `shelves` mode this is identity.
  const shelvedSketches = useMemo(
    () => (shelves ? filterToShelf(sketches, shelf) : sketches),
    [shelves, sketches, shelf],
  );
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    if (!shelves) return;
    let live = true;
    fetch('/api/sketches/counts')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.counts) setCounts(d.counts); })
      .catch(() => {});
    return () => { live = false; };
  }, [shelves]);
  const onRegistryShelf = shelves && shelfByKey(shelf).registry;
  // The shelf's room — its contextual body (board / wall / cast / masonry /
  // rows), dispatched the same way the registry shelf swaps in MaterialShelf.
  // Full folder view still wins: the toggle moves between them.
  const roomView = shelves && !fullView ? shelfByKey(shelf).view || null : null;

  // What appears in the left rail. When searching, results span all folders
  // (the user said: "Search sketch results is separate") so folder context
  // is bypassed and folder rows are hidden. Otherwise we render the sketches
  // for the current folder context only.
  const visibleSketches = useMemo(() => {
    if (searching) {
      const q = trimmedQuery.toLowerCase();
      return shelvedSketches.filter(
        (s) =>
          s.title?.toLowerCase().includes(q) ||
          s.ref?.toLowerCase().includes(q),
      );
    }
    return shelvedSketches.filter((s) => (s.folderRef || null) === currentFolderRef);
  }, [shelvedSketches, currentFolderRef, searching, trimmedQuery]);

  // Folder rows only appear in the root view. Once you've entered a folder
  // (or you're searching), the sidebar is just sketches — no sibling-folder
  // clutter at the top of the list.
  const visibleFolders = searching || currentFolderRef ? [] : folders;

  const selected = sketches.find((s) => s.ref === selectedRef) || null;
  // Every ref in view, so a `<ref>_gi` GI-bake variant is spotted without a
  // round-trip. Memoized once for the whole list, shared by both preview surfaces.
  const refSet = useMemo(() => new Set(sketches.map((s) => s.ref)), [sketches]);
  const selectedModes = useDisplayModeState(selected, refSet);

  // The gallery is a fixed-height instrument whose panes scroll internally. In
  // shell mode the height comes from the shell (flex-1 of the viewport); classic
  // mode keeps subtracting the 66px of global chrome it sits under.
  const gallery = (
    <div className={shell ? 'flex min-h-0 flex-1 flex-col' : 'h-[calc(100vh-66px)] flex flex-col bg-gray-900'}>
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{heading || t('title')}</h1>
          <p className="text-xs text-gray-400 mt-1">{subtitle || t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* A registry shelf holds no sketches, so a sketch total there is noise. */}
          {!onRegistryShelf && (
            <span className="text-sm text-gray-400">
              {t('total', { count: shelves ? shelvedSketches.length : sketches.length })}
            </span>
          )}
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
              {shelves && shelfByKey(shelf).view ? tLibrary('roomToggle') : t('viewToggle.split')}
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
        </div>
      </div>

      {shelves && shelfByKey(shelf).capped && (
        <p className="px-8 pb-1 text-[11px] text-[color:var(--ink-muted)]">{tLibrary('recentNote')}</p>
      )}
      {shelves && (
        <ShelfChips
          shelf={shelf}
          counts={counts}
          onChange={(next) => {
            setShelf(next);
            // A ref that just left the shelf must not stay selected behind the chips.
            setSelectedRef(null);
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              if (next === 'recent') url.searchParams.delete('shelf');
              else url.searchParams.set('shelf', next);
              window.history.replaceState(null, '', url);
            }
          }}
        />
      )}

      {error && (
        <div className="mx-8 mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {onRegistryShelf ? (
        <div className="flex-1 overflow-y-auto px-8 pb-4">
          <MaterialShelf />
        </div>
      ) : roomView ? (
        <div className="flex-1 overflow-y-auto px-8 pb-6">
          <LibraryRoom view={roomView} sketches={shelvedSketches} loading={loading} />
        </div>
      ) : fullView ? (
        <FullFolderView
          t={t}
          tFolder={tFolder}
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

          {/* Folder breadcrumb */}
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
                        <button
                          type="button"
                          onClick={() => setSelectedRef(s.ref)}
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
              </div>
            </div>
          )}
          {selected ? (
            <div className="flex flex-1 flex-col gap-4 min-h-0">
              <div className="shrink-0 border border-gray-700 rounded-lg p-6 bg-gray-800 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-gray-100 truncate">
                    {selected.title}
                  </h2>
                  <p className="font-mono text-xs text-gray-500 mt-1">{selected.ref}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {t('mintedAt', { timestamp: formatTimestamp(selected.createdAt) })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRef(null)}
                      aria-label={t('close')}
                      title={t('close')}
                      className="h-8 w-8 inline-flex items-center justify-center border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <DisplayModes
                      resolved={selectedModes.resolved}
                      active={selectedModes.active}
                      onChange={selectedModes.setMode}
                    />
                    <SketchDownloads sketch={selected} t={t} />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 border border-gray-700 rounded-lg p-4 bg-gray-800 flex items-center justify-center overflow-hidden">
                <SketchPreviewBody sketch={selected} t={t} fit view={selectedModes.view} />
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

      {previewSketch && (
        <SketchPreviewModal
          t={t}
          sketch={previewSketch}
          refSet={refSet}
          onClose={() => setPreviewRef(null)}
        />
      )}

    </div>
  );

  if (!shell) return gallery;

  return (
    // The workshop shell, worn the library's way: pinned to the viewport
    // because the gallery scrolls inside its panes rather than down the page,
    // and wider still than the floor's 1400px — the rooms behind the shelf
    // chips are walls of cards. The shell fetches its own strip pills.
    <WorkshopShell posture="pinned" width={shellWidth} authEnabled={authEnabled} crumb={shellCrumb ?? tLibrary('crumb')}>
      {gallery}
    </WorkshopShell>
  );
}

function FullFolderView({
  t,
  tFolder,
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
  openPreview,
}) {
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
              const sourceFolder = s.folderRef
                ? folderByRef.get(s.folderRef)
                : null;
              const showSourceTag = searching;
              return (
                <SketchTile
                  key={s.ref}
                  sketch={s}
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
    </div>
  );
}

/**
 * One grid card. The picture is the card (§6): a still at rest, turning through
 * its baked azimuth strip while the pointer is on it — which is what makes a
 * shelf of models read as 3D rather than as a file list. The hover handlers ride
 * the card ROOT, so anywhere on the card turns the picture; a click opens the
 * preview.
 */
function SketchTile({
  sketch,
  onPreview,
  sourceFolder,
  showSourceTag,
  t,
  tFolder,
}) {
  const { turntable, strip, turning, promote, handlers } = useTurntable(sketch);
  return (
    <div
      onClick={onPreview}
      {...handlers}
      className="group relative border rounded-[var(--radius-card)] cursor-pointer transition flex flex-col overflow-hidden border-gray-700 hover:border-gray-500 bg-gray-800/40 hover:bg-gray-800/70"
    >
      <TurntableThumb
        turntable={turntable}
        strip={strip}
        turning={turning}
        promote={promote}
        alt={sketch.title}
        fallback={<FileIcon className="h-6 w-6" />}
      />
      <div className="flex items-center gap-2 px-3 py-2.5">
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
          className="shrink-0 h-7 w-7 inline-flex items-center justify-center bg-gray-900/60 hover:bg-gray-700 border border-gray-700 rounded-[var(--radius-control)] text-gray-400 hover:text-teal-200"
        >
          <ZoomInIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SketchPreviewModal({ sketch, t, onClose, refSet }) {
  const modes = useDisplayModeState(sketch, refSet);
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
            <DisplayModes resolved={modes.resolved} active={modes.active} onChange={modes.setMode} />
          </div>
        </div>
        <div className="flex-1 min-h-0 p-6 bg-gray-900 flex items-center justify-center overflow-hidden">
          <SketchPreviewBody sketch={sketch} t={t} fit view={modes.view} />
        </div>
      </div>
    </div>
  );
}

export function FileIcon({ className = 'h-3.5 w-3.5' }) {
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

export function FolderIcon({ className = 'h-3.5 w-3.5' }) {
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

export function CloseIcon({ className = 'h-3.5 w-3.5' }) {
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

export function ExternalLinkIcon({ className = 'h-3.5 w-3.5' }) {
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
