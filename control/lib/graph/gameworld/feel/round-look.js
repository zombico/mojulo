/**
 * THE ROUND'S LOOK (the shot's look, docs/side-map-principles.md "What shines in a fight"): a buster's round drawn as
 * the anime register draws a charged shot, as data the page draws (scene/channels/controllable/index.js, the buster's
 * branch). Nothing per level is authored but its colour; the rest follows from it and the register's numbers:
 *
 *   core      white-hot: the hue is never painted at the centre (a white core over the ramp, `core` of the round's size;
 *             the full charge's bigger, `coreFull`, its head a white ball)
 *   ramp      the hue by intensity: [white, the hue saturated, the hue deep] from the core out, each layer additive
 *   halo      a soft disc in the hue round it all (HALO × its size), dim: the effect bleeds into the world
 *   stretch   the body drawn long along its flight (1 + FX_STYLE.stretch, more a level), its intensity at the head
 *   head      how long its head is drawn (its core and its saturated layer): the stretch, but the FULL charge's round
 *             (ROUND_LOOK.headFull), a ball leading its stretched body. The ball is always at the head, on the round (where
 *             it hits): the body's front at the ball's, the streaks and the tail from its centre back, never ahead of it
 *   bulk      how big its head and body are drawn over its size: the full charge's bigger (ROUND_LOOK.bulkFull), as tall as the tall
 *             hitbox it carries (gameworld/feel/lower.js BUSTER_HIT)
 *   streaks   thin bright lines inside the body along its flight, one more a level
 *   tail      a fading streak behind (TAIL × its size, longer a level)
 *   accent    a hue far round the wheel (the cel look's `hue`, scene/juice-style.js JUICE_LOOKS.cel), kept thin: the
 *             rings and some of the sparks
 *   rings     at the FIRING POINT, left there as the round flies on (never following it), round its flight, growing and
 *             fading, one a charge level (the tap none), their near arc bright, their far faded
 *   sparks    a few trailing on the world's clock (more a level), the accent's and white
 *
 *   ROUND_LOOK, roundLook(round, level, { full? }) → { color, size, core, ramp: [hex, hex, hex], halo, stretch, head,
 *                                            bulk, streaks, tail, accent, rings, sparks }
 *   roundLooks(buster) → [tap's, level 1's, …]   (a lowered `rule.buster`, gameworld/feel/lower.js; the last the full charge)
 *
 * THE BLAST'S LOOK, drawn in the same light: a shot's IMPACT (a round bursting on what it meets) and an EXPLOSION (a block
 * blown apart, a body destroyed, a big round's burst) as the same layers (a white-hot core flashing first and fading
 * fastest, the hue saturated round it, deeper at its edge, a halo; shock rings in the accent, their near arc bright; sparks
 * flung out, the accent's and white), each layer on its own clock over the blast's life (BLAST_LOOK: an impact quick and
 * small, an explosion longer, with more rings and sparks). Any colour at all (a foe's round's) has its blast: blastLook
 * runs on the page as its own source.
 *
 *   BLAST_LOOK, blastLook(color, kind, B = BLAST_LOOK) → { ramp, accent, halo, rings, sparks, life, core }
 *   BLAST_LOOK_MILITARY       the realistic register's (an assault frame's field): the accent the fire's own gone gold,
 *                             a ring fewer, more sparks, an explosion that lingers
 *
 * Pure: the same round, the same look.
 */
import { FX_STYLE } from '../../scene/effect-style.js';
import { JUICE_LOOKS } from '../../scene/juice-style.js';

export const ROUND_LOOK = Object.freeze({ core: 0.55, halo: 4.5, tail: 3, rings: [0, 1, 2], sparks: [2, 5, 8], streaks: [1, 2, 3], accent: JUICE_LOOKS.cel.hue, chroma: 0.92, deep: 0.45, headFull: 1.08, bulkFull: 1.3, coreFull: 0.85 });

// an IMPACT and an EXPLOSION: life (s), the core's share of the size, the halo over the size, rings, sparks; the ramp and
// the accent as a round's (ROUND_LOOK's chroma, depth and accent)
export const BLAST_LOOK = Object.freeze({
  impact: Object.freeze({ life: 0.24, core: 0.6, halo: 3.5, rings: 1, sparks: 6 }),
  blast: Object.freeze({ life: 0.5, core: 0.55, halo: 4.5, rings: 2, sparks: 14 }),
  chroma: ROUND_LOOK.chroma, deep: ROUND_LOOK.deep, accent: ROUND_LOOK.accent,
});

// (the military register, an assault frame's field: no far hue but the fire's own gone gold, a ring fewer and more sparks,
// an explosion that lingers; the realistic war's blast, not the cel look's)
export const BLAST_LOOK_MILITARY = Object.freeze({
  impact: Object.freeze({ life: 0.3, core: 0.7, halo: 3.2, rings: 0, sparks: 9 }),
  blast: Object.freeze({ life: 0.85, core: 0.6, halo: 5.2, rings: 1, sparks: 24 }),
  chroma: ROUND_LOOK.chroma, deep: 0.34, accent: 28,
});

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
export function roundLook(round, level = 0, { full = false } = {}) {
  const R = ROUND_LOOK, k = Math.max(0, Math.min(level, R.rings.length - 1)), color = Number.isInteger(round?.color) ? round.color : 0xfff2a8;
  const [h, s] = hsv(color), sat = Math.max(s, R.chroma);
  return {
    color: hex(h, s, hsv(color)[2]), size: round?.size ?? 0.08,
    core: full ? R.coreFull : R.core,
    ramp: ['#ffffff', hex(h, sat, 1), hex(h, 1, R.deep)],
    halo: R.halo + k,
    stretch: Math.round((1 + FX_STYLE.stretch * (1 + 0.5 * k)) * 1000) / 1000,
    head: full ? R.headFull : Math.round((1 + FX_STYLE.stretch * (1 + 0.5 * k)) * 1000) / 1000,
    bulk: full ? R.bulkFull : 1,
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
  const n = (buster.levels ?? []).length;
  return [roundLook(buster.tap, 0), ...(buster.levels ?? []).map((L, i) => roundLook(L, i + 1, { full: i + 1 === n }))];
}

/** A blast's look from its colour: an impact or an explosion. Self-contained: the page runs this source. */
export function blastLook(color, kind, B) {
  const K = (B || BLAST_LOOK)[kind === 'blast' ? 'blast' : 'impact'], X = B || BLAST_LOOK, n = Number.isInteger(color) ? color : 0xffd890;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, M = Math.max(r, g, b), d = M - Math.min(r, g, b);
  const h = (((!d ? 0 : M === r ? 60 * (((g - b) / d) % 6) : M === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4)) + 360) % 360), s = M ? d / M : 0;
  const hx = (hh, ss, vv) => { const f = (k) => { const x = (k + hh / 60) % 6; return vv - vv * ss * Math.max(0, Math.min(x, 4 - x, 1)); }; return '#' + [f(5), f(3), f(1)].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join(''); };
  return { ramp: ['#ffffff', hx(h, Math.max(s, X.chroma), 1), hx(h, 1, X.deep)], accent: hx((h + X.accent) % 360, 0.85, 1), halo: K.halo, rings: K.rings, sparks: K.sparks, life: K.life, core: K.core };
}

/**
 * THE SLASH (a saber's cut, feel/saber.js): drawn in the shot's light, its colour the blade's (blastLook's ramp: a
 * white-hot core, the hue saturated, the hue deep), an arc in the body's own plane (forward and up) that SWEEPS OPEN
 * through the cut's contact window, its head brightest and its tail fading behind it, the core along its outer edge, then
 * fading over `life` seconds. Each swing its arc, in degrees from forward (0) toward up (90): the overhead cross from over
 * the shoulder down in front, the rising cut from low up past the head, the two-handed cleave from behind the head right
 * round to the floor. `radius` a share of the blade's reach, `width` a share of the radius, `core` the white edge's share
 * of the width, `height` the arc's centre a share of the body's height.
 */
export const SLASH_LOOK = Object.freeze({
  arcs: Object.freeze({ neutral: Object.freeze([115, -45]), left: Object.freeze([-75, 70]), back: Object.freeze([165, -95]), forward: Object.freeze([25, -15]), right: Object.freeze([60, -60]), up: Object.freeze([-80, 100]), around: Object.freeze([180, -180]) }),
  radius: 0.85, width: 0.42, core: 0.16, life: 0.16, height: 0.62, lead: 0.12,
});
/** A swing's arc ([from, to] degrees), the overhead cross's for a swing it does not know. */
export const slashArc = (swing) => SLASH_LOOK.arcs[swing] || SLASH_LOOK.arcs.neutral;

/**
 * THE SABER'S BLADE (feel/saber.js): a STRAND of the charged shot held in the hand, drawn as the round is (its ramp: a
 * white-hot core, the hue saturated, the hue deep at its edge; streaks running along it) with the charge's BLOOM round it
 * (a wide soft glow in the hue, drawn over the body as the charge's is). It runs from the hilt's top (`base`, a share of
 * the way from the wrist to the blade's tip) to `length` times the blade's own reach from the wrist (1.2: the light longer
 * than the blade it springs from), past that tip by `cap` of its width; `core`, `body`, `halo` its half-widths
 * (m); `glow` the bloom's strength; `streaks` along it, running at `speed`; lit at `idle` at rest and `cut` through a cut's
 * contact window.
 */
export const SABER_STRAND = Object.freeze({ base: 0.32, length: 1.2, core: 0.035, body: 0.09, halo: 0.42, glow: 0.45, cap: 0.6, streaks: 9, speed: 7, idle: 0.8, cut: 1.3 });

/**
 * THE DASH'S DUST (a feel card's `dash.dust`, lowered onto the rule's dash: feel/lower.js; drawn by the controllable page):
 * a wisp of dust and grit pushed back from the feet while a dash runs ON THE GROUND (an air dash raises none): a `burst`
 * of puffs as it kicks off, then one every `every` seconds, each thrown back along the floor at `back` m/s (`spread` its
 * scatter across) and lifting at `rise`, `size` metres and swelling `grow` times over its `life` seconds as it thins from
 * `alpha`; `color` the dust's (paler than any floor, so it reads on a pale one), `grit` the share of the puffs that are
 * small hard bits (falling, not swelling) in `gritColor`.
 */
export const DASH_DUST = Object.freeze({ burst: 9, every: 0.04, life: 0.5, size: 0.34, grow: 2.2, back: 3.6, spread: 0.7, rise: 0.9, alpha: 0.85, color: '#f4eee4', grit: 0.3, gritColor: '#6e5f50' });
