/**
 * rupa/liquid-look.js — HOW A LIQUID IS SEEN, read off what it is (rupa/matter.js). Wherever a liquid lies (a pool set
 * down in a room, a spill, a puddle) it is drawn from this one record, so oil is oil and water water in every place
 * that shows one. rupa is the internal name.
 *
 * What its physics decides:
 *   thick   how far its face stands over what it lies on (m). A liquid at rest on a level floor is a puddle as tall as
 *           its surface tension can hold against its weight, 2·√(σ/ρg) (water about 5 mm, a fuel 3 to 4); one with a
 *           yield stress (mud, lava) stands taller, by what that stress can hold. Drawn LOOK.read times that and never
 *           under LOOK.least, so its lip reads at a walker's distance: a layer stands proud of what it covers
 *   rough   how true a mirror its face is: a liquid that flows levels itself smooth (the thicker it is, the longer its
 *           ripples take to die, so a touch less true); one with a yield stress keeps its lumps
 * What is its own (LIQUID_OPTICS, beside the matter table, a row a liquid):
 *   tint    its colour under no light, as its body shows it
 *   clear   seen through: the share of its own colour it keeps looked at square on (absent: a body that hides its floor)
 *   film    a thin film's colours on its face, 0 to 1 (a fuel's sheen)
 *   glow    what it gives off itself (lava)
 *
 *   liquidLook(id) → { id, tint, rough, thick, clear?, film?, glow? }
 *   LIQUID_OPTICS, LOOK
 *
 * Pure. The form render reads it (era/stage.js samples → scene/channels/form.js `reflect.surfaces`).
 */
import { resolveMatter, isLiquid } from './matter.js';

const G = 9.81, r4 = (v) => Math.round(v * 1e4) / 1e4;
export const LOOK = Object.freeze({ read: 2.4, least: 0.006, most: 0.08, hold: 4 });

export const LIQUID_OPTICS = Object.freeze({
  water: Object.freeze({ tint: [0.045, 0.055, 0.06], clear: 0.42 }),
  seawater: Object.freeze({ tint: [0.03, 0.07, 0.075], clear: 0.5 }),
  oil: Object.freeze({ tint: [0.3, 0.22, 0.04], clear: 0.6 }),
  honey: Object.freeze({ tint: [0.42, 0.22, 0.03], clear: 0.75 }),
  gasoline: Object.freeze({ tint: [0.1, 0.085, 0.045], clear: 0.34, film: 0.8 }),
  crude: Object.freeze({ tint: [0.035, 0.032, 0.03], film: 0.15 }),
  mud: Object.freeze({ tint: [0.2, 0.15, 0.1] }),
  lava: Object.freeze({ tint: [0.08, 0.03, 0.02], glow: [1, 0.32, 0.05] }),
});

export function liquidLook(id) {
  const m = resolveMatter(id, 'liquid');
  if (!isLiquid(m)) throw new Error(`liquid look: ${m.id} is not a liquid`);
  const O = LIQUID_OPTICS[m.id];
  if (!O) throw new Error(`liquid look: ${m.id} has no row in LIQUID_OPTICS (rupa/liquid-look.js)`);
  // (the puddle its tension holds, and what a yield stress holds over that)
  const puddle = 2 * Math.sqrt((m.tension ?? 0.05) / (m.density * G)), stand = (LOOK.hold * (m.yield || 0)) / (m.density * G);
  const thick = Math.min(LOOK.most, Math.max(LOOK.least, (puddle + stand) * LOOK.read));
  const rough = m.yield > 0 ? 0.45 : Math.min(0.08, 0.03 + 0.006 * Math.max(0, Math.log10(m.viscosity / 1e-3)));
  return { id: m.id, tint: O.tint, rough: r4(rough), thick: r4(thick), ...(O.clear !== undefined ? { clear: O.clear } : {}), ...(O.film ? { film: O.film } : {}), ...(O.glow ? { glow: O.glow } : {}) };
}
