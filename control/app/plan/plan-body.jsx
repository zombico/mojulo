'use client';

/**
 * /plan's client body — the plan inbox and its detail reading.
 *
 * Blocked per 3d-factory-ui.plan.md §7c, frame and partitions ONLY: plans are
 * words, not artifacts — nothing mints here, so this surface carries no latent
 * field anywhere. The pinned shell is the one frame; the header band, the
 * inbox rail and the detail pane are its regions, meeting at shared hairlines.
 * Inbox entries and detail lists are rows divided by rules, not floating
 * cards.
 *
 * Status wears the §7 signal semantics — hue carries STATE: a draft is
 * speculative (`--think`, the documented "plan" hue), actionable and executing
 * both mean the agent is acting or must act (`--forge`, executing carries the
 * tint), executed exists (`--live`), failed is `--fault`, and an archived plan
 * has graduated to the contextmap — a durable record (`--seal`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import WorkshopShell from '@/components/WorkshopShell';

function formatTimestamp(value) {
  if (!value) return '—';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function timeAgo(value) {
  if (!value) return '';
  const ms = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
  if (!Number.isFinite(ms)) return '';
  const diffMs = Date.now() - ms;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const STATUS_STYLES = {
  draft: 'border-[color:var(--think-idle)] text-[color:var(--think)]',
  actionable: 'border-[color:var(--forge-idle)] text-[color:var(--forge)]',
  executing: 'border-[color:var(--forge)] text-[color:var(--forge)] bg-[color:var(--forge)]/10',
  executed: 'border-[color:var(--live-idle)] text-[color:var(--live)]',
  failed: 'border-[color:var(--fault)] text-[color:var(--fault)]',
};

const SEAL_CHIP = 'border-[color:var(--seal)]/50 text-[color:var(--seal)]';

const STATUS_KEY = {
  draft: 'statusDraft',
  actionable: 'statusActionable',
  executing: 'statusExecuting',
  executed: 'statusExecuted',
  failed: 'statusFailed',
};

const LENS_KEY = {
  spike: 'lensSpike',
  segment_expansion: 'lensSegmentExpansion',
  vertical_reinforcement: 'lensVerticalReinforcement',
  collider: 'lensCollider',
};

export default function PlanBody({ authEnabled = false }) {
  const t = useTranslations('plan');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedRef, setSelectedRef] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const statusLabel = useCallback((s) => (STATUS_KEY[s] ? t(STATUS_KEY[s]) : s), [t]);
  const lensLabel = useCallback((l) => (l && LENS_KEY[l] ? t(LENS_KEY[l]) : t('lensUndecided')), [t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plans');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (ref) => {
    if (!ref) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/plans/${encodeURIComponent(ref)}`);
      const data = await res.json();
      setDetail(data && !data.error ? data : null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedRef) {
      setDetail(null);
      return;
    }
    loadDetail(selectedRef);
  }, [selectedRef, loadDetail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.planRef?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q),
    );
  }, [plans, query]);

  // Archived plans (released + graduated to the contextmap) are semi-hidden:
  // kept out of the active inbox, revealed behind a toggle.
  const activeFiltered = useMemo(() => filtered.filter((p) => !p.archived), [filtered]);
  const archivedFiltered = useMemo(() => filtered.filter((p) => p.archived), [filtered]);

  return (
    <WorkshopShell posture="pinned" width={1400} authEnabled={authEnabled} crumb={t('title')}>
      <header className="moj-part-b flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[color:var(--ink-primary)]">
            {t('title')}
          </h1>
          <p className="mt-1 text-[13px] text-[color:var(--ink-secondary)]">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-[color:var(--ink-muted)]">
            {t('total', { count: plans.length })}
          </span>
          {/* The one amber affordance: forging a plan is the agent's act, and
              this button only hands over the prompt. */}
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="rounded-[var(--radius-control)] border border-[color:var(--forge-idle)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--forge)] transition-colors duration-100 hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10"
          >
            {t('newPlan')}
          </button>
        </div>
      </header>

      {error && (
        <p className="moj-part-b px-5 py-2.5 text-[13px] text-[color:var(--fault)]">{error}</p>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left: the searchable inbox — a rail of rows, one shared rule against
            the detail pane. */}
        <div className="flex w-[320px] shrink-0 flex-col border-r border-[color:var(--bay-rail)]">
          <div className="border-b border-[color:var(--bay-rail)] px-3 py-2.5">
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-2.5 py-1.5 text-[12px] text-[color:var(--ink-primary)] placeholder:text-[color:var(--ink-muted)] focus:border-[color:var(--live)] focus:outline-none"
            />
            <p className="mt-1.5 font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">
              {query
                ? t('filteredCount', { count: filtered.length, total: plans.length })
                : t('count', { count: filtered.length })}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && plans.length === 0 ? (
              <p className="px-3 py-8 text-center text-[12px] text-[color:var(--ink-muted)]">{t('loading')}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-[12px] text-[color:var(--ink-muted)]">
                {plans.length === 0 ? t('emptyState') : t('noMatch')}
              </p>
            ) : (
              <>
                {activeFiltered.length === 0 && archivedFiltered.length > 0 && (
                  <p className="px-3 py-6 text-center text-[12px] text-[color:var(--ink-muted)]">{t('allArchived')}</p>
                )}
                {activeFiltered.map((p) => (
                  <PlanRow
                    key={p.planRef}
                    p={p}
                    isSelected={p.planRef === selectedRef}
                    onSelect={setSelectedRef}
                    t={t}
                    statusLabel={statusLabel}
                    lensLabel={lensLabel}
                  />
                ))}

                {archivedFiltered.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowArchived((v) => !v)}
                      className="w-full border-b border-[color:var(--bay-rail)] px-3 py-2 text-left font-mono text-[11px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]"
                    >
                      {showArchived
                        ? t('hideArchived', { count: archivedFiltered.length })
                        : t('showArchived', { count: archivedFiltered.length })}
                    </button>
                    {showArchived && (
                      <div className="opacity-60">
                        {archivedFiltered.map((p) => (
                          <PlanRow
                            key={p.planRef}
                            p={p}
                            isSelected={p.planRef === selectedRef}
                            onSelect={setSelectedRef}
                            t={t}
                            statusLabel={statusLabel}
                            lensLabel={lensLabel}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: detail pane */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!selectedRef ? (
            <div className="flex h-full items-center justify-center text-[color:var(--ink-muted)]">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex h-full items-center justify-center text-[color:var(--ink-muted)]">
              <p className="text-sm">{t('loading')}</p>
            </div>
          ) : detail ? (
            <PlanDetail
              plan={detail}
              t={t}
              statusLabel={statusLabel}
              lensLabel={lensLabel}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[color:var(--ink-muted)]">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          )}
        </div>
      </div>

      {showNew && <NewPlanModal t={t} onClose={() => setShowNew(false)} />}
    </WorkshopShell>
  );
}

function PlanRow({ p, isSelected, onSelect, t, statusLabel, lensLabel }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(p.planRef)}
      className={`block w-full border-b border-[color:var(--bay-rail)] px-3 py-2.5 text-left transition-colors duration-100 ${
        isSelected ? 'bg-[color:var(--bay-bench)]' : 'hover:bg-[color:var(--bay-bench)]/50'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span
          className={`flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium ${
            isSelected ? 'text-[color:var(--live)]' : 'text-[color:var(--ink-primary)]'
          }`}
        >
          {!p.seen && (
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--live)]"
              aria-label={t('unread')}
            />
          )}
          <span className="truncate">{p.title}</span>
        </span>
        <span className="shrink-0 font-mono text-[10px] text-[color:var(--ink-muted)]">{timeAgo(p.createdAt)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
            STATUS_STYLES[p.status] || STATUS_STYLES.draft
          }`}
        >
          {statusLabel(p.status)}
        </span>
        {p.archived && (
          <span className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEAL_CHIP}`}>
            {t('archivedBadge')}
          </span>
        )}
        <span className="truncate text-[11px] text-[color:var(--ink-muted)]">{lensLabel(p.lens)}</span>
        {p.steps > 0 && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[color:var(--ink-muted)]">
            {t('stepsCount', { count: p.steps })}
          </span>
        )}
      </div>
    </button>
  );
}

function PlanDetail({ plan, t, statusLabel, lensLabel }) {
  const frame = plan.frame || null;
  const manifest = Array.isArray(plan.manifest) ? plan.manifest : [];
  const revisions = Array.isArray(plan.revisionLog) ? plan.revisionLog : [];
  const execLog = Array.isArray(plan.executionLog) ? plan.executionLog : null;
  const discarded =
    frame && Array.isArray(frame.discarded_lenses) ? frame.discarded_lenses : [];
  const release = plan.release && Array.isArray(plan.release.artifacts) ? plan.release : null;

  return (
    <div>
      {/* The masthead rides the scroll — sticky over its own surface, closed
          by the same shared hairline as every other region. */}
      <div className="sticky top-0 z-10 border-b border-[color:var(--bay-rail)] bg-[color:var(--bay-floor)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[18px] font-semibold text-[color:var(--ink-primary)]">{plan.title}</h2>
            <p className="mt-1 font-mono text-[11px] text-[color:var(--ink-muted)]">{plan.planRef}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-[3px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                STATUS_STYLES[plan.status] || STATUS_STYLES.draft
              }`}
            >
              {statusLabel(plan.status)}
            </span>
            {plan.archived && (
              <span className={`rounded-[3px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEAL_CHIP}`}>
                {t('archivedBadge')}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[color:var(--ink-muted)]">
          <span>{lensLabel(plan.lens)}</span>
          <span className="font-mono">{t('createdAt', { timestamp: formatTimestamp(plan.createdAt) })}</span>
          <span className="font-mono">{t('updatedAt', { timestamp: formatTimestamp(plan.updatedAt) })}</span>
          {plan.sketchRef && (
            <a
              href={`/sketches/${encodeURIComponent(plan.sketchRef)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[color:var(--live)] hover:underline"
            >
              {t('viewSketch')} ↗
              {plan.sketchPinned && (
                <span className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--ink-muted)]">
                  ({t('sketchPinned')})
                </span>
              )}
            </a>
          )}
        </div>
      </div>

      {/* Release — the closed loop: what this plan materialized into the contextmap */}
      {release && (
        <Section title={t('releaseHeading')}>
          {plan.archivedAt && (
            <p className="mb-2 text-[11px] text-[color:var(--ink-muted)]">
              {t('archivedAt', { timestamp: formatTimestamp(plan.archivedAt) })}
            </p>
          )}
          <ul className="divide-y divide-[color:var(--bay-rail)]">
            {release.artifacts.map((a, i) => {
              const label = a.artifactLabel || a.artifactRef;
              const isApp = a.commitType === 'app_materialization';
              return (
                <li key={i} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-[color:var(--ink-primary)]">
                      {isApp ? (
                        <a
                          href={`/apps/${encodeURIComponent(a.artifactRef)}`}
                          className="text-[color:var(--live)] hover:underline"
                        >
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </div>
                    <p className="mt-0.5 break-all font-mono text-[11px] text-[color:var(--ink-muted)]">
                      {a.artifactRef}
                    </p>
                  </div>
                  {a.commitType && (
                    <span className={`shrink-0 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${SEAL_CHIP}`}>
                      {a.commitType.replace(/_/g, ' ')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {/* Goal */}
      <Section title={t('goalHeading')}>
        <p className="whitespace-pre-wrap text-sm text-[color:var(--ink-secondary)]">{plan.goal}</p>
      </Section>

      {/* Frame */}
      {frame && (
        <Section title={t('frameHeading')}>
          {frame.summary && (
            <p className="mb-3 whitespace-pre-wrap text-sm text-[color:var(--ink-secondary)]">{frame.summary}</p>
          )}
          {discarded.length > 0 && (
            <div className="text-[11px] text-[color:var(--ink-secondary)]">
              <span className="text-[color:var(--ink-muted)]">{t('discardedLenses')}: </span>
              {discarded.map((d) => lensLabel(d)).join(', ')}
            </div>
          )}
        </Section>
      )}

      {/* Manifest */}
      <Section title={t('manifestHeading')}>
        {manifest.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('manifestEmpty')}</p>
        ) : (
          <ol className="divide-y divide-[color:var(--bay-rail)]">
            {manifest.map((call, i) => (
              <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[color:var(--ink-muted)]">{i + 1}.</span>
                  <span className="font-mono text-sm text-[color:var(--live)]">{call.tool}</span>
                </div>
                {call.note && <p className="ml-6 mt-1 text-[11px] text-[color:var(--ink-secondary)]">{call.note}</p>}
                {call.args && Object.keys(call.args).length > 0 && (
                  <pre className="ml-6 mt-2 overflow-x-auto font-mono text-[11px] text-[color:var(--ink-muted)]">
                    {JSON.stringify(call.args, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Execution log */}
      <Section title={t('executionLogHeading')}>
        {!execLog || execLog.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('executionEmpty')}</p>
        ) : (
          <ol className="divide-y divide-[color:var(--bay-rail)]">
            {execLog.map((step, i) => (
              <li key={i} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-[color:var(--ink-primary)]">{step.tool}</span>
                  <span
                    className={`rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] uppercase ${
                      step.ok
                        ? 'border-[color:var(--live-idle)] text-[color:var(--live)]'
                        : 'border-[color:var(--fault)] text-[color:var(--fault)]'
                    }`}
                  >
                    {step.ok ? t('stepOk') : t('stepFailed')}
                  </span>
                </div>
                {step.error && <p className="mt-1 text-[11px] text-[color:var(--fault)]">{step.error}</p>}
                {step.result_snippet && (
                  <pre className="mt-2 overflow-x-auto font-mono text-[11px] text-[color:var(--ink-muted)]">
                    {step.result_snippet}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Revisions */}
      <Section title={t('revisionLogHeading')}>
        {revisions.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('revisionEmpty')}</p>
        ) : (
          <ul className="divide-y divide-[color:var(--bay-rail)]">
            {revisions.map((r, i) => (
              <li key={i} className="flex gap-3 py-2 text-sm text-[color:var(--ink-secondary)] first:pt-0 last:pb-0">
                <span className="shrink-0 font-mono text-[11px] text-[color:var(--ink-muted)]">
                  {timeAgo(r.revised_at)}
                </span>
                <span className="whitespace-pre-wrap">{r.note}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** One region of the detail pane: eyebrow head, padded body, shared rule below. */
function Section({ title, children }) {
  return (
    <section className="moj-part-b px-5 py-4">
      <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
        {title}
      </h3>
      {children}
    </section>
  );
}

function NewPlanModal({ t, onClose }) {
  const [intent, setIntent] = useState('');
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const trimmed = intent.trim();
    const intentLine = trimmed ? `Intent: ${trimmed}` : 'Intent: (describe what you want to plan)';
    return `Call \`enter_plan_mode\` to load the plan-mode discipline, then help me forge a plan. Hold the four lenses loosely, draft a shadow manifest as we go, and present a frame for my approval before compiling. ${intentLine}`;
  }, [intent]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the textarea is selectable as a fallback */
    }
  }, [prompt]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--bay-void)]/85 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('newPlanTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-[var(--radius-bay)] border border-[color:var(--bay-rail-lit)] bg-[color:var(--bay-bench)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-[color:var(--ink-primary)]">{t('newPlanTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[12px] text-[color:var(--ink-muted)] hover:text-[color:var(--ink-primary)]"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-[color:var(--ink-secondary)]">{t('newPlanIntro')}</p>

        <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
          {t('intentLabel')}
        </label>
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder={t('intentPlaceholder')}
          className="mb-4 w-full rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-3 py-2 text-sm text-[color:var(--ink-primary)] placeholder:text-[color:var(--ink-muted)] focus:border-[color:var(--live)] focus:outline-none"
        />

        <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">
          {t('promptLabel')}
        </label>
        <textarea
          readOnly
          value={prompt}
          rows={5}
          className="mb-4 w-full resize-none rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-void)] px-3 py-2 font-mono text-xs text-[color:var(--ink-secondary)] focus:outline-none"
          onFocus={(e) => e.target.select()}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-control)] border border-[color:var(--bay-rail-lit)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--ink-secondary)] transition-colors duration-100 hover:text-[color:var(--ink-primary)]"
          >
            {t('close')}
          </button>
          <button
            type="button"
            onClick={copy}
            className="rounded-[var(--radius-control)] border border-[color:var(--forge-idle)] px-2.5 py-1 font-mono text-[11px] text-[color:var(--forge)] transition-colors duration-100 hover:border-[color:var(--forge)] hover:bg-[color:var(--forge)]/10"
          >
            {copied ? t('copied') : t('copyPrompt')}
          </button>
        </div>
      </div>
    </div>
  );
}
