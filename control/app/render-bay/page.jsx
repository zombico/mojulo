'use client';

/**
 * /render-bay — one place to watch mojulo produce something.
 *
 * Four expressions of that sentence existed and none of them had a home: the
 * durable image-render queue was entirely invisible in the UI, GI bakes lived
 * only in a CLI's stdout, cooks had an inbox, and exports hung off per-artifact
 * download buttons. Three lanes over what already exists, no new data model.
 *
 * Two rules this page holds to:
 *   · Nothing here mutates. Every action is a copy-prompt for the operator's
 *     agent — the dashboard golden rule, made visible rather than merely obeyed.
 *   · The machine gate and the eyes gate are never conflated (docs/bicycles.md).
 *     A submitted render is its own stage because that is precisely where the
 *     machine is finished and nobody has looked yet.
 *
 * Design: components/3d-factory-ui.plan.md §5.
 */

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import {
  PER_REQUEST_STAGES,
  QUEUE_STAGES,
  RENDER_LANES,
  bakeGates,
  bakePrompt,
  collapseByRef,
  formatBytes,
  groupQueueByStage,
  isStalled,
  queueGroupPrompt,
  queuePrompt,
  queueStatusMeta,
  tallyOutputKinds,
} from '@/lib/render-bay/lanes';

const SIGNAL_VAR = {
  live: 'var(--live)',
  forge: 'var(--forge)',
  fault: 'var(--fault)',
  idle: 'var(--ink-muted)',
};

function stamp(seconds) {
  if (!seconds) return '—';
  const ms = seconds < 1e12 ? seconds * 1000 : seconds;
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 16);
}

function isoStamp(value) {
  if (!value) return '—';
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) : '—';
}

/** Agent-directed prompt text, handed over rather than executed. */
function CopyPrompt({ value }) {
  const t = useTranslations('renderBay');
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
      className={`shrink-0 rounded-[var(--radius-control)] border px-2 py-0.5 font-mono text-[10px] transition-colors duration-100 ${
        state === 'failed'
          ? 'border-[color:var(--fault)] text-[color:var(--fault)]'
          : 'border-[color:var(--forge-idle)] text-[color:var(--forge)] hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10'
      }`}
    >
      {state === 'copied' ? t('copied') : state === 'failed' ? t('copyFailed') : t('copyPrompt')}
    </button>
  );
}

function Dot({ signal }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: SIGNAL_VAR[signal] || SIGNAL_VAR.idle }}
    />
  );
}

/**
 * One lane of the bay. Per the blocking rule (3d-factory-ui.plan.md §7c) a lane
 * is a REGION inside the page's single frame, not a box of its own: it carries
 * no radius, no side borders and no background, and it is divided from the next
 * lane by one hairline it contributes (`moj-part-b`, dropped on the last child).
 * That is what makes the three lanes read as one instrument rather than as three
 * cards that happen to be stacked.
 */
function Bay({ title, note, count, children }) {
  return (
    <section className="moj-part-b">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--ink-secondary)]">
          {title}
        </h2>
        {count != null && (
          <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">{count}</span>
        )}
        {note && <p className="w-full text-[12px] leading-relaxed text-[color:var(--ink-muted)]">{note}</p>}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="px-4 py-6 text-[13px] text-[color:var(--ink-muted)]">{children}</p>;
}

/** Placeholder rows while the one big /api/render-bay fetch is in flight, so the
 * three lanes don't sit blank under just a header for however long that takes. */
function SkeletonBay({ title, rows = 3 }) {
  return (
    <section className="moj-part-b">
      <header className="border-b border-[color:var(--bay-rail)] px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-[color:var(--ink-secondary)]">
          {title}
        </h2>
      </header>
      <div className="flex flex-col gap-2 p-4" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className="h-6 animate-pulse rounded-[3px] bg-[color:var(--bay-bench)] motion-reduce:animate-none"
            style={{ width: `${70 - i * 12}%` }}
          />
        ))}
      </div>
    </section>
  );
}

/* ── Lane 1: the render queue ─────────────────────────────────────────────── */

function QueueRow({ request, now }) {
  const t = useTranslations('renderBay');
  const meta = queueStatusMeta(request.status);
  const stalled = isStalled(request, now);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-2 last:border-b-0">
      <Dot signal={meta.signal} />
      <Link
        href={`/sketches/${encodeURIComponent(request.ref)}`}
        title={request.ref}
        className="max-w-[22ch] truncate font-mono text-[12px] text-[color:var(--ink-primary)] hover:text-[color:var(--live)]"
      >
        {request.ref}
      </Link>
      <span className="font-mono text-[11px] text-[color:var(--ink-secondary)]">{request.target}</span>
      <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{request.kind}</span>
      <span className="font-mono text-[11px]" style={{ color: SIGNAL_VAR[meta.signal] || SIGNAL_VAR.idle }}>
        {t.has(`queue.status.${request.status}`) ? t(`queue.status.${request.status}`) : request.status}
      </span>
      {stalled && (
        <span className="rounded-[3px] border border-[color:var(--fault)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--fault)]">
          {t('queue.stalled')}
        </span>
      )}
      {request.source && (
        <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{request.source}</span>
      )}
      <span className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
          {stamp(request.updatedAt)}
        </span>
        <CopyPrompt value={queuePrompt(request)} />
      </span>
    </li>
  );
}

/**
 * One artifact waiting, however many targets that is. A sequential-art page parks
 * a request per panel and a keyframe clip one per mouth shape, so the ref is the
 * unit the operator is actually deciding about — and `pull_image_render({ ref })`
 * drains exactly this group.
 */
function QueueGroupRow({ group, now }) {
  const t = useTranslations('renderBay');
  const meta = queueStatusMeta(group.status);
  const stalled = isStalled({ ...group, status: group.status }, now);
  const n = group.requests.length;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-2 last:border-b-0">
      <Dot signal={meta.signal} />
      <Link
        href={`/sketches/${encodeURIComponent(group.ref)}`}
        title={group.ref}
        className="max-w-[22ch] truncate font-mono text-[12px] text-[color:var(--ink-primary)] hover:text-[color:var(--live)]"
      >
        {group.ref}
      </Link>
      <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{group.kind}</span>
      <span className="font-mono text-[11px]" style={{ color: SIGNAL_VAR[meta.signal] || SIGNAL_VAR.idle }}>
        {n > 1 ? t('queue.targets', { n }) : group.targets[0]}
      </span>
      {stalled && (
        <span className="rounded-[3px] border border-[color:var(--fault)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--fault)]">
          {t('queue.stalled')}
        </span>
      )}
      {/* The target list is the detail behind the fold, so it only appears when
          there IS a fold — a single-target row already named its target above. */}
      {n > 1 && (
        <span
          className="min-w-0 flex-1 truncate font-mono text-[10px] text-[color:var(--ink-muted)]"
          title={group.targets.join(', ')}
        >
          {group.targets.slice(0, 4).join(' · ')}
          {n > 4 ? ` · +${n - 4}` : ''}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3">
        <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
          {stamp(group.updatedAt)}
        </span>
        <CopyPrompt value={queueGroupPrompt(group)} />
      </span>
    </li>
  );
}

function QueueLane({ queue, now }) {
  const t = useTranslations('renderBay');
  const byStage = useMemo(() => groupQueueByStage(queue?.rows || []), [queue]);
  const totals = queue?.totals;
  if (!queue) return null;
  return (
    <Bay
      title={t('queue.title')}
      note={t('queue.note')}
      count={totals ? t('queue.count', { n: totals.total }) : null}
    >
      {totals?.total === 0 ? (
        <Empty>{t('queue.empty')}</Empty>
      ) : (
        QUEUE_STAGES.map((stage) => {
          const rows = byStage[stage];
          const total = totals?.stages?.[stage] ?? rows.length;
          if (!total) return null;
          const perRequest = PER_REQUEST_STAGES.includes(stage);
          const groups = perRequest ? null : collapseByRef(rows);
          const shown = perRequest ? rows.length : groups.reduce((n, g) => n + g.requests.length, 0);
          return (
            <div key={stage}>
              <div className="flex flex-wrap items-baseline gap-2 bg-[color:var(--bay-void)]/60 px-4 py-1.5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
                  {t(`queue.stage.${stage}`)}
                </h3>
                <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">{total}</span>
                {!perRequest && groups.length < total && (
                  <span className="font-mono text-[10px] text-[color:var(--ink-muted)]">
                    {t('queue.folded', { refs: groups.length })}
                  </span>
                )}
                {stage === 'gate' && (
                  <span className="font-mono text-[10px] text-[color:var(--forge)]">{t('queue.eyesGate')}</span>
                )}
                {shown < total && (
                  <span className="ml-auto font-mono text-[10px] text-[color:var(--ink-muted)]">
                    {t('showing', { shown, total })}
                  </span>
                )}
              </div>
              <ul>
                {perRequest
                  ? rows.map((request) => <QueueRow key={request.id} request={request} now={now} />)
                  : groups.map((group) => <QueueGroupRow key={group.ref} group={group} now={now} />)}
              </ul>
            </div>
          );
        })
      )}
    </Bay>
  );
}

/* ── Lane 2: GI bakes ─────────────────────────────────────────────────────── */

function BakeRow({ bake }) {
  const t = useTranslations('renderBay');
  const gates = bakeGates(bake);
  return (
    <li className="border-b border-[color:var(--bay-rail)] px-4 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Dot signal="live" />
        <Link
          href={gates.eyes.href || '#'}
          title={bake.ref}
          className="max-w-[22ch] shrink-0 truncate font-mono text-[12px] text-[color:var(--ink-primary)] hover:text-[color:var(--live)]"
        >
          {bake.ref}
        </Link>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-secondary)]">{bake.title}</span>
        <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{bake.adapter}</span>
        <span className="font-mono text-[11px] text-[color:var(--think)]">{bake.preset}</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
            {isoStamp(bake.bakedAt)}
          </span>
          <CopyPrompt value={bakePrompt(bake)} />
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 font-mono text-[10px] text-[color:var(--ink-muted)]">
        <span style={{ color: SIGNAL_VAR.live }}>
          {t('bakes.machineGate', {
            match: gates.machine.matchRate == null ? '—' : `${Math.round(gates.machine.matchRate * 100)}%`,
            black: gates.machine.floorBlackFrac == null ? '—' : `${Math.round(gates.machine.floorBlackFrac * 100)}%`,
            limit: `${Math.round(gates.machine.limit * 100)}%`,
          })}
        </span>
        <span style={{ color: SIGNAL_VAR.forge }}>{t('bakes.eyesGate')}</span>
        {bake.samples != null && <span>{t('bakes.samples', { n: bake.samples })}</span>}
        {bake.from !== bake.ref && <span>{t('bakes.from', { ref: bake.from })}</span>}
      </div>
    </li>
  );
}

function BakesLane({ bakes }) {
  const t = useTranslations('renderBay');
  if (!bakes) return null;
  return (
    <Bay title={t('bakes.title')} note={t('bakes.note')} count={bakes.total}>
      {bakes.rows.length === 0 ? (
        <Empty>{t('bakes.empty')}</Empty>
      ) : (
        <ul>
          {bakes.rows.map((bake) => (
            <BakeRow key={bake.ref} bake={bake} />
          ))}
        </ul>
      )}
    </Bay>
  );
}

/* ── Lane 3: cooks and exports ────────────────────────────────────────────── */

function KindChips({ files }) {
  const t = useTranslations('renderBay');
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tallyOutputKinds(files).map(({ kind, count }) => (
        <span
          key={kind}
          className="rounded-[3px] border border-[color:var(--bay-rail-lit)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--ink-muted)]"
        >
          {t.has(`outputs.kind.${kind}`) ? t(`outputs.kind.${kind}`) : kind}
          {count > 1 && <span className="tabular-nums"> ×{count}</span>}
        </span>
      ))}
    </span>
  );
}

function ExportRow({ row, href }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-2 last:border-b-0">
      <Dot signal="live" />
      {href ? (
        <a
          href={href}
          title={row.ref}
          className="max-w-[22ch] truncate font-mono text-[12px] text-[color:var(--ink-primary)] hover:text-[color:var(--live)]"
        >
          {row.ref}
        </a>
      ) : (
        <span title={row.ref} className="max-w-[22ch] truncate font-mono text-[12px] text-[color:var(--ink-primary)]">
          {row.ref}
        </span>
      )}
      <KindChips files={row.files} />
      <span className="ml-auto flex items-center gap-3 font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
        <span>{formatBytes(row.bytes)}</span>
        <span>{stamp(row.mtime)}</span>
      </span>
    </li>
  );
}

function OutputsLane({ outputs }) {
  const t = useTranslations('renderBay');
  if (!outputs) return null;
  const { cooks, artifacts, beats } = outputs;
  const group = (key, total, shown) => (
    <div className="flex items-baseline gap-2 bg-[color:var(--bay-void)]/60 px-4 py-1.5">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
        {t(`outputs.group.${key}`)}
      </h3>
      <span className="font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">{total}</span>
      {shown < total && (
        <span className="ml-auto font-mono text-[10px] text-[color:var(--ink-muted)]">
          {t('showing', { shown, total })}
        </span>
      )}
    </div>
  );

  return (
    <Bay
      title={t('outputs.title')}
      note={t('outputs.note')}
      count={cooks.total + artifacts.total + beats.total}
    >
      {group('cooks', cooks.total, cooks.rows.length)}
      {cooks.rows.length === 0 ? (
        <Empty>{t('outputs.emptyCooks')}</Empty>
      ) : (
        <ul>
          {cooks.rows.map((cook) => (
            <li
              key={cook.ref}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--bay-rail)] px-4 py-2 last:border-b-0"
            >
              <Dot signal="live" />
              <a
                href={cook.url}
                title={cook.ref}
                className="max-w-[22ch] shrink-0 truncate font-mono text-[12px] text-[color:var(--ink-primary)] hover:text-[color:var(--live)]"
              >
                {cook.ref}
              </a>
              <span className="min-w-0 flex-1 truncate text-[12px] text-[color:var(--ink-secondary)]">{cook.aim}</span>
              <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
                {stamp(cook.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-[color:var(--bay-rail)] px-4 py-2">
        <Link href="/outputs" className="font-mono text-[11px] text-[color:var(--live)] hover:underline">
          {t('outputs.fullInbox')}
        </Link>
      </div>

      {group('artifacts', artifacts.total, artifacts.rows.length)}
      {artifacts.rows.length === 0 ? (
        <Empty>{t('outputs.emptyArtifacts')}</Empty>
      ) : (
        <ul>
          {artifacts.rows.map((row) => (
            <ExportRow key={row.ref} row={row} href={row.url} />
          ))}
        </ul>
      )}

      {group('beats', beats.total, beats.rows.length)}
      {beats.rows.length === 0 ? (
        <Empty>{t('outputs.emptyBeats')}</Empty>
      ) : (
        <ul>
          {beats.rows.map((row) => (
            <ExportRow key={row.ref} row={row} href={null} />
          ))}
        </ul>
      )}
    </Bay>
  );
}

/* ── The bay ──────────────────────────────────────────────────────────────── */

function RenderBayBody() {
  const t = useTranslations('renderBay');
  const params = useSearchParams();
  const laneParam = RENDER_LANES.includes(params.get('lane')) ? params.get('lane') : null;

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/render-bay${laneParam ? `?lane=${laneParam}` : ''}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [laneParam]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-[32px] font-semibold tracking-tight text-[color:var(--ink-primary)]">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[color:var(--ink-secondary)]">
          {t('subtitle')}
        </p>
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-[color:var(--ink-muted)]">{t('readOnly')}</p>
      </header>

      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-secondary)] transition-colors duration-100 hover:text-[color:var(--ink-primary)] disabled:opacity-50"
        >
          {loading ? t('loading') : t('refresh')}
        </button>
        {laneParam && (
          <Link href="/render-bay" className="font-mono text-[11px] text-[color:var(--live)] hover:underline">
            {t('allLanes')}
          </Link>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-[var(--radius-card)] border border-[color:var(--fault)] px-4 py-3 text-[13px] text-[color:var(--fault)]">
          {error}
        </p>
      )}

      {/* One frame; the lanes partition it. No gap — regions meet at the rule. */}
      <div className="moj-frame">
        {loading && !data ? (
          <>
            <SkeletonBay title={t('queue.title')} rows={4} />
            <SkeletonBay title={t('bakes.title')} rows={2} />
            <SkeletonBay title={t('outputs.title')} rows={3} />
          </>
        ) : (
          <>
            <QueueLane queue={data?.queue} now={data?.now || 0} />
            <BakesLane bakes={data?.bakes} />
            <OutputsLane outputs={data?.outputs} />
          </>
        )}
      </div>
    </main>
  );
}

export default function RenderBayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" aria-hidden />}>
      <RenderBayBody />
    </Suspense>
  );
}
