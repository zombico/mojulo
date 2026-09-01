'use client';

/**
 * The splayed floor — the library IS the front door.
 *
 * One level up from the viewport home: instead of navigating into /library, the
 * workshop's creative output splays across the landing surface, sorted into the
 * two zones the substrate already distinguishes — 3D (walked, orbited, printed)
 * over 2D (pictures and maps). Each shelf is a strip wearing its own card
 * treatment; a strip header opens the shelf's room in /library. The bench hero
 * keeps the viewport home's one live frame; the outliner/inspector reading of a
 * single artifact stays with `ViewportHome`, which still answers `/?ref=`.
 *
 * Loading posture, per the plan: the floor's data is ONE light request (no
 * manifests on the wire); the only live context is the bench hero, mounted
 * after idle behind its poster still; every card image lazy-loads; strips
 * below the fold render skeletons until they approach the viewport.
 *
 * Rules carried over from the viewport home: the dashboard renders state and
 * never mutates; an empty workshop falls through to the launcher.
 *
 * Design: components/3d-factory-ui.plan.md §10 (the splayed floor).
 */

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import WorkshopHome from '@/components/WorkshopHome';
import { StatusBar } from '@/components/WorkshopChrome';
import TurntableThumb, { useTurntableMode } from '@/components/TurntableCard';
import { Swatch } from '@/components/MaterialShelf';
import WorkshopDrawer from '@/components/WorkshopDrawer';
import { DotRow } from '@/components/brand/DotRow';
import { MATERIAL_PRESETS } from '@/lib/graph/materials/procedural-material';
import { LIBRARY_ZONES, STRIP_LIMITS } from '@/lib/graph/sketch/library-zones';
import { isViewportKind } from '@/lib/graph/sketch/outliner';

const fetcher = (url) => fetch(url).then((r) => r.json());

/* ── lazy scaffolding ─────────────────────────────────────────────────────── */

/** True once the element has approached the viewport. Never goes back to false. */
function useNearViewport(margin = '400px') {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near || !ref.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setNear(true),
      { rootMargin: margin },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [near, margin]);
  return [ref, near];
}

/** True after the browser has had an idle moment — the bench hero's gate. */
function useAfterIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const go = () => setIdle(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(go, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(go, 350);
    return () => clearTimeout(id);
  }, []);
  return idle;
}

function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] text-[color:var(--ink-muted)]">
      <span
        aria-hidden
        className="inline-block h-3 w-3 animate-spin rounded-full border border-[color:var(--ink-muted)] border-t-transparent motion-reduce:animate-none"
      />
      {label}
    </span>
  );
}

function SkeletonCard({ shape = 'card' }) {
  return (
    <div
      aria-hidden
      className={`moj-field-faint animate-pulse rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] motion-reduce:animate-none ${
        shape === 'row' ? 'h-14' : shape === 'wide' ? 'aspect-[16/10]' : 'aspect-[4/3]'
      }`}
    />
  );
}

/* ── shared card chrome ───────────────────────────────────────────────────── */

function FallbackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M13 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9z" />
      <path d="M13 3v6h6" />
    </svg>
  );
}

function Badges({ face }) {
  const t = useTranslations('floor.badge');
  const b = face.badges || {};
  return (
    <span className="flex shrink-0 items-center gap-1">
      {b.audio && <em className="not-italic font-mono text-[10px] text-[color:var(--ink-muted)]">{t('audio')}</em>}
      {b.gi && (
        <em className="not-italic rounded-[3px] border border-[color:var(--live)]/40 px-1 font-mono text-[9px] text-[color:var(--live)]">
          {t('gi')}
        </em>
      )}
      {b.game && (
        <em className="not-italic rounded-[3px] border border-[color:var(--forge-idle)] px-1 font-mono text-[9px] text-[color:var(--forge)]">
          {t('game')}
        </em>
      )}
      {/* Painted is provenance, not decoration — always badged (docs/bicycles.md). */}
      {b.painted && (
        <em className="not-italic rounded-[3px] border border-[color:var(--forge)] bg-[color:var(--forge)]/10 px-1 font-mono text-[9px] text-[color:var(--forge)]">
          {t('painted')}
        </em>
      )}
    </span>
  );
}

function StackChip({ n }) {
  const t = useTranslations('floor');
  if (!n || n < 2) return null;
  return (
    <span className="absolute right-1.5 top-1.5 z-10 rounded-full border border-[color:var(--live)]/50 bg-[color:var(--bay-void)]/80 px-1.5 font-mono text-[10px] text-[color:var(--live)]">
      {t('stack', { n })}
    </span>
  );
}

/**
 * One strip face. The picture is the §6 turntable card fed by the light row's
 * server-derived `renderMode` — no manifest on the client, same stills, same
 * hover-to-turn, same reduced-motion rest frame.
 */
function FaceCard({ face }) {
  const { turntable, strip, turning, promote, handlers } = useTurntableMode(face);
  return (
    <Link
      href={`/sketches/${encodeURIComponent(face.ref)}`}
      {...handlers}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] transition-colors duration-100 hover:border-[color:var(--bay-rail-lit)]"
    >
      <div className="relative">
        <StackChip n={face.stack} />
        <TurntableThumb
          turntable={turntable}
          strip={strip}
          turning={turning}
          promote={promote}
          alt={face.title}
          fallback={<FallbackIcon />}
        />
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-primary)]" title={face.title}>
          {face.title}
        </span>
        <Badges face={face} />
      </div>
    </Link>
  );
}

/** A cast entry: portrait + name + the kit line (what exists, what's missing). */
function CastCard({ face }) {
  const t = useTranslations('floor.kit');
  const { turntable, strip, turning, promote, handlers } = useTurntableMode(face);
  const KIT_KINDS = ['figure', 'character-sheet', 'sprite-sheet'];
  return (
    <Link
      href={`/sketches/${encodeURIComponent(face.ref)}`}
      {...handlers}
      className="group relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] transition-colors duration-100 hover:border-[color:var(--bay-rail-lit)]"
    >
      <div className="relative">
        <StackChip n={face.stack} />
        <TurntableThumb
          turntable={turntable}
          strip={strip}
          turning={turning}
          promote={promote}
          alt={face.title}
          fallback={<FallbackIcon />}
        />
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[12px] text-[color:var(--ink-primary)]" title={face.title}>{face.title}</p>
        <p className="mt-1 flex flex-wrap gap-x-2 font-mono text-[9px]">
          {KIT_KINDS.map((k) => (
            <span
              key={k}
              className={face.kit?.[k] ? 'text-[color:var(--live)]' : 'text-[color:var(--ink-muted)]/60 line-through decoration-transparent'}
            >
              {t(k)} {face.kit?.[k] ? '✓' : '—'}
            </span>
          ))}
        </p>
      </div>
    </Link>
  );
}

/** A reading-room row: diagrams are read, not orbited. */
function DiagramRow({ face }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link
      href={`/sketches/${encodeURIComponent(face.ref)}`}
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] px-3 py-2 transition-colors duration-100 hover:border-[color:var(--bay-rail-lit)]"
    >
      {failed ? (
        <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--bay-rail)] text-[color:var(--ink-muted)]">
          <FallbackIcon />
        </span>
      ) : (
        <img
          src={`/api/sketches/${encodeURIComponent(face.ref)}/svg?inline=1`}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-10 w-16 shrink-0 rounded-[3px] border border-[color:var(--bay-rail)] object-contain"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-primary)]" title={face.title}>
        {face.title}
      </span>
      <Badges face={face} />
    </Link>
  );
}

/* ── strips ───────────────────────────────────────────────────────────────── */

const STRIP_GRID = {
  scenes: 'grid-cols-2 lg:grid-cols-4',
  models: 'grid-cols-3 lg:grid-cols-6',
  characters: 'grid-cols-2 lg:grid-cols-4',
  images: 'grid-cols-3 lg:grid-cols-6',
  diagrams: 'grid-cols-1 md:grid-cols-2',
};

function Strip({ shelfKey, faces, count, zoneTotal, loading, failed, onRetry }) {
  const shelf = useTranslations('library.shelves');
  const t = useTranslations('floor');
  const [ref, near] = useNearViewport();
  const ready = near && !loading;
  const skeletons = Math.min(STRIP_LIMITS[shelfKey] || 4, 6);

  return (
    // A shelf is a REGION of the floor's frame (§7c): it meets its neighbours at
    // a shared hairline instead of floating in a gutter, so the zone reads as one
    // continuous surface with shelves partitioned across it.
    <section ref={ref} className="moj-part-b px-4 py-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h3 className="flex min-w-0 items-center gap-2 truncate text-[14px] font-medium text-[color:var(--ink-primary)]">
          {shelf(shelfKey)}
          {count != null && (
            // The dots read as this shelf's SHARE OF ITS ZONE, not as its raw
            // count: on a real workshop every shelf is in the hundreds, so a
            // one-dot-per-unit row would sit permanently full and say nothing.
            // As a share it compares shelves at a glance, and the mono number
            // beside it stays the thing you actually read — §7c's
            // proportion-not-precision rule, kept honest by the pairing.
            <>
              <DotRow part={count} whole={zoneTotal || count} />
              <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">{count}</span>
            </>
          )}
        </h3>
        <Link
          href={`/library?shelf=${shelfKey}`}
          className="ml-auto font-mono text-[11px] text-[color:var(--live)] hover:underline"
        >
          {t(`open.${shelfKey}`)}
        </Link>
      </div>
      {failed ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--fault)]">
          {t('loadFailed')}
          <button type="button" onClick={onRetry} className="font-mono text-[11px] text-[color:var(--live)] hover:underline">
            {t('retry')}
          </button>
        </p>
      ) : (
        <div className={`mt-2 grid gap-3 ${STRIP_GRID[shelfKey]}`}>
          {!ready
            ? Array.from({ length: skeletons }, (_, i) => (
                <SkeletonCard key={i} shape={shelfKey === 'diagrams' ? 'row' : shelfKey === 'scenes' ? 'wide' : 'card'} />
              ))
            : faces.length === 0
            ? (
              <p className="moj-field col-span-full rounded-[var(--radius-card)] border border-dashed border-[color:var(--bay-rail)] px-3 py-6 text-[12px] text-[color:var(--ink-muted)]">
                {t('emptyStrip')}
              </p>
            )
            : faces.map((face) =>
                shelfKey === 'characters' ? (
                  <CastCard key={face.ref} face={face} />
                ) : shelfKey === 'diagrams' ? (
                  <DiagramRow key={face.ref} face={face} />
                ) : (
                  <FaceCard key={face.ref} face={face} />
                ),
              )}
        </div>
      )}
    </section>
  );
}

/** The registry rail — five presets, always visible, unmistakably 3D. */
function MaterialsRail() {
  const shelf = useTranslations('library.shelves');
  const t = useTranslations('floor');
  const kinds = Object.keys(MATERIAL_PRESETS);
  return (
    <section className="moj-part-b px-4 py-4">
      <div className="flex items-baseline gap-3">
        <h3 className="text-[14px] font-medium text-[color:var(--ink-primary)]">
          {shelf('materials')}
          <span className="ml-2 font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
            {t('presets', { n: kinds.length })}
          </span>
        </h3>
        <Link href="/library?shelf=materials" className="ml-auto font-mono text-[11px] text-[color:var(--live)] hover:underline">
          {t('open.materials')}
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-start gap-3">
        {kinds.map((kind) => (
          <div key={kind} className="w-[84px]">
            <Swatch kind={kind} max={84} />
            <p className="mt-1 truncate text-center font-mono text-[9px] text-[color:var(--ink-muted)]" title={kind}>
              {kind}
            </p>
          </div>
        ))}
        <p className="ml-2 max-w-[26ch] self-center text-[10px] leading-relaxed text-[color:var(--ink-muted)]">
          {t('materialsHint')}
        </p>
      </div>
    </section>
  );
}

/* ── the bench ────────────────────────────────────────────────────────────── */

/**
 * The one live frame on the floor. The poster still (baked at mint time) paints
 * immediately; the iframe mounts only after the browser has gone idle, so the
 * strips and text never wait on a WebGL context. A head that is read rather
 * than walked (a diagram day) just keeps its still.
 */
function BenchHero({ head }) {
  const t = useTranslations('home3d');
  const tf = useTranslations('floor');
  const idle = useAfterIdle();
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);
  const live = isViewportKind(head.renderMode);
  const src = live ? `/api/sketches/${encodeURIComponent(head.ref)}/${head.renderMode}` : null;
  const still = live
    ? `/api/sketches/${encodeURIComponent(head.ref)}/png?inline=1&scale=1`
    : `/api/sketches/${encodeURIComponent(head.ref)}/svg?inline=1`;

  return (
    <div className="flex min-h-[38vh] flex-1 flex-col overflow-hidden rounded-[var(--radius-bay)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-floor)]">
      <div className="relative min-h-0 flex-1 bg-[color:var(--bay-void)]">
        <img
          src={still}
          alt={head.title || head.ref}
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${
            liveLoaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {live && idle && !liveFailed && (
          <iframe
            src={src}
            title={head.title || head.ref}
            onLoad={() => setLiveLoaded(true)}
            onError={() => setLiveFailed(true)}
            className="absolute inset-0 h-full w-full border-0"
          />
        )}
        {live && !liveLoaded && !liveFailed && (
          <span className="absolute bottom-2 right-3 z-10">
            <Spinner label={tf('warming')} />
          </span>
        )}
        {live && liveFailed && (
          <span className="absolute bottom-2 right-3 z-10 rounded-[3px] bg-[color:var(--bay-void)]/80 px-2 py-1 font-mono text-[10px] text-[color:var(--ink-muted)]">
            {tf('liveFailed')}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[color:var(--bay-rail)] px-4 py-2 font-mono text-[10px] text-[color:var(--ink-muted)]">
        <Link
          href={`/sketches/${encodeURIComponent(head.ref)}`}
          className="text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]"
        >
          {head.hud?.ref || head.ref}
        </Link>
        <span>{head.hud?.kind}</span>
        {head.hud?.seed != null && <span>{t('viewport.seed', { seed: String(head.hud.seed) })}</span>}
        {head.hud?.bake && <span className="text-[color:var(--live)]">{t('viewport.baked', { preset: head.hud.bake.preset || '—' })}</span>}
        <Link
          href={`/sketches/${encodeURIComponent(head.ref)}`}
          className="ml-auto text-[color:var(--live)] hover:underline"
        >
          {t('openArtifact')}
        </Link>
      </div>
    </div>
  );
}

function RecentPicks({ faces, loading, failed, onRetry }) {
  const t = useTranslations('floor');
  return (
    <aside className="flex w-full flex-col gap-2 lg:w-[300px] lg:shrink-0">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
        {t('recentPicks')}
      </h3>
      {failed ? (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--fault)]">
          {t('loadFailed')}
          <button type="button" onClick={onRetry} className="font-mono text-[11px] text-[color:var(--live)] hover:underline">
            {t('retry')}
          </button>
        </p>
      ) : loading
        ? Array.from({ length: 3 }, (_, i) => (
            <div key={i} aria-hidden className="h-[72px] animate-pulse rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] motion-reduce:animate-none" />
          ))
        : faces.map((face) => <RecentPick key={face.ref} face={face} />)}
    </aside>
  );
}

function RecentPick({ face }) {
  const { turntable, strip, turning, promote, handlers } = useTurntableMode(face);
  return (
    <Link
      href={`/sketches/${encodeURIComponent(face.ref)}`}
      {...handlers}
      className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] p-2 transition-colors duration-100 hover:border-[color:var(--bay-rail-lit)]"
    >
      <div className="w-20 shrink-0 overflow-hidden rounded-[3px]">
        <TurntableThumb
          turntable={turntable}
          strip={strip}
          turning={turning}
          promote={promote}
          alt={face.title}
          fallback={<FallbackIcon />}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] text-[color:var(--ink-primary)]" title={face.title}>{face.title}</p>
        <p className="mt-0.5 flex items-center gap-2 font-mono text-[9px] text-[color:var(--ink-muted)]">
          <span className="truncate">{face.kind}</span>
          <Badges face={face} />
        </p>
      </div>
    </Link>
  );
}

/* ── the bays, behind one drawer trigger ──────────────────────────────────── */

function MenuIcon({ className = 'h-3 w-3' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

/**
 * The bays no longer splay across the dash — one trigger opens the global
 * Workshop drawer (the same slide-out the nav brand opens), so the floor keeps
 * a single nav model instead of an inline duplicate of it.
 */
function BaysMenu() {
  const t = useTranslations('home');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex items-center gap-1.5 font-mono text-[10px] text-[color:var(--ink-muted)] hover:text-[color:var(--live)]"
      >
        <MenuIcon />
        {t('drawer.open')}
      </button>
      <WorkshopDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ── the floor ────────────────────────────────────────────────────────────── */

function ZoneHeader({ zoneKey, count }) {
  const t = useTranslations('floor');
  return (
    // §7: hairlines are 1px, always. The zone reads as a heavier division
    // through the LIT rail value and its own padded band, not through a 2px
    // border — weight comes from value here, the same way elevation does.
    <div className="flex flex-wrap items-baseline gap-4 border-b border-[color:var(--bay-rail-lit)] bg-[color:var(--bay-void)]/40 px-4 py-3">
      <h2 className="text-[28px] font-semibold leading-none text-[color:var(--ink-primary)]">
        {t(`zones.${zoneKey}`)}
      </h2>
      <p className="font-mono text-[11px] text-[color:var(--ink-muted)]">
        {t(`zoneSub.${zoneKey}`, { n: count ?? 0 })}
      </p>
    </div>
  );
}

export default function SplayedFloor() {
  const t = useTranslations('floor');
  const { data: home, error, isLoading } = useSWR('/api/home', fetcher, { revalidateOnFocus: false });
  const { data: floor, error: floorFetchError, mutate: retryFloor } = useSWR(
    '/api/home/floor',
    fetcher,
    { revalidateOnFocus: false },
  );

  if (isLoading) return <main className="min-h-screen" aria-hidden />;
  // An empty workshop is an invitation, not an empty floor — same fall-through
  // as the viewport home, and the same for a failed read.
  if (error || home?.error || !home?.head) return <WorkshopHome />;

  // A failed floor request must not read as "still loading" forever: the fetcher
  // resolves a 500 body as valid JSON (`{error: ...}`), so both the transport
  // failure and the API's own error field count, and each strip gets a retry
  // rather than spinning on a skeleton nothing will ever fill.
  const floorFailed = Boolean(floorFetchError || floor?.error);
  const floorLoading = !floor && !floorFailed;
  const strips = floor?.strips || {};
  const counts = floor?.counts || home.library?.counts || {};
  const zones = floor?.zones || {};

  return (
    <main className="flex min-h-screen flex-col">
      {/* One frame for the whole floor; the bench band and each zone are its
          regions, divided by hairlines they share (3d-factory-ui.plan.md §7c).
          Padding lives on the regions, never between them. */}
      <div className="flex-1 px-6 py-4">
       <div className="moj-frame">
        <div className="moj-part-b px-4 py-3">
        {/* the bench — the one live frame, and what was just touched */}
        <div className="flex items-baseline gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
            {t('bench')}
          </h2>
          <div className="ml-auto">
            <BaysMenu />
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row">
          <BenchHero head={home.head} />
          <RecentPicks faces={floor?.recent || []} loading={floorLoading} failed={floorFailed} onRetry={retryFloor} />
        </div>
        </div>

        {/* the zones — every strip is a shelf, every header opens its room */}
        {LIBRARY_ZONES.map((zone) => (
          <section key={zone.key} className="moj-part-b">
            <ZoneHeader zoneKey={zone.key} count={zones[zone.key]} />
            {zone.shelves.map((shelfKey) =>
              shelfKey === 'materials' ? (
                <MaterialsRail key={shelfKey} />
              ) : (
                <Strip
                  key={shelfKey}
                  shelfKey={shelfKey}
                  faces={strips[shelfKey] || []}
                  count={counts[shelfKey]}
                  zoneTotal={zones[zone.key]}
                  loading={floorLoading}
                  failed={floorFailed}
                  onRetry={retryFloor}
                />
              ),
            )}
          </section>
        ))}
       </div>
      </div>
      <StatusBar status={home.status} queue={home.queue} library={home.library} note={t('capNote')} />
    </main>
  );
}
