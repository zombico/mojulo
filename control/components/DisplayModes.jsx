'use client';

/**
 * The display-mode segmented control — Wire / Shaded / Baked / Painted.
 *
 * One control, on every artifact that has more than one way of being looked at.
 * Availability comes entirely from lib/graph/sketch/display-modes.js, so this
 * component holds no opinion about what an artifact can do; it only draws the
 * answer. Shared by the sketch detail page and the gallery preview header so the
 * two can never disagree.
 *
 * Two deliberate behaviours:
 *   · A mode the artifact lacks is DISABLED with its reason in the tooltip, never
 *     hidden — "no GI bake yet, ask the agent to bake it" beats a missing button.
 *   · An `external` mode (painted) always carries its provenance badge. Mojulo
 *     owns the geometry, the image model owns the paint, and the UI must not let
 *     a painted render pass as a mojulo render (docs/bicycles.md).
 *
 * Design: components/3d-factory-ui.plan.md §4.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { pickMode, resolveDisplayModes } from '@/lib/graph/sketch/display-modes';
import { factsOf, kindOf, renderModeOf } from '@/lib/graph/sketch/sketch-summary';

/**
 * Mode state for a previewed sketch. Lives here rather than in the gallery so the
 * two preview surfaces (split pane, full-view modal) share one implementation and
 * one reset rule: selecting a different artifact returns to THAT artifact's own
 * default rather than carrying the previous one's mode across.
 *
 * `refSet` is the set of every ref in view, used to spot a `<ref>_gi` bake variant
 * without a round-trip; the caller memoizes it once for the whole list.
 */
export function useDisplayModeState(sketch, refSet) {
  const ref = sketch?.ref;
  // A gallery summary carries these three facts in place of the manifest; a full
  // sketch (the detail page) derives them from it. Either way the resolver never
  // needs the recipe itself (sketch-summary.js).
  const renderMode = renderModeOf(sketch);
  const kind = kindOf(sketch);
  const giAdapter = factsOf(sketch).giAdapter;
  const giVariantRef = ref && refSet?.has(`${ref}_gi`) ? `${ref}_gi` : null;

  const resolved = useMemo(
    () => resolveDisplayModes({
      renderMode,
      kind,
      giAdapter,
      ref,
      giVariantRef,
      hasBoundRender: Boolean(sketch?.hasBoundRender),
    }),
    [renderMode, kind, giAdapter, ref, giVariantRef, sketch?.hasBoundRender],
  );

  const [wanted, setWanted] = useState(null);
  useEffect(() => { setWanted(null); }, [ref]);

  const active = pickMode(resolved, wanted ?? resolved?.defaultMode);
  return { resolved, active: active?.key, setMode: setWanted, view: active?.view || null };
}

export default function DisplayModes({ resolved, active, onChange, className = '' }) {
  const t = useTranslations('displayModes');
  if (!resolved) return null;

  const activeMode = resolved.modes.find((m) => m.key === active);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="group"
        aria-label={t('label')}
        className="inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-[color:var(--bay-rail)] bg-[color:var(--bay-bench)] p-0.5"
      >
        {resolved.modes.map((m) => {
          const isActive = m.key === active;
          return (
            <button
              key={m.key}
              type="button"
              disabled={!m.available}
              aria-pressed={isActive}
              title={m.available ? t(`hint.${m.key}`) : t(`reason.${m.reason}`)}
              onClick={() => m.available && onChange(m.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-[3px] transition-colors duration-100 ${
                isActive
                  ? 'bg-[color:var(--bay-rail-lit)] text-[color:var(--ink-primary)]'
                  : m.available
                  ? 'text-[color:var(--ink-muted)] hover:text-[color:var(--ink-secondary)]'
                  : 'text-[color:var(--ink-muted)]/40 cursor-not-allowed'
              }`}
            >
              {t(`mode.${m.key}`)}
            </button>
          );
        })}
      </div>

      {activeMode?.external && (
        <span className="rounded-[3px] border border-[color:var(--forge)] px-1.5 py-0.5 text-[10px] text-[color:var(--forge)]">
          {t('externalBadge')}
        </span>
      )}
    </div>
  );
}
