'use client';

/**
 * The viewport home — a workshop, not a menu.
 *
 * The old home was three abstract mode buttons opening a drawer of sixteen tiles:
 * nothing the operator had MADE was on the landing surface, which is a strange
 * argument for a 3D factory. This replaces it with the thing itself — outliner,
 * viewport, inspector, status bar — over the pieces the earlier phases built.
 *
 * Three rules it holds to:
 *   · The dashboard is not a conversational surface. The Inspector's one amber
 *     card hands over a prompt; it does not chat.
 *   · Nothing here is new data. Display modes, shelf counts, queue depth and the
 *     bake ledger all already existed; §8 put this phase last for that reason.
 *   · An empty workshop is an invitation, not an error — it falls through to the
 *     launcher rather than drawing an empty viewport.
 *
 * Design: components/3d-factory-ui.plan.md §3.
 */

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';

import CreationMap from './graph/CreationMap';
import DisplayModes, { useDisplayModeState } from './DisplayModes';
import HomeLauncher from './HomeLauncher';
import { visibleWorkshopGroups } from './workshop-nav';
import { LIBRARY_SHELVES } from '@/lib/graph/sketch/library-shelves';
import { buildOutliner, groupOutliner, isViewportKind } from '@/lib/graph/sketch/outliner';
import { formatBytes, tallyOutputKinds } from '@/lib/render-bay/lanes';

const fetcher = (url) => fetch(url).then((r) => r.json());

/* ── shared bits ──────────────────────────────────────────────────────────── */

function Eyebrow({ children }) {
  return (
    <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
      {children}
    </h2>
  );
}

function SubEyebrow({ children }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[color:var(--ink-muted)]/70">
      {children}
    </p>
  );
}

/** Agent-directed prompt text, handed over rather than executed. */
function CopyPrompt({ value }) {
  const t = useTranslations('home3d');
  const [state, setState] = useState('idle'); // idle | copied | failed
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Clipboard access can be blocked (insecure context, denied permission) —
      // say so instead of leaving the button silently inert.
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  }, [value]);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={onCopy}
      title={value}
      className={`w-full rounded-[var(--radius-control)] border px-2 py-1.5 text-left font-mono text-[10px] transition-colors duration-100 ${
        state === 'failed'
          ? 'border-[color:var(--fault)] text-[color:var(--fault)]'
          : 'border-[color:var(--forge-idle)] text-[color:var(--forge)] hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10'
      }`}
    >
      {state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : t('inspector.askCopy')}
    </button>
  );
}

/* ── left rail: the outliner ──────────────────────────────────────────────── */

function Outliner({ head, library }) {
  const t = useTranslations('home3d');
  const shelf = useTranslations('library.shelves');
  const branches = useMemo(() => groupOutliner(buildOutliner(head?.manifest)), [head]);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Eyebrow>{t('outliner.title')}</Eyebrow>
        <div className="mt-2">
          <p className="truncate text-[13px] text-[color:var(--ink-primary)]" title={head.title}>
            {head.title || head.ref}
          </p>
          <p className="font-mono text-[10px] text-[color:var(--ink-muted)]">{head.hud?.kind}</p>
          {branches.length === 0 && (
            <p className="mt-2 text-[11px] text-[color:var(--ink-muted)]">{t('outliner.flat')}</p>
          )}
          {branches.map(({ group, branches: rows }) => (
            <div key={group} className="mt-3">
              <SubEyebrow>{t(`outliner.group.${group}`)}</SubEyebrow>
              <ul className="mt-1">
                {rows.map((b) => (
                  <li key={b.key} className="flex items-baseline gap-2 py-0.5">
                    {/* A branch mojulo has no word for is still real structure —
                        drawn in a quieter register rather than hidden or invented. */}
                    <span
                      className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                        b.named ? 'text-[color:var(--ink-secondary)]' : 'italic text-[color:var(--ink-muted)]'
                      }`}
                      title={b.named ? undefined : t('outliner.unnamed')}
                    >
                      {b.named && t.has(`outliner.branch.${b.key}`) ? t(`outliner.branch.${b.key}`) : b.key}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
                      {b.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <Eyebrow>{t('shelves')}</Eyebrow>
        <ul className="mt-2">
          {LIBRARY_SHELVES.filter((s) => !s.registry && s.key !== 'recent').map((s) => (
            <li key={s.key}>
              <Link
                href={`/library?shelf=${s.key}`}
                className="flex items-baseline gap-2 py-0.5 text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]"
              >
                <span className="min-w-0 flex-1 truncate text-[12px]">{shelf(s.key)}</span>
                <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
                  {library?.counts?.[s.key] ?? '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ── the bays, as flat rows rather than a drawer ──────────────────────────── */

function Bays({ presence }) {
  const t = useTranslations('home');
  const t3d = useTranslations('home3d');
  const groups = visibleWorkshopGroups(presence);
  return (
    <section>
      <Eyebrow>{t3d('bays')}</Eyebrow>
      <div className="mt-2 flex flex-col gap-3">
        {groups.map((group) => (
          <div key={group.key}>
            <SubEyebrow>{t(`groups.${group.key}`)}</SubEyebrow>
            <ul className="mt-1">
              {group.tiles.map((tile) => (
                <li key={tile.href}>
                  <Link
                    href={tile.href}
                    className="flex items-center gap-2 py-0.5 text-[12px] text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]"
                  >
                    <tile.Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t(`tiles.${tile.key}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── centre: the viewport ─────────────────────────────────────────────────── */

/**
 * The live artifact.
 *
 * §3 also asks for a view-cube here, and one already exists — INSIDE the frame.
 * `/world` serves its own HUD strip (view cams, wireframe, fly/walk) unless
 * `?hud=0`, and the camera lives in the world's own three.js context where
 * nothing outside the iframe can reach it without a postMessage protocol that
 * does not exist. So the camera control stays where it already works, and this
 * strip carries the readouts instead.
 */
function Viewport({ head, view }) {
  const t = useTranslations('home3d');
  const src = view?.src
    || (isViewportKind(head.renderMode)
      ? `/api/sketches/${encodeURIComponent(head.ref)}/${head.renderMode}`
      : null);
  // Reset whenever the frame's own src changes, so switching artifact or display
  // mode shows the spinner again instead of the previous frame's "loaded" state.
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [frameFailed, setFrameFailed] = useState(false);
  useEffect(() => {
    setFrameLoaded(false);
    setFrameFailed(false);
  }, [src]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[var(--radius-bay)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-floor)]">
      <div className="relative min-h-0 flex-1 bg-[color:var(--bay-void)]">
        {view?.kind === 'img' ? (
          <img
            key={view.src}
            src={view.src}
            alt={head.title || head.ref}
            className="h-full w-full object-contain"
          />
        ) : view?.kind === 'diagram' ? (
          // A diagram IS looked at — it just isn't a world. Same renderer the
          // gallery and the detail page use, so the wire reading agrees with them.
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            <CreationMap manifest={head.manifest} technical={false} mode={view.wireframe ? 'wireframe' : 'color'} fit />
          </div>
        ) : src ? (
          <>
            {/* Keyed on src so switching display mode remounts the frame rather
                than leaving the previous world's WebGL context running behind it. */}
            <iframe
              key={src}
              src={src}
              title={head.title || head.ref}
              onLoad={() => setFrameLoaded(true)}
              onError={() => setFrameFailed(true)}
              className="h-full w-full border-0"
            />
            {!frameLoaded && !frameFailed && (
              <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--ink-muted)] border-t-transparent motion-reduce:animate-none" />
              </div>
            )}
            {frameFailed && (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <p className="text-[13px] text-[color:var(--ink-muted)]">{t('viewport.frameFailed')}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="text-[13px] text-[color:var(--ink-muted)]">{t('viewport.noReading')}</p>
          </div>
        )}
      </div>
      <HudStrip hud={head.hud} renderMode={head.renderMode} />
    </div>
  );
}

function HudStrip({ hud, renderMode }) {
  const t = useTranslations('home3d');
  if (!hud) return null;
  const { scale } = hud;
  // Only geometry kinds get the export readouts. A flowchart has no STL and no
  // triangles, and printing "stl reads 1 unit = 1 mm" under one would be a claim
  // about an export that does not exist for it.
  const exportable = isViewportKind(renderMode);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[color:var(--bay-rail)] px-4 py-2 font-mono text-[10px] text-[color:var(--ink-muted)]">
      <Link
        href={`/sketches/${encodeURIComponent(hud.ref)}`}
        className="text-[color:var(--ink-secondary)] hover:text-[color:var(--live)]"
      >
        {hud.ref}
      </Link>
      <span>{hud.kind}</span>
      {hud.seed != null && <span>{t('viewport.seed', { seed: String(hud.seed) })}</span>}
      {hud.parts > 0 && <span>{t('viewport.parts', { n: hud.parts })}</span>}
      {/* The scale readout says what is TRUE. §3 wanted "1 unit = 1 m · stl-ready";
          the STL writer reads units as millimetres at scale 1, so an undeclared
          recipe cannot claim metres and a metre recipe needs scale 1000. */}
      {exportable && (
        <span className="text-[color:var(--think)]">
          {scale.declared
            ? t('viewport.scaleDeclared', { unit: scale.declared, scale: scale.stlScale })
            : t('viewport.scaleUndeclared')}
        </span>
      )}
      {hud.bake ? (
        <span className="text-[color:var(--live)]">
          {t('viewport.baked', { preset: hud.bake.preset || '—' })}
        </span>
      ) : exportable ? (
        <span>{t('viewport.noBake')}</span>
      ) : null}
      {exportable && <span className="ml-auto">{t('viewport.triHint')}</span>}
    </div>
  );
}

/* ── right rail: the inspector ────────────────────────────────────────────── */

function BoundArtifacts({ outcome }) {
  const t = useTranslations('home3d');
  const kind = useTranslations('renderBay.outputs.kind');
  if (!outcome?.files?.length) {
    return <p className="mt-2 text-[11px] text-[color:var(--ink-muted)]">{t('inspector.boundEmpty')}</p>;
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {tallyOutputKinds(outcome.files).map(({ kind: k, count }) => (
          <span
            key={k}
            className="rounded-[3px] border border-[color:var(--bay-rail-lit)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-muted)]"
          >
            {kind(k)}
            {count > 1 && <span className="tabular-nums"> ×{count}</span>}
          </span>
        ))}
      </div>
      <a href={outcome.url} className="mt-2 inline-block font-mono text-[10px] text-[color:var(--live)] hover:underline">
        {t('inspector.openFolder', { size: formatBytes(outcome.bytes) })}
      </a>
    </div>
  );
}

function Inspector({ head, outcome }) {
  const t = useTranslations('home3d');
  const recipe = useMemo(() => JSON.stringify(head.manifest, null, 2), [head]);
  // Agent-directed text, not UI chrome — the one place the home points at the
  // host agent, because the dashboard never mutates.
  const prompt = `Open the mojulo artifact ${head.ref} ("${head.title || head.ref}") — read its recipe, tell me what it is made of, and propose one change. Revise it with update_sketch; get_sketch_vocab has the vocabulary.`;

  return (
    <>
      <section>
        <Eyebrow>{t('inspector.askTitle')}</Eyebrow>
        <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--ink-muted)]">{t('inspector.askBody')}</p>
        <div className="mt-2">
          <CopyPrompt value={prompt} />
        </div>
      </section>

      <section>
        <Eyebrow>{t('inspector.bound')}</Eyebrow>
        <BoundArtifacts outcome={outcome} />
      </section>

      <section className="flex flex-col">
        <Eyebrow>{t('inspector.recipe')}</Eyebrow>
        {/* Capped rather than flex-filled: a manji-tree recipe is 167 lathes of
            JSON, and an uncapped <pre> would make the whole page its height. */}
        <pre className="mt-2 max-h-[38vh] overflow-auto rounded-[var(--radius-card)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] p-2 font-mono text-[10px] leading-relaxed text-[color:var(--ink-secondary)]">
          {recipe}
        </pre>
      </section>
    </>
  );
}

/* ── bottom: the status bar ───────────────────────────────────────────────── */

export function StatusBar({ status, queue, library, note = null }) {
  const t = useTranslations('home3d');
  const waiting = (queue?.stages?.queued || 0) + (queue?.stages?.inFlight || 0);
  const gate = queue?.stages?.gate || 0;
  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[color:var(--bay-rail)] px-6 py-2 font-mono text-[10px] text-[color:var(--ink-muted)]">
      {/* The machine-on light. Install state is DERIVED from disk, so a lean host
          can read WHY it has fewer doors instead of just having fewer of them. */}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--live)' }} aria-hidden />
        {t('status.packs', { packs: status?.packs?.length ? status.packs.join(' · ') : t('status.kernelOnly') })}
      </span>
      <Link href="/render-bay" className="hover:text-[color:var(--ink-secondary)]">
        {t('status.queue', { n: waiting })}
      </Link>
      {gate > 0 && (
        <Link href="/render-bay" style={{ color: 'var(--forge)' }} className="hover:underline">
          {t('status.gate', { n: gate })}
        </Link>
      )}
      <Link href="/library" className="hover:text-[color:var(--ink-secondary)]">
        {t('status.library', { n: library?.total ?? 0 })}
      </Link>
      {note && <span>{note}</span>}
      {status?.toolCalls != null && <span className="ml-auto">{t('status.toolCalls', { n: status.toolCalls })}</span>}
    </footer>
  );
}

/* ── the home ─────────────────────────────────────────────────────────────── */

function ViewportHomeBody({ authEnabled }) {
  const t = useTranslations('home3d');
  // `?ref=` opens the home on a specific artifact instead of the head — the same
  // three panes, pointed somewhere else. Any link into the workshop can use it.
  const wantedRef = useSearchParams().get('ref');
  const { data, error, isLoading } = useSWR(
    wantedRef ? `/api/home?ref=${encodeURIComponent(wantedRef)}` : '/api/home',
    fetcher,
    { revalidateOnFocus: false },
  );
  const { data: presence } = useSWR('/api/workshop/presence', fetcher);

  const head = data?.head || null;
  // The `<ref>_gi` bake variant, resolved server-side, is the only other ref the
  // mode resolver needs to know about here.
  const refSet = useMemo(() => new Set(head?.giVariantRef ? [head.giVariantRef] : []), [head]);
  const modeState = useDisplayModeState(head, refSet);

  if (isLoading) return <main className="min-h-screen" aria-hidden />;
  // An empty workshop is an invitation, not an empty viewport — so it falls
  // through to the launcher, which IS the "here is what is here" surface. Same
  // for a failed read: a broken home should still open its doors.
  if (error || data?.error || !head) return <HomeLauncher authEnabled={authEnabled} />;

  return (
    // NOT pinned to the viewport height. `h-screen` here measures the whole
    // window while this element starts BELOW the app's own nav + breadcrumb
    // chrome, so the status bar falls off the bottom by exactly the chrome's
    // height — and that height varies by route. The shell therefore grows and the
    // page scrolls like every other page; the viewport pane keeps its own tall
    // minimum so it is still the largest thing on screen, which is the point.
    <main className="flex min-h-screen flex-col">
      <div className="grid flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(0,3fr)_minmax(230px,1.2fr)]">
        {/* One rail replaces the entire old drawer: what this artifact is made
            of, what the Library holds, and every door — §3. */}
        <aside className="flex flex-col gap-6">
          <Outliner head={head} library={data.library} />
          <Bays presence={presence} />
        </aside>

        <div className="flex min-h-[70vh] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <DisplayModes
              resolved={modeState.resolved}
              active={modeState.active}
              onChange={modeState.setMode}
            />
            <Link
              href={`/sketches/${encodeURIComponent(head.ref)}`}
              className="ml-auto font-mono text-[11px] text-[color:var(--live)] hover:underline"
            >
              {t('openArtifact')}
            </Link>
          </div>
          <Viewport head={head} view={modeState.view} />
        </div>

        <aside className="flex flex-col gap-6">
          <Inspector head={head} outcome={data.outcome} />
        </aside>
      </div>
      <StatusBar status={data.status} queue={data.queue} library={data.library} />
    </main>
  );
}

export default function ViewportHome({ authEnabled }) {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
      <ViewportHomeBody authEnabled={authEnabled} />
    </Suspense>
  );
}
