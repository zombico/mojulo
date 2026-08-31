'use client';

/**
 * The Materials shelf — the procedural-material registry, which had no UI at all
 * before this. Every other shelf in the Library is a lens on the sketch store;
 * this one lists `MATERIAL_PRESETS`, so it renders its own body.
 *
 * One approximation, stated plainly: a real face interpolates its four corner
 * fills across the quad (vertex colours), while a swatch cell is flat-filled with
 * their average. So the FAMILY a preset belongs to is exact; the smoothness
 * within one cell is not.
 *
 * The swatches are NOT mock gradients. Each one is a real quad pushed through the
 * real `resolveFaceMaterials`, so what you see is exactly the lambert base +
 * top-lit ramp + brushed cloud + weathering a face would get in a world. Seeded
 * noise only, so a swatch is byte-identical between renders — same invariant the
 * material system itself holds.
 *
 * Read-only, like the rest of the dashboard: a preset is applied by asking the
 * agent for it, not by clicking here.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { MATERIAL_PRESETS, resolveFaceMaterials } from '@/lib/graph/materials/procedural-material';

const SWATCH = 148;          // px, square
const TINT = '#8f96a0';      // the registry's own default base tint

/**
 * One preset, drawn by tessellating a unit quad through the material resolver and
 * painting each sub-quad with the average of its four corner fills. The quad is
 * laid out in x/z with a z-extent, because the top-lit ramp and the weathering
 * both read z — a flat x/y quad would show the mottle but not the gradient.
 */
export function Swatch({ kind, max = SWATCH }) {
  const tiles = useMemo(() => {
    const face = {
      material: kind,
      fill: TINT,
      corners: [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0]],
    };
    return resolveFaceMaterials([face]).map((f) => ({
      // corners are [x, y, z]; the quad lives in x/z, so z is our screen y.
      points: f.corners.map((c) => `${c[0] * SWATCH},${(1 - c[2]) * SWATCH}`).join(' '),
      fill: averageHex(f.cornerFills, f.fill),
    }));
  }, [kind]);

  return (
    <svg
      viewBox={`0 0 ${SWATCH} ${SWATCH}`}
      // Capped at its natural size: blown up to full card width, a grid-4 preset
      // reads as sixteen slabs rather than as a material. Small is also truer to
      // how these are seen — per face, at modest screen size. Callers with less
      // room (the floor's materials rail) cap it lower.
      style={{ maxWidth: max }}
      className="w-full h-auto block mx-auto rounded-[var(--radius-control)]"
      aria-hidden="true"
    >
      {tiles.map((t, i) => (
        // shape-rendering keeps the tessellation seams from showing as hairlines
        <polygon key={i} points={t.points} fill={t.fill} shapeRendering="crispEdges" />
      ))}
    </svg>
  );
}

function averageHex(cornerFills, fallback) {
  if (!Array.isArray(cornerFills) || !cornerFills.length) return fallback || TINT;
  let r = 0, g = 0, b = 0;
  for (const hex of cornerFills) {
    r += parseInt(hex.slice(1, 3), 16);
    g += parseInt(hex.slice(3, 5), 16);
    b += parseInt(hex.slice(5, 7), 16);
  }
  const n = cornerFills.length;
  const to = (x) => Math.round(x / n).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** The preset's dials, in the registry's own vocabulary. */
function paramLine(spec) {
  return Object.entries(spec)
    .map(([k, v]) => `${k} ${v}`)
    .join('  ·  ');
}

export default function MaterialShelf() {
  const t = useTranslations('library.materials');
  const kinds = Object.keys(MATERIAL_PRESETS);

  return (
    <div className="p-4">
      <p className="mb-4 text-xs text-[color:var(--ink-muted)] max-w-2xl">{t('blurb')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {kinds.map((kind) => (
          <div
            key={kind}
            className="border border-[color:var(--bay-rail)] rounded-[var(--radius-card)] bg-[color:var(--bay-bench)] p-3"
          >
            <Swatch kind={kind} />
            <div className="mt-2.5 font-mono text-xs text-[color:var(--ink-primary)]">{kind}</div>
            <div className="mt-1 font-mono text-[10px] text-[color:var(--ink-muted)]">
              {paramLine(MATERIAL_PRESETS[kind])}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[11px] text-[color:var(--forge)]">{t('applyHint')}</p>
    </div>
  );
}
