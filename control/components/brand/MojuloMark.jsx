/**
 * The 2.0 mark — the lowercase `m` as a dot-relief halftone.
 *
 * Two readings of ONE geometry, both baked by `scripts/build-brand-mark.mjs`:
 *
 *   · `relief` (default) — the 18x15 dot lattice. This is the mark: ink dots
 *     swell toward the letterform and a left→right size gradient gives the
 *     relief a light side. It is the same grammar as `.moj-field` and the dot
 *     readouts, which is the point — the mark is a sample of the display
 *     system, not a logo parked in the corner.
 *
 * THE MARK IS INK. IT NEVER DRAWS ITS OWN FIELD.
 *
 * The lattice originally rendered its latent cells too, so the mark carried a
 * miniature field wherever it went. On a plain surface that reads as a sticker —
 * a rectangular patch of dots with a hard edge — and on a `.moj-field` plate it
 * reads as two lattices at different pitches fighting, which is what the plate
 * on the home directory looked like. Both are the same mistake: `--field-dot`
 * means "space that can be minted into", which is a fact about a SURFACE. A
 * logo asserting it is claiming to be latent space, and the mark is the exact
 * opposite — it is the thing that already exists.
 *
 * So the rule is one line, and it holds everywhere the `m` appears: the surface
 * owns the field, the mark owns the ink. A caller who wants the mark to sit in
 * latent space puts `.moj-field` on the plate behind it (see the dashboard
 * plate in WorkshopHome.jsx) and gets ONE lattice, with the letterform reading
 * as ink condensed out of it.
 *   · `solid` — the same skeleton as plain round-capped strokes, for sizes where
 *     the lattice physically cannot resolve.
 *
 * The size floor is real and measured on a contact sheet: below ~28px a cell is
 * about 1px and the relief turns to mush, so `MARK_RELIEF_MIN` is enforced here
 * rather than left to each caller's judgement — pass a smaller `size` and you
 * get the solid reading automatically. That is why the favicon and dense chrome
 * stay legible without anyone having to remember a rule.
 *
 * Ink takes `currentColor`, so the §13 light flip costs nothing.
 *
 * Design: components/3d-factory-ui.plan.md §7c.
 */

import { MARK_COLS, MARK_ROWS, MARK_DOTS, MARK_GRADIENT, MARK_INK, MARK_STROKES } from '@/lib/brand/mark-dots';

/** Below this pixel width the lattice cannot resolve; the solid reading takes over. */
export const MARK_RELIEF_MIN = 28;

/** Dot radius in cell units, swelling with coverage over the gradient's floor. */
function dotRadius(col, coverage) {
  const t = col / (MARK_COLS - 1);
  const { maxL, maxR, bgL, bgR } = MARK_GRADIENT;
  const max = maxL + t * (maxR - maxL);
  const floor = bgL + t * (bgR - bgL);
  if (coverage <= MARK_INK) return floor;
  return floor + Math.pow(coverage, 0.65) * (max - floor);
}

export default function MojuloMark({
  size = 40,
  variant,
  className,
  title,
}) {
  // A caller asking for relief below the floor gets the solid reading rather
  // than an illegible smudge — the component owns the threshold so no call site
  // has to carry it.
  const mode = variant || (size >= MARK_RELIEF_MIN ? 'relief' : 'solid');
  const common = {
    viewBox: `0 0 ${MARK_COLS} ${MARK_ROWS}`,
    width: size,
    height: (size * MARK_ROWS) / MARK_COLS,
    className,
    role: title ? 'img' : undefined,
    'aria-hidden': title ? undefined : true,
    xmlns: 'http://www.w3.org/2000/svg',
  };

  if (mode === 'solid') {
    return (
      <svg {...common}>
        {title && <title>{title}</title>}
        {MARK_STROKES.map((s) => (
          <path
            key={s.d}
            d={s.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.w}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    );
  }

  // Ink cells only — see the rule above. `MARK_DOTS` already omits zero-coverage
  // cells, so this is a filter on the sub-ink tail rather than a grid walk.
  const cells = MARK_DOTS.filter(([, , v]) => v > MARK_INK).map(([c, r, v]) => (
    <circle key={`${c},${r}`} cx={c + 0.5} cy={r + 0.5} r={dotRadius(c, v)} fill="currentColor" />
  ));

  return (
    <svg {...common}>
      {title && <title>{title}</title>}
      {cells}
    </svg>
  );
}
