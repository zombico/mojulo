'use client';

/**
 * The library rooms — one contextual body per shelf.
 *
 * A strip on the splayed floor opens here. Each room reads the SAME bucket
 * fetch the gallery already made (full sketch objects, manifests included — the
 * room adds nothing to the wire) and renders the shelf the way that kind of
 * artifact is actually used: a scene is scouted on a board, a model is turned
 * on a wall, a character is cast, an image is hung, a diagram is read. The
 * dispatch is the `view` field on LIBRARY_SHELVES — the same body-swap the
 * Materials registry shelf proved.
 *
 * Read-only, like the rest of the dashboard: rooms select, preview, and hand
 * out copy-prompts; management (folders, bulk move/delete) stays in the full
 * folder view, one toggle away. The only live context a room ever mounts is
 * the board's focus iframe, and only after a scene is selected.
 *
 * Design: components/3d-factory-ui.plan.md §11 (the rooms), wireframes round 1.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import CreationMap from '@/components/graph/CreationMap';
import TurntableThumb, { useTurntable } from '@/components/TurntableCard';
import WorldViewStrip, { useWorldViewProtocol } from '@/components/WorldViewStrip';
import { buildOutliner, groupOutliner } from '@/lib/graph/sketch/outliner';
import { sketchRenderMode } from '@/lib/graph/sketch/sketch-manifest';
import {
  ROOM_FACETS,
  castGroups,
  collapseStems,
  facetCounts,
  facetKeyFor,
} from '@/lib/graph/sketch/library-zones';

/* ── shared bits ──────────────────────────────────────────────────────────── */

function shortDate(value) {
  if (!value) return '';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : '';
}

function FallbackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9z" />
      <path d="M13 3v6h6" />
    </svg>
  );
}

function StackChip({ n }) {
  const t = useTranslations('rooms');
  if (!n || n < 2) return null;
  return (
    <span className="absolute right-1.5 top-1.5 z-10 rounded-full border border-[color:var(--live)]/50 bg-[color:var(--bay-void)]/80 px-1.5 font-mono text-[10px] text-[color:var(--live)]">
      {t('stack', { n })}
    </span>
  );
}

/** Badge facts straight off the manifest — the room HAS the manifest. */
function RoomBadges({ sketch }) {
  const t = useTranslations('floor.badge');
  const m = sketch.manifest || {};
  return (
    <span className="flex shrink-0 items-center gap-1">
      {m.audio && <em className="not-italic font-mono text-[10px] text-[color:var(--ink-muted)]">{t('audio')}</em>}
      {m.giBake && (
        <em className="not-italic rounded-[3px] border border-[color:var(--live)]/40 px-1 font-mono text-[9px] text-[color:var(--live)]">{t('gi')}</em>
      )}
      {m.game && (
        <em className="not-italic rounded-[3px] border border-[color:var(--forge-idle)] px-1 font-mono text-[9px] text-[color:var(--forge)]">{t('game')}</em>
      )}
      {sketch.hasBoundRender && (
        <em className="not-italic rounded-[3px] border border-[color:var(--forge)] bg-[color:var(--forge)]/10 px-1 font-mono text-[9px] text-[color:var(--forge)]">{t('painted')}</em>
      )}
    </span>
  );
}

/** Facet + search narrowing, shared by every room that has facets. */
function useRoomRows(sketches, shelfKey) {
  const [facet, setFacet] = useState(null);
  const [query, setQuery] = useState('');
  const counts = useMemo(() => facetCounts(shelfKey, sketches), [shelfKey, sketches]);
  const rows = useMemo(() => {
    let out = sketches;
    if (facet) out = out.filter((s) => facetKeyFor(shelfKey, s.manifest?.kind) === facet);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((s) => s.title?.toLowerCase().includes(q) || s.ref?.toLowerCase().includes(q));
    return out;
  }, [sketches, shelfKey, facet, query]);
  return { facet, setFacet, query, setQuery, counts, rows };
}

function RoomChrome({ shelfKey, filter, total }) {
  const t = useTranslations('rooms');
  const facets = ROOM_FACETS[shelfKey] || [];
  return (
    // The chrome is a partition of the room, not a floating toolbar: it closes
    // with the hairline the grid below shares (3d-factory-ui.plan.md §7c).
    <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[color:var(--bay-rail)] pb-3">
      {facets.length > 0 && (
        <>
          <button
            type="button"
            aria-pressed={!filter.facet}
            onClick={() => filter.setFacet(null)}
            className={`px-2 py-0.5 font-mono text-[11px] rounded-[var(--radius-control)] ${
              !filter.facet ? 'text-[color:var(--live)]' : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
            }`}
          >
            {t('all')} <span className="tabular-nums opacity-60">{total}</span>
          </button>
          {facets.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter.facet === f.key}
              onClick={() => filter.setFacet(filter.facet === f.key ? null : f.key)}
              className={`px-2 py-0.5 font-mono text-[11px] rounded-[var(--radius-control)] ${
                filter.facet === f.key ? 'text-[color:var(--live)]' : 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
              }`}
            >
              {t(`facets.${shelfKey}.${f.key}`)}{' '}
              <span className="tabular-nums opacity-60">{filter.counts[f.key] || 0}</span>
            </button>
          ))}
        </>
      )}
      <input
        type="search"
        value={filter.query}
        onChange={(e) => filter.setQuery(e.target.value)}
        placeholder={t('search')}
        className="ml-auto w-56 rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-2.5 py-1 text-[12px] text-[color:var(--ink-primary)] placeholder:text-[color:var(--ink-muted)] focus:border-[color:var(--live)] focus:outline-none"
      />
    </div>
  );
}

/**
 * "Nothing here" needs to say WHY, or it reads as a dead end. A shelf that has
 * never had anything minted into it is a different story than a facet/search
 * that just matched zero of the shelf's real rows.
 */
function RoomEmpty({ shelfKey, totalEmpty = false }) {
  const t = useTranslations('rooms');
  const shelf = useTranslations('library.shelves');
  if (totalEmpty) {
    // A never-minted shelf is latent space, and it wears the field (§7c) —
    // the same plate the floor's empty strips carry. A facet/search that
    // matched zero of the shelf's REAL rows is not latent, so it stays plain.
    return (
      <div className="moj-field rounded-[var(--radius-card)] border border-dashed border-[color:var(--bay-rail)] py-10 text-center">
        <p className="text-[12px] text-[color:var(--ink-muted)]">{t('emptyShelf', { shelf: shelf(shelfKey) })}</p>
        <p className="mt-1 font-mono text-[10px] text-[color:var(--ink-muted)]/70">{t('emptyShelfHint')}</p>
      </div>
    );
  }
  return <p className="py-10 text-center text-[12px] text-[color:var(--ink-muted)]">{t('empty')}</p>;
}

function CardShell({ onClick, active, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border text-left transition-colors duration-100 ${
        active
          ? 'border-[color:var(--live)] bg-[color:var(--live)]/5'
          : 'border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] hover:border-[color:var(--bay-rail-lit)]'
      }`}
    >
      {children}
    </button>
  );
}

function FaceThumb({ sketch, stack }) {
  const { turntable, strip, turning, promote, handlers } = useTurntable(sketch);
  return (
    <div className="relative" {...handlers}>
      <StackChip n={stack} />
      <TurntableThumb
        turntable={turntable}
        strip={strip}
        turning={turning}
        promote={promote}
        alt={sketch.title}
        fallback={<FallbackIcon />}
      />
    </div>
  );
}

function OpenRecipeLink({ refId, className = '' }) {
  const t = useTranslations('rooms');
  return (
    // New tab by default: the link lives inside a modal over a filtered,
    // scrolled room — navigating in place would throw that position away.
    <Link
      href={`/sketches/${encodeURIComponent(refId)}`}
      target="_blank"
      rel="noreferrer"
      className={`font-mono text-[11px] text-[color:var(--live)] hover:underline ${className}`}
    >
      {t('open')}
    </Link>
  );
}

/**
 * The bench deep view — `/dashboard?ref=` opens the artifact in the floor's
 * outliner/viewport/inspector panes (phase 6 said "the Library doesn't link
 * back"; this is the link back). New tab for the same reason as the recipe
 * link: the room's scroll position must survive the excursion.
 */
function OpenBenchLink({ refId, className = '' }) {
  const t = useTranslations('rooms');
  return (
    <Link
      href={`/dashboard?ref=${encodeURIComponent(refId)}`}
      target="_blank"
      rel="noreferrer"
      className={`font-mono text-[11px] text-[color:var(--live)] hover:underline ${className}`}
    >
      {t('openBench')}
    </Link>
  );
}

/**
 * The room modal — selection opens OVER the grid, never above it. A card deep
 * in a thousand-model wall must not teleport its details to the top of the
 * page (the first cut did, and the operator had to scroll up to see them).
 * Same dismissals as the print wall's lightbox: esc, click-away, ✕.
 */
function RoomModal({ label, onClose, wide = false, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--bay-void)]/85 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[88vh] w-full overflow-y-auto rounded-[var(--radius-bay)] border border-[color:var(--bay-rail-lit)] bg-[color:var(--bay-bench)] p-4 shadow-2xl ${
          wide ? 'max-w-5xl' : 'max-w-md'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** The one agent-directed affordance: state rendered, ask handed over. */
function CopyPromptButton({ label, prompt }) {
  const t = useTranslations('rooms');
  const [state, setState] = useState('idle'); // idle | copied | failed
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setState('copied');
    } catch {
      // Clipboard access can be blocked (insecure context, denied permission) —
      // say so instead of leaving the button silently inert.
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  }, [prompt]);
  return (
    <button
      type="button"
      onClick={onCopy}
      title={prompt}
      className={`rounded-[var(--radius-control)] border px-2 py-1 font-mono text-[10px] transition-colors duration-100 ${
        state === 'failed'
          ? 'border-[color:var(--fault)] text-[color:var(--fault)]'
          : 'border-[color:var(--forge-idle)] text-[color:var(--forge)] hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10'
      }`}
    >
      {state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : label}
    </button>
  );
}

/* ── the wall (models) ────────────────────────────────────────────────────── */

function WallRoom({ sketches }) {
  const t = useTranslations('rooms');
  const filter = useRoomRows(sketches, 'models');
  const faces = useMemo(() => collapseStems(filter.rows), [filter.rows]);
  const [sel, setSel] = useState(null);          // the selected face
  const [activeRef, setActiveRef] = useState(null);   // sibling shown in the drawer
  const active = useMemo(() => {
    if (!sel) return null;
    return sel.siblings.find((s) => s.ref === activeRef) || sel;
  }, [sel, activeRef]);
  const exportable = active && ['world', 'scene'].includes(sketchRenderMode(active.manifest));

  return (
    <div>
      <RoomChrome shelfKey="models" filter={filter} total={sketches.length} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {faces.length === 0 && (
          <div className="col-span-full"><RoomEmpty shelfKey="models" totalEmpty={sketches.length === 0} /></div>
        )}
        {faces.map((face) => (
          <CardShell
            key={face.ref}
            active={sel?.ref === face.ref}
            onClick={() => { setSel(face); setActiveRef(face.ref); }}
          >
            <FaceThumb sketch={face} stack={face.stack} />
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-primary)]" title={face.title}>
                {face.title}
              </span>
              <RoomBadges sketch={face} />
            </div>
          </CardShell>
        ))}
      </div>

      {active && (
        <RoomModal label={active.title} onClose={() => setSel(null)}>
          <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--ink-primary)]" title={active.title}>
                {active.title}
              </p>
              <button
                type="button"
                onClick={() => setSel(null)}
                aria-label={t('close')}
                className="shrink-0 font-mono text-[12px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]"
              >
                ✕
              </button>
            </div>
            <div className="mt-2 overflow-hidden rounded-[var(--radius-card)]">
              <FaceThumb sketch={active} />
            </div>
            <div className="mt-2 rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] p-2 font-mono text-[10px] leading-relaxed text-[color:var(--ink-muted)]">
              <p>{active.manifest?.kind}</p>
              {active.manifest?.seed != null && <p>{t('seed', { seed: String(active.manifest.seed) })}</p>}
              <p>{shortDate(active.createdAt)}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {/* Unavailable is disabled with the reason, never hidden — the same
                  rule DisplayModes already holds to for display modes. */}
              {exportable ? (
                <>
                  <a
                    href={`/api/sketches/${encodeURIComponent(active.ref)}/model.stl`}
                    className="rounded-[var(--radius-control)] bg-[color:var(--live)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--bay-void)] hover:opacity-90"
                  >
                    {t('stl')}
                  </a>
                  <a
                    href={`/api/sketches/${encodeURIComponent(active.ref)}/model.glb`}
                    className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-secondary)] hover:border-[color:var(--live)]"
                  >
                    {t('glb')}
                  </a>
                </>
              ) : (
                <>
                  <span
                    title={t('notExportable')}
                    className="cursor-not-allowed rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-muted)] opacity-60"
                  >
                    {t('stl')}
                  </span>
                  <span
                    title={t('notExportable')}
                    className="cursor-not-allowed rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-muted)] opacity-60"
                  >
                    {t('glb')}
                  </span>
                </>
              )}
              <OpenBenchLink refId={active.ref} className="ml-auto" />
              <OpenRecipeLink refId={active.ref} />
            </div>
            {sel.siblings.length > 1 && (
              <div className="mt-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
                  {t('versions', { n: sel.siblings.length })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sel.siblings.map((s) => (
                    <button
                      key={s.ref}
                      type="button"
                      onClick={() => setActiveRef(s.ref)}
                      title={s.title}
                      className={`max-w-[120px] truncate rounded-[var(--radius-control)] border px-1.5 py-0.5 font-mono text-[10px] ${
                        s.ref === active.ref
                          ? 'border-[color:var(--live)] text-[color:var(--live)]'
                          : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
        </RoomModal>
      )}
    </div>
  );
}

/* ── the board (scenes) ───────────────────────────────────────────────────── */

function BoardRoom({ sketches }) {
  const t = useTranslations('rooms');
  const tOut = useTranslations('home3d.outliner');
  const filter = useRoomRows(sketches, 'scenes');
  const faces = useMemo(() => collapseStems(filter.rows), [filter.rows]);
  const [sel, setSel] = useState(null);
  const [activeRef, setActiveRef] = useState(null);
  const active = useMemo(() => {
    if (!sel) return null;
    return sel.siblings.find((s) => s.ref === activeRef) || sel;
  }, [sel, activeRef]);
  const branches = useMemo(
    () => (active ? groupOutliner(buildOutliner(active.manifest)) : []),
    [active],
  );
  const mode = active ? sketchRenderMode(active.manifest) : null;
  const live = mode === 'world' || mode === 'scene';
  const focusSrc = live ? `/api/sketches/${encodeURIComponent(active.ref)}/${mode}` : null;
  const [frameLoaded, setFrameLoaded] = useState(false);
  const frameRef = useRef(null);
  // The view-cube preset strip, protocol-gated: only a /world frame announces
  // ready, so a CSS-3D scene keeps its plain frame (phase 8 left this seam open).
  const { ready: viewReady, send: sendView } = useWorldViewProtocol(frameRef, focusSrc);
  useEffect(() => { setFrameLoaded(false); }, [active?.ref]);

  return (
    <div>
      <RoomChrome shelfKey="scenes" filter={filter} total={sketches.length} />

      {/* The focus modal — the live frame, mounted only once a scene is chosen. */}
      {active && (
        <RoomModal label={active.title} onClose={() => setSel(null)} wide>
          <div className="flex flex-col gap-3 lg:flex-row">
          <div className="flex min-h-[52vh] flex-1 flex-col overflow-hidden rounded-[var(--radius-bay)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)]">
            {live ? (
              <div className="relative min-h-0 flex-1">
                <iframe
                  ref={frameRef}
                  key={active.ref}
                  src={focusSrc}
                  title={active.title}
                  onLoad={() => setFrameLoaded(true)}
                  className="h-full w-full border-0"
                />
                <WorldViewStrip ready={viewReady} send={sendView} />
                {!frameLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--ink-muted)] border-t-transparent motion-reduce:animate-none" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <img src={`/api/sketches/${encodeURIComponent(active.ref)}/svg?inline=1`} alt={active.title} className="max-h-full max-w-full" />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[color:var(--bay-rail)] px-3 py-1.5 font-mono text-[10px] text-[color:var(--ink-muted)]">
              <span className="text-[color:var(--ink-secondary)]">{active.ref}</span>
              <span>{active.manifest?.kind}</span>
              {active.manifest?.seed != null && <span>{t('seed', { seed: String(active.manifest.seed) })}</span>}
              <RoomBadges sketch={active} />
              {live && (
                <a
                  href={`/api/sketches/${encodeURIComponent(active.ref)}/${mode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto font-mono text-[11px] text-[color:var(--live)] hover:underline"
                >
                  {t('openWorld')}
                </a>
              )}
              <OpenBenchLink refId={active.ref} className={live ? '' : 'ml-auto'} />
              <OpenRecipeLink refId={active.ref} />
            </div>
          </div>
          <aside className="w-full shrink-0 lg:w-[280px]">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--ink-primary)]" title={active.title}>{active.title}</p>
              <button type="button" onClick={() => setSel(null)} aria-label={t('close')} className="shrink-0 font-mono text-[12px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">✕</button>
            </div>
            <div className="mt-2">
              {branches.map(({ group, branches: rows }) => (
                <p key={group} className="py-0.5 font-mono text-[11px] text-[color:var(--ink-muted)]">
                  <span className="text-[color:var(--ink-secondary)]">{tOut(`group.${group}`)}</span>
                  {' — '}
                  {rows.map((b) => `${b.named && tOut.has(`branch.${b.key}`) ? tOut(`branch.${b.key}`) : b.key} ${b.count}`).join(' · ')}
                </p>
              ))}
              {branches.length === 0 && (
                <p className="py-0.5 font-mono text-[11px] italic text-[color:var(--ink-muted)]">{tOut('flat')}</p>
              )}
            </div>
            {sel.siblings.length > 1 && (
              <div className="mt-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]">
                  {t('versions', { n: sel.siblings.length })}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sel.siblings.map((s) => (
                    <button
                      key={s.ref}
                      type="button"
                      onClick={() => setActiveRef(s.ref)}
                      title={s.title}
                      className={`max-w-[130px] truncate rounded-[var(--radius-control)] border px-1.5 py-0.5 font-mono text-[10px] ${
                        s.ref === active.ref
                          ? 'border-[color:var(--live)] text-[color:var(--live)]'
                          : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
          </div>
        </RoomModal>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {faces.length === 0 && (
          <div className="col-span-full"><RoomEmpty shelfKey="scenes" totalEmpty={sketches.length === 0} /></div>
        )}
        {faces.map((face) => (
          <CardShell
            key={face.ref}
            active={sel?.ref === face.ref}
            onClick={() => { setSel(face); setActiveRef(face.ref); }}
          >
            <FaceThumb sketch={face} stack={face.stack} />
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-primary)]" title={face.title}>
                {face.title}
              </span>
              <RoomBadges sketch={face} />
            </div>
          </CardShell>
        ))}
      </div>
    </div>
  );
}

/* ── the cast (characters) ────────────────────────────────────────────────── */

const KIT_KINDS = ['figure', 'character-sheet', 'sprite-sheet'];

function castName(title) {
  return (title || '').trim().split(/\s+[—–-]\s+|:\s+/)[0] || title;
}

function CastRoom({ sketches }) {
  const t = useTranslations('rooms');
  const tKit = useTranslations('floor.kit');
  const filter = useRoomRows(sketches, 'characters');
  const groups = useMemo(() => castGroups(filter.rows), [filter.rows]);
  const [selRef, setSelRef] = useState(null);
  const sel = useMemo(() => groups.find((g) => g.ref === selRef) || null, [groups, selRef]);
  const [tab, setTab] = useState(null);
  const tabKinds = useMemo(() => (sel ? KIT_KINDS.filter((k) => sel.kit[k]) : []), [sel]);
  const activeTab = tab && tabKinds.includes(tab) ? tab : tabKinds[0] || null;
  const tabRows = useMemo(
    () => (sel && activeTab ? sel.siblings.filter((s) => s.manifest?.kind === activeTab) : []),
    [sel, activeTab],
  );
  const missing = useMemo(() => (sel ? KIT_KINDS.filter((k) => !sel.kit[k]) : []), [sel]);

  return (
    <div>
      <RoomChrome shelfKey="characters" filter={filter} total={sketches.length} />

      {sel && (
        <RoomModal label={castName(sel.title)} onClose={() => setSelRef(null)} wide>
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="w-full shrink-0 overflow-hidden rounded-[var(--radius-bay)] border border-[color:var(--bay-rail)] lg:w-[260px]">
            <FaceThumb sketch={sel} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate text-[14px] text-[color:var(--ink-primary)]">{castName(sel.title)}</p>
              <button type="button" onClick={() => setSelRef(null)} aria-label={t('close')} className="shrink-0 font-mono text-[12px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">✕</button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tabKinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  aria-pressed={k === activeTab}
                  className={`rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[11px] ${
                    k === activeTab
                      ? 'border-[color:var(--live)] text-[color:var(--live)]'
                      : 'border-[color:var(--bay-rail)] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
                  }`}
                >
                  {tKit(k)} <span className="tabular-nums opacity-60">{sel.kit[k]}</span>
                </button>
              ))}
              {missing.map((k) => (
                <CopyPromptButton
                  key={k}
                  label={t('mintMissing', { piece: tKit(k) })}
                  prompt={t('mintPrompt', { name: castName(sel.title), piece: tKit(k), ref: sel.ref })}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {tabRows.map((s) => (
                <Link
                  key={s.ref}
                  href={`/sketches/${encodeURIComponent(s.ref)}`}
                  className="w-[140px] shrink-0 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] hover:border-[color:var(--bay-rail-lit)]"
                  title={s.title}
                >
                  <FaceThumb sketch={s} />
                  <p className="truncate px-2 py-1 text-[10px] text-[color:var(--ink-muted)]">{s.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
        </RoomModal>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {groups.length === 0 && (
          <div className="col-span-full"><RoomEmpty shelfKey="characters" totalEmpty={sketches.length === 0} /></div>
        )}
        {groups.map((g) => (
          <CardShell key={g.ref} active={selRef === g.ref} onClick={() => { setSelRef(g.ref); setTab(null); }}>
            <FaceThumb sketch={g} stack={g.stack} />
            <div className="px-2.5 py-2">
              <p className="truncate text-[12px] text-[color:var(--ink-primary)]" title={g.title}>{castName(g.title)}</p>
              <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[9px]">
                {KIT_KINDS.map((k) => (
                  <span key={k} className={g.kit[k] ? 'text-[color:var(--live)]' : 'text-[color:var(--ink-muted)]/60'}>
                    {tKit(k)} {g.kit[k] ? '✓' : '—'}
                  </span>
                ))}
              </p>
            </div>
          </CardShell>
        ))}
      </div>
    </div>
  );
}

/* ── the print wall (images) ──────────────────────────────────────────────── */

function MasonryRoom({ sketches }) {
  const t = useTranslations('rooms');
  const tBadge = useTranslations('floor.badge');
  const filter = useRoomRows(sketches, 'images');
  // Folded like every other room — this store has back-to-back 135-sibling QA
  // chains, and an unfolded wall would be two hundred identical prints.
  const rows = useMemo(() => collapseStems(filter.rows), [filter.rows]);
  const [lightbox, setLightbox] = useState(null);   // index into rows
  const open = lightbox != null ? rows[lightbox] : null;

  const step = useCallback(
    (d) => setLightbox((i) => (i == null ? i : (i + d + rows.length) % rows.length)),
    [rows.length],
  );
  useEffect(() => {
    if (lightbox == null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, step]);

  return (
    <div>
      <RoomChrome shelfKey="images" filter={filter} total={sketches.length} />
      {rows.length === 0 && <RoomEmpty shelfKey="images" totalEmpty={sketches.length === 0} />}
      {/* Natural-aspect masonry: CSS columns, each print at its own shape. */}
      <div style={{ columns: '5 220px', columnGap: '12px' }}>
        {rows.map((s, i) => (
          <button
            key={s.ref}
            type="button"
            onClick={() => setLightbox(i)}
            className="relative mb-3 block w-full overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] hover:border-[color:var(--bay-rail-lit)]"
            style={{ breakInside: 'avoid' }}
            title={s.title}
          >
            <StackChip n={s.stack} />
            {s.hasBoundRender && (
              <span className="absolute left-1.5 top-1.5 z-10 rounded-[3px] border border-[color:var(--forge)] bg-[color:var(--bay-void)]/80 px-1 font-mono text-[9px] text-[color:var(--forge)]">
                {tBadge('painted')}
              </span>
            )}
            <img
              src={`/api/sketches/${encodeURIComponent(s.ref)}/svg?inline=1`}
              alt={s.title}
              loading="lazy"
              decoding="async"
              className="block w-full"
            />
          </button>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.title}
          className="fixed inset-0 z-50 flex flex-col bg-[color:var(--bay-void)]/95 p-6"
          onClick={() => setLightbox(null)}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center gap-4" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => step(-1)} aria-label={t('prev')} className="px-3 text-2xl text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">‹</button>
            <img
              src={`/api/sketches/${encodeURIComponent(open.ref)}/svg?inline=1`}
              alt={open.title}
              className="max-h-full min-h-0 max-w-full object-contain"
            />
            <button type="button" onClick={() => step(1)} aria-label={t('next')} className="px-3 text-2xl text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]">›</button>
          </div>
          <div className="mx-auto mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[color:var(--ink-muted)]" onClick={(e) => e.stopPropagation()}>
            <span className="text-[color:var(--ink-primary)]">{open.title}</span>
            {open.hasBoundRender && <span className="text-[color:var(--forge)]">{t('paintedLine')}</span>}
            <a href={`/api/sketches/${encodeURIComponent(open.ref)}/svg`} className="text-[color:var(--live)] hover:underline">{t('svg')}</a>
            <a href={`/api/sketches/${encodeURIComponent(open.ref)}/png`} className="text-[color:var(--live)] hover:underline">{t('png')}</a>
            <OpenRecipeLink refId={open.ref} />
            <button type="button" onClick={() => setLightbox(null)} className="hover:text-[color:var(--ink-primary)]">{t('close')} · esc</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── the reading room (diagrams) ──────────────────────────────────────────── */

function RowsRoom({ sketches }) {
  const t = useTranslations('rooms');
  const filter = useRoomRows(sketches, 'diagrams');
  const [expandedRef, setExpandedRef] = useState(null);

  return (
    <div>
      <RoomChrome shelfKey="diagrams" filter={filter} total={sketches.length} />
      {filter.rows.length === 0 && <RoomEmpty shelfKey="diagrams" totalEmpty={sketches.length === 0} />}
      <div className="flex flex-col gap-2">
        {filter.rows.map((s) => {
          const expanded = expandedRef === s.ref;
          return (
            <div key={s.ref} className="rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)]">
              <div className="flex items-center gap-3 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setExpandedRef(expanded ? null : s.ref)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <img
                    src={`/api/sketches/${encodeURIComponent(s.ref)}/svg?inline=1`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-10 w-16 shrink-0 rounded-[3px] border border-[color:var(--bay-rail)] object-contain"
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-primary)]" title={s.title}>
                    {s.title}
                  </span>
                  <span className={`font-mono text-[11px] text-[color:var(--ink-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
                </button>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">{shortDate(s.createdAt)}</span>
                <a href={`/api/sketches/${encodeURIComponent(s.ref)}/svg`} className="shrink-0 font-mono text-[10px] text-[color:var(--live)] hover:underline">{t('svg')}</a>
                <a href={`/api/sketches/${encodeURIComponent(s.ref)}/png`} className="shrink-0 font-mono text-[10px] text-[color:var(--live)] hover:underline">{t('png')}</a>
                <OpenRecipeLink refId={s.ref} />
              </div>
              {expanded && (
                <div className="border-t border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] p-4">
                  {sketchRenderMode(s.manifest) === 'svg' ? (
                    <img src={`/api/sketches/${encodeURIComponent(s.ref)}/svg?inline=1`} alt={s.title} className="mx-auto max-h-[60vh]" />
                  ) : (
                    <div className="mx-auto max-h-[60vh] overflow-auto">
                      <CreationMap manifest={s.manifest} technical={false} fit />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── dispatch ─────────────────────────────────────────────────────────────── */

const ROOMS = { wall: WallRoom, board: BoardRoom, cast: CastRoom, masonry: MasonryRoom, rows: RowsRoom };

export default function LibraryRoom({ view, sketches, loading }) {
  const Room = ROOMS[view];
  if (!Room) return null;
  if (loading && sketches.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="moj-field-faint aspect-[4/3] animate-pulse rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  return <Room sketches={sketches} />;
}
