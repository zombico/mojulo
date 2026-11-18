/**
 * THE ROUND'S LOOK (the shot's look, docs/side-map-principles.md "What shines in a fight"): a buster's round drawn as
 * the anime register draws a charged shot, as data the page draws (scene/channels/controllable/index.js, the buster's
 * branch). Nothing per level is authored but its colour; the rest follows from it and the register's numbers:
 *
 *   core      white-hot: the hue is never painted at the centre (a white core over the ramp, CORE of the round's size)
 *   ramp      the hue by intensity: [white, the hue saturated, the hue deep] from the core out, each layer additive
 *   halo      a soft disc in the hue round it all (HALO × its size), dim: the effect bleeds into the world
 *   stretch   the head drawn long along its flight (1 + FX_STYLE.stretch, more a level), its intensity at the head
 *   streaks   thin bright lines inside the body along its flight, one more a level
 *   tail      a fading streak behind (TAIL × its size, longer a level)
 *   accent    a hue far round the wheel (the cel look's `hue`, scene/juice-style.js JUICE_LOOKS.cel), kept thin: the
 *             rings and some of the sparks
 *   rings     at the head, round the flight, one a charge level (the tap none), their near arc bright, their far faded
 *   sparks    a few trailing on the world's clock (more a level), the accent's and white
 *
 *   ROUND_LOOK, roundLook(round, level) → { color, size, core, ramp: [hex, hex, hex], halo, stretch, streaks, tail,
 *                                            accent, rings, sparks }
 *   roundLooks(buster) → [tap's, level 1's, …]   (a lowered `rule.buster`, gameworld/feel/lower.js)
 *
 * Pure: the same round, the same look.
 */
import { FX_STYLE } from '../../scene/effect-style.js';
import { JUICE_LOOKS } from '../../scene/juice-style.js';

export const ROUND_LOOK = Object.freeze({ core: 0.55, halo: 4.5, tail: 3, rings: [0, 1, 2], sparks: [2, 5, 8], streaks: [1, 2, 3], accent: JUICE_LOOKS.cel.hue, chroma: 0.92, deep: 0.45 });

const hsv = (n) => {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, M = Math.max(r, g, b), d = M - Math.min(r, g, b);
  const h = !d ? 0 : M === r ? 60 * (((g - b) / d) % 6) : M === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(h + 360) % 360, M ? d / M : 0, M];
};
const hex = (h, s, v) => {
  const f = (k) => { const x = (k + h / 60) % 6; return v - v * s * Math.max(0, Math.min(x, 4 - x, 1)); };
  return `#${[f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
};

/** A round's look: its colour leads, the register's numbers do the rest. */
export function roundLook(round, level = 0) {
  const R = ROUND_LOOK, k = Math.max(0, Math.min(level, R.rings.length - 1)), color = Number.isInteger(round?.color) ? round.color : 0xfff2a8;
  const [h, s] = hsv(color), sat = Math.max(s, R.chroma);
  return {
    color: hex(h, s, hsv(color)[2]), size: round?.size ?? 0.08,
    core: R.core,
    ramp: ['#ffffff', hex(h, sat, 1), hex(h, 1, R.deep)],
    halo: R.halo + k,
    stretch: Math.round((1 + FX_STYLE.stretch * (1 + 0.5 * k)) * 1000) / 1000,
    streaks: R.streaks[k],
    tail: R.tail + 2 * k,
    accent: hex((h + R.accent) % 360, 0.85, 1),
    rings: R.rings[k],
    sparks: R.sparks[k],
  };
}

/** Every level's look of a lowered buster: the tap's first. */
export function roundLooks(buster) {
  if (!buster) return [];
  return [roundLook(buster.tap, 0), ...(buster.levels ?? []).map((L, i) => roundLook(L, i + 1))];
}
