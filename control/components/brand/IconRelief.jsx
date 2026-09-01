/**
 * A door icon as dot relief — the mark's reading, applied to the nav's icons.
 *
 * The `m` is a halftone (MojuloMark). Its icons were 1.25px hairlines that could
 * have belonged to any dark dashboard, which meant the brand stopped at the
 * logo. This draws the SAME lattice with the SAME radius ramp for a door, from
 * the lattice baked by scripts/build-brand-icons.mjs, so the two are samples of
 * one instrument.
 *
 * ── One geometry, two readings ──────────────────────────────────────────────
 * The precedent is MojuloMark's own: a halftone stops resolving once a cell is
 * about a pixel, so below `ICON_RELIEF_MIN` this hands back the authored line
 * icon unchanged — the same geometry at a size where its own screen cannot hold
 * the lattice, which is what a favicon has always been.
 *
 * A third reading was tried and cut: the path inked as round dots along itself
 * (`stroke-dasharray: 0 2`), which looked right at tile scale and would have let
 * dense chrome speak halftone too. At 18px it puts a ~0.9px dot every 1.5px, so
 * on a 1x display the drawer's icons aliased into a grey smear. A reading whose
 * only valid size range is the range the lattice already covers is not a second
 * reading; it is a worse first one.
 *
 * Callers do not choose the threshold — the component owns it, so no call site
 * has to carry the rule and none can get it wrong.
 *
 * Ink takes `currentColor`, so hue-on-hover and the light flip both cost
 * nothing, and the dots carry no field of their own — the surface owns the
 * field (see MojuloMark).
 *
 * Design: components/3d-factory-ui.plan.md §7c.
 */

import { MARK_GRADIENT } from '@/lib/brand/mark-dots';
import { ICON_CELLS, ICON_DOTS, ICON_GAMMA, ICON_QUANT } from '@/lib/brand/icon-dots';

/** Below this pixel width a lattice cell is about a pixel and the relief mushes. */
export const ICON_RELIEF_MIN = 40;

/** True when this icon has a baked lattice — i.e. it lives in workshop-nav.jsx. */
export function hasRelief(name) {
  return Boolean(name && ICON_DOTS[name]);
}

/** Dot radius in cell units, swelling with coverage over the gradient's floor. */
function dotRadius(col, coverage) {
  const t = col / (ICON_CELLS - 1);
  const { maxL, maxR, bgL, bgR } = MARK_GRADIENT;
  const max = maxL + t * (maxR - maxL);
  const floor = bgL + t * (bgR - bgL);
  return floor + Math.pow(coverage, ICON_GAMMA) * (max - floor);
}

export default function IconRelief({ name, Icon, size = 64, className = '', title }) {
  const dots = ICON_DOTS[name];

  // No lattice, or too small to hold one: the authored line icon, unchanged.
  if (!dots || size < ICON_RELIEF_MIN) return <Icon className={className} />;

  return (
    <svg
      viewBox={`0 0 ${ICON_CELLS} ${ICON_CELLS}`}
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      {dots.map(([c, r, hits]) => (
        <circle
          key={`${c},${r}`}
          cx={c + 0.5}
          cy={r + 0.5}
          r={dotRadius(c, hits / ICON_QUANT)}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
