'use client';

/**
 * The splayed floor — the library IS the front door.
 *
 * One level up from the viewport home: instead of navigating into /library, the
 * workshop's creative output splays across the landing surface, sorted into the
 * two zones the substrate already distinguishes — 3D (walked, orbited, printed:
 * worlds, turntables, solids, views, characters, materials) over 2D (pictures
 * and maps). Each shelf is a strip wearing its own card treatment; a strip's
 * band opens the shelf in /library. There is no bench: the floor never mounts
 * a live frame, and the outliner/inspector reading of a single artifact stays
 * with `ViewportHome`, which still answers `?ref=`.
 *
 * Loading posture, per the plan: the floor's data is ONE light request (no
 * manifests on the wire); every card image lazy-loads; strips below the fold
 * render skeletons until they approach the viewport.
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
import WorkshopShell from '@/components/WorkshopShell';
import { StatusBar } from '@/components/WorkshopChrome';
import TurntableThumb, { useTurntableMode } from '@/components/TurntableCard';
import { Swatch } from '@/components/MaterialShelf';
import { MATERIAL_PRESETS } from '@/lib/graph/materials/procedural-material';
import { LIBRARY_ZONES, STRIP_LIMITS } from '@/lib/graph/sketch/library-zones';

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
  turntables: 'grid-cols-3 lg:grid-cols-6',
  models: 'grid-cols-3 lg:grid-cols-6',
  views: 'grid-cols-3 lg:grid-cols-6',
  characters: 'grid-cols-2 lg:grid-cols-4',
  images: 'grid-cols-3 lg:grid-cols-6',
  diagrams: 'grid-cols-1 md:grid-cols-2',
};

function Strip({ shelfKey, faces, loading, failed, onRetry }) {
  const t = useTranslations('floor');
  const [ref, near] = useNearViewport();
  const ready = near && !loading;
  const skeletons = Math.min(STRIP_LIMITS[shelfKey] || 4, 6);

  return (
    // The shelf's name, share and room link live on the zone's tab band now —
    // the panel is just the faces.
    <div ref={ref} role="tabpanel" className="px-4 py-4">
      {failed ? (
        <p className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--fault)]">
          {t('loadFailed')}
          <button type="button" onClick={onRetry} className="font-mono text-[11px] text-[color:var(--live)] hover:underline">
            {t('retry')}
          </button>
        </p>
      ) : (
        <div className={`grid gap-3 ${STRIP_GRID[shelfKey]}`}>
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
    </div>
  );
}

/** The registry rail — five presets, always visible, unmistakably 3D. */
function MaterialsRail() {
  const t = useTranslations('floor');
  const kinds = Object.keys(MATERIAL_PRESETS);
  return (
    <div role="tabpanel" className="px-4 py-4">
      <div className="flex flex-wrap items-start gap-3">
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
    </div>
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

/**
 * One zone of the floor: its heavyweight header band, then its shelves behind
 * tabs — one strip at a time, so a zone never asks the operator to scroll past
 * every shelf it owns. A tab is the strip header it replaced, made selectable:
 * the same 14px name with its plain mono count beside it (dot-row meters were
 * retired 2026-09-01 at the maintainer's direction — numbers are enough). Hue
 * carries state: the resting tab is muted ink, the selected one is lit and
 * wears the live hue as a 1px underline riding ON the band's own rail
 * (`-mb-px`) — value swapped along a shared hairline, never a second border.
 * The active shelf's room link keeps the band's right edge.
 */
function ZoneSection({ zone, zoneTotal, counts, strips, loading, failed, onRetry }) {
  const shelf = useTranslations('library.shelves');
  const t = useTranslations('floor');
  const [active, setActive] = useState(zone.shelves[0]);
  const presetCount = Object.keys(MATERIAL_PRESETS).length;

  return (
    <section className="moj-part-b">
      <ZoneHeader zoneKey={zone.key} count={zoneTotal} />

      <div
        role="tablist"
        aria-label={t(`zones.${zone.key}`)}
        className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 pt-3"
      >
        {zone.shelves.map((shelfKey) => {
          const selected = shelfKey === active;
          return (
            <button
              key={shelfKey}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(shelfKey)}
              className={`-mb-px flex items-center gap-2 border-b pb-2.5 text-[14px] font-medium transition-colors duration-100 ${
                selected
                  ? 'border-[color:var(--live)] text-[color:var(--ink-primary)]'
                  : 'border-transparent text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
              }`}
            >
              {shelf(shelfKey)}
              <span className="font-mono text-[11px] font-normal tabular-nums">
                {shelfKey === 'materials' ? presetCount : counts[shelfKey] ?? 0}
              </span>
            </button>
          );
        })}
        <Link
          href={`/library?shelf=${active}`}
          className="ml-auto pb-2.5 font-mono text-[11px] text-[color:var(--live)] hover:underline"
        >
          {t('openShelf')}
        </Link>
      </div>

      {active === 'materials' ? (
        <MaterialsRail />
      ) : (
        <Strip
          shelfKey={active}
          faces={strips[active] || []}
          loading={loading}
          failed={failed}
          onRetry={onRetry}
        />
      )}
    </section>
  );
}

export default function SplayedFloor({ authEnabled = false }) {
  const t = useTranslations('floor');
  // The floor is left open while the agent works elsewhere, so it re-reads
  // when the tab regains focus (SWR's default, throttled) and every half
  // minute while it is visible. Both payloads are light, and SWR only
  // re-renders when the bytes actually change, so a quiet workshop costs
  // nothing and a mint or an in-place edit shows up without a reload.
  const FRESH = { revalidateOnFocus: true, refreshInterval: 30_000, keepPreviousData: true };
  const { data: home, error, isLoading } = useSWR('/api/home', fetcher, FRESH);
  const { data: floor, error: floorFetchError, mutate: retryFloor } = useSWR('/api/home/floor', fetcher, FRESH);

  if (isLoading) return <main className="min-h-screen" aria-hidden />;
  // An empty workshop is an invitation, not an empty floor — same fall-through
  // as the viewport home, and the same for a failed read. The chrome stands
  // down on the floor, so the fallback directory serves as the nav here.
  if (error || home?.error || !home?.head) return <WorkshopHome asNav authEnabled={authEnabled} />;

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
    /* One SHELL for the whole floor — the same object the front door is: its
       top strip is the page's only header (AuthNav and the breadcrumb bar
       stand down on the floor), and the bench band, each zone and the status
       bar are its regions, divided by hairlines they share
       (3d-factory-ui.plan.md §7c). Padding lives on the regions, never between
       them. Wider than the front door's 1040px: the directory is a page you
       read and leave, the floor is a gallery — same object, more bench. */
    <WorkshopShell
      posture="scroll"
      width={1400}
      authEnabled={authEnabled}
      packs={home.status?.packs || []}
      total={home.library?.total}
      crumb={t('crumb')}
    >
        {/* the zones — both stand as sections, each tabbing its OWN shelves;
            every tab opens a strip, the band's room link opens everything. A
            shelf's inactive strips unmount: they were lazy skeletons anyway,
            and SWR holds the one floor payload every shelf reads, so switching
            costs nothing. Selection is plain state, deliberately not a query
            param — a tab is a filter on one surface, not a place (the
            Breadcrumbs rule), and `?ref=` already owns this route's deep
            reading. */}
        {LIBRARY_ZONES.map((zone) => (
          <ZoneSection
            key={zone.key}
            zone={zone}
            zoneTotal={zones[zone.key]}
            counts={counts}
            strips={strips}
            loading={floorLoading}
            failed={floorFailed}
            onRetry={retryFloor}
          />
        ))}

      <StatusBar status={home.status} queue={home.queue} library={home.library} note={t('capNote')} />
    </WorkshopShell>
  );
}
