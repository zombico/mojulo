'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

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
  draft: 'border-gray-600 text-gray-300 bg-gray-700/40',
  actionable: 'border-teal-500 text-teal-300 bg-teal-900/30',
  executing: 'border-amber-500 text-amber-300 bg-amber-900/30',
  executed: 'border-emerald-500 text-emerald-300 bg-emerald-900/30',
  failed: 'border-red-500 text-red-300 bg-red-900/30',
};

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

export default function PlanPage() {
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
    <div className="h-[calc(100vh-66px)] flex flex-col bg-gray-900">
      <div className="flex justify-between items-center px-8 pt-6 pb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t('title')}</h1>
          <p className="text-xs text-gray-400 mt-1">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{t('total', { count: plans.length })}</span>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 text-sm border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600"
          >
            {t('newPlan')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-8 mt-4 bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 grid gap-6 px-8 py-4 overflow-hidden grid-cols-4">
        {/* Left: searchable inbox */}
        <div className="col-span-1 border-r border-gray-700 pr-4 flex flex-col overflow-hidden">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 mb-3 border border-gray-600 rounded-md text-sm bg-gray-800 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-teal-500"
          />
          <p className="text-xs text-gray-400 mb-3">
            {query
              ? t('filteredCount', { count: filtered.length, total: plans.length })
              : t('count', { count: filtered.length })}
          </p>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {loading && plans.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">{t('loading')}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {plans.length === 0 ? t('emptyState') : t('noMatch')}
              </div>
            ) : (
              <>
                {activeFiltered.length === 0 && archivedFiltered.length > 0 && (
                  <div className="text-center py-6 text-gray-500 text-sm">{t('allArchived')}</div>
                )}
                {activeFiltered.map((p) => (
                  <PlanCard
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
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowArchived((v) => !v)}
                      className="w-full text-left text-xs text-gray-500 hover:text-gray-300 px-1 py-2 border-t border-gray-800"
                    >
                      {showArchived
                        ? t('hideArchived', { count: archivedFiltered.length })
                        : t('showArchived', { count: archivedFiltered.length })}
                    </button>
                    {showArchived && (
                      <div className="space-y-2 mt-1 opacity-60">
                        {archivedFiltered.map((p) => (
                          <PlanCard
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
        <div className="col-span-3 overflow-y-auto">
          {!selectedRef ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          ) : detailLoading && !detail ? (
            <div className="flex items-center justify-center h-full text-gray-500">
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
            <div className="flex items-center justify-center h-full text-gray-500">
              <p className="text-sm">{t('selectPrompt')}</p>
            </div>
          )}
        </div>

      </div>

      {showNew && <NewPlanModal t={t} onClose={() => setShowNew(false)} />}
    </div>
  );
}

function PlanCard({ p, isSelected, onSelect, t, statusLabel, lensLabel }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(p.planRef)}
      className={`w-full text-left border rounded-lg p-3 cursor-pointer transition ${
        isSelected
          ? 'border-teal-500 bg-teal-900/30'
          : 'border-gray-700 hover:border-gray-600 bg-gray-800 hover:bg-gray-700'
      }`}
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-sm font-semibold text-gray-200 truncate flex items-center gap-1.5">
          {!p.seen && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0"
              aria-label={t('unread')}
            />
          )}
          {p.title}
        </span>
        <span className="text-xs text-gray-500 shrink-0">{timeAgo(p.createdAt)}</span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
            STATUS_STYLES[p.status] || STATUS_STYLES.draft
          }`}
        >
          {statusLabel(p.status)}
        </span>
        {p.archived && (
          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 bg-gray-700/40">
            {t('archivedBadge')}
          </span>
        )}
        <span className="text-[11px] text-gray-500">{lensLabel(p.lens)}</span>
        {p.steps > 0 && (
          <span className="text-[11px] text-gray-600">{t('stepsCount', { count: p.steps })}</span>
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
    <div className="space-y-4">
      <div className="border border-gray-700 rounded-lg p-6 bg-gray-800 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-100 truncate">{plan.title}</h2>
            <p className="font-mono text-xs text-gray-500 mt-1">{plan.planRef}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs uppercase tracking-wide px-2 py-1 rounded border ${
                STATUS_STYLES[plan.status] || STATUS_STYLES.draft
              }`}
            >
              {statusLabel(plan.status)}
            </span>
            {plan.archived && (
              <span className="text-xs uppercase tracking-wide px-2 py-1 rounded border border-gray-600 text-gray-400 bg-gray-700/40">
                {t('archivedBadge')}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
          <span>{lensLabel(plan.lens)}</span>
          <span>{t('createdAt', { timestamp: formatTimestamp(plan.createdAt) })}</span>
          <span>{t('updatedAt', { timestamp: formatTimestamp(plan.updatedAt) })}</span>
          {plan.sketchRef && (
            <a
              href={`/sketches/${encodeURIComponent(plan.sketchRef)}`}
              target="_blank"
              rel="noreferrer"
              className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1"
            >
              {t('viewSketch')} ↗
              {plan.sketchPinned && (
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
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
            <p className="text-xs text-gray-400 mb-2">
              {t('archivedAt', { timestamp: formatTimestamp(plan.archivedAt) })}
            </p>
          )}
          <ul className="space-y-2">
            {release.artifacts.map((a, i) => {
              const label = a.artifactLabel || a.artifactRef;
              const isApp = a.commitType === 'app_materialization';
              return (
                <li
                  key={i}
                  className="border border-gray-700 rounded-md p-3 bg-gray-900/60 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-gray-200 truncate">
                      {isApp ? (
                        <a
                          href={`/apps/${encodeURIComponent(a.artifactRef)}`}
                          className="text-teal-300 hover:underline"
                        >
                          {label}
                        </a>
                      ) : (
                        label
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-gray-500 mt-0.5 break-all">
                      {a.artifactRef}
                    </p>
                  </div>
                  {a.commitType && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-gray-600 text-gray-400 shrink-0">
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
        <p className="text-sm text-gray-300 whitespace-pre-wrap">{plan.goal}</p>
      </Section>

      {/* Frame */}
      {frame && (
        <Section title={t('frameHeading')}>
          {frame.summary && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap mb-3">{frame.summary}</p>
          )}
          {discarded.length > 0 && (
            <div className="text-xs text-gray-400">
              <span className="text-gray-500">{t('discardedLenses')}: </span>
              {discarded.map((d) => lensLabel(d)).join(', ')}
            </div>
          )}
        </Section>
      )}

      {/* Manifest */}
      <Section title={t('manifestHeading')}>
        {manifest.length === 0 ? (
          <p className="text-sm text-gray-500">{t('manifestEmpty')}</p>
        ) : (
          <ol className="space-y-2">
            {manifest.map((call, i) => (
              <li
                key={i}
                className="border border-gray-700 rounded-md p-3 bg-gray-900/60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">{i + 1}.</span>
                  <span className="text-sm font-mono text-teal-300">{call.tool}</span>
                </div>
                {call.note && <p className="text-xs text-gray-400 mt-1 ml-6">{call.note}</p>}
                {call.args && Object.keys(call.args).length > 0 && (
                  <pre className="text-[11px] text-gray-500 mt-2 ml-6 overflow-x-auto">
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
          <p className="text-sm text-gray-500">{t('executionEmpty')}</p>
        ) : (
          <ol className="space-y-2">
            {execLog.map((step, i) => (
              <li key={i} className="border border-gray-700 rounded-md p-3 bg-gray-900/60">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-300">{step.tool}</span>
                  <span
                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                      step.ok
                        ? 'border-emerald-600 text-emerald-300'
                        : 'border-red-600 text-red-300'
                    }`}
                  >
                    {step.ok ? t('stepOk') : t('stepFailed')}
                  </span>
                </div>
                {step.error && <p className="text-xs text-red-400 mt-1">{step.error}</p>}
                {step.result_snippet && (
                  <pre className="text-[11px] text-gray-500 mt-2 overflow-x-auto">
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
          <p className="text-sm text-gray-500">{t('revisionEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {revisions.map((r, i) => (
              <li key={i} className="text-sm text-gray-300 flex gap-3">
                <span className="text-xs text-gray-600 shrink-0 font-mono">
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

function Section({ title, children }) {
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
      <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">{title}</h3>
      {children}
    </div>
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
      className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('newPlanTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-gray-800 border border-gray-700 rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold text-gray-100">{t('newPlanTitle')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-sm"
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-4">{t('newPlanIntro')}</p>

        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
          {t('intentLabel')}
        </label>
        <input
          type="text"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder={t('intentPlaceholder')}
          className="w-full px-3 py-2 mb-4 border border-gray-600 rounded-md text-sm bg-gray-900 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-teal-500"
        />

        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
          {t('promptLabel')}
        </label>
        <textarea
          readOnly
          value={prompt}
          rows={5}
          className="w-full px-3 py-2 mb-4 border border-gray-700 rounded-md text-xs font-mono bg-gray-900 text-gray-300 resize-none focus:outline-none"
          onFocus={(e) => e.target.select()}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-600 rounded-md bg-gray-700 text-gray-200 hover:bg-gray-600"
          >
            {t('close')}
          </button>
          <button
            type="button"
            onClick={copy}
            className="px-3 py-1.5 text-sm border border-teal-500 rounded-md bg-teal-700 text-white hover:bg-teal-600"
          >
            {copied ? t('copied') : t('copyPrompt')}
          </button>
        </div>
      </div>
    </div>
  );
}
