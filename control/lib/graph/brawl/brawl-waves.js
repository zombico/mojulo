/**
 * brawl waves — the run & gun's WAVE GROUPS as a tester: a wave a group of the crowd's types that comes in together,
 * stands in a FORMATION round the player and fires to an ATTACK PATTERN, so a group's shape and its rhythm can be tried
 * on the range (brawl-practice.js `range.waves`) and approved before a street is laid with them.
 *
 *   wave = { crowd: [{ type, n, hp?, poise? }], formation?, pattern?, beat?, after?, name? }
 *     crowd      the crowd's types (brawl-crowd.js CROWD_TYPES), how many, each body's health and poise if the test
 *                wants them other than the type's
 *     formation  where it comes in from and stands (FORMATIONS), round the player as the wave starts
 *     pattern    how its shooters fire together (PATTERNS); its brawlers, and every body under 'tokens', fight as the
 *                street's crowd does (the tokens, the ring)
 *     beat       frames between two of its volleys (each shooter's own warning inside it)
 *     after      frames the range waits after the wave before it is cleared (the breath between waves)
 *
 *   FORMATIONS, FORMATION_IDS, PATTERNS, PATTERN_IDS, WAVE_RULES
 *   RANGE_WAVES           the range's sampler (its `waves: true`): one wave of each pattern, each its formation
 *   readRangeWaves(waves) → the waves, read (throws naming the fault)
 *   stationsOf(formation, n, at, band, view) → each body's station [x, z] (mm), round the player's `at`, held to the
 *                                              band (`[n0, n1]`) and the view (`[lo, hi]`)
 *   entryOf(station, at, band, view, formation) → where a body comes in from: the view's edge on its side, or the
 *                                              street's back
 *   volleyAt(pattern, k, n, side, beat) → the frame in each beat shooter `k` of `n` (on `side` of the player) starts its
 *                                              volley: together, one after another, by halves, by sides
 *
 * Pure: no clock, no dice.
 */
import { CROWD_TYPES } from './brawl-crowd.js';

export const FORMATIONS = Object.freeze({
  line: 'side by side across the street, ahead: a wall to cut down or slip past',
  column: 'one behind another on your line, ahead: a column a round passes through (pierce)',
  stairs: 'staggered ahead and across the street, a step each: no one line clears them',
  pincer: 'half ahead, half behind: you turn, or you roll',
  surround: 'all round you, along and across: nowhere to stand and fire one way',
  back: 'along the street\'s far side, come in from the back: aim across',
});
export const FORMATION_IDS = Object.freeze(Object.keys(FORMATIONS));
export const PATTERNS = Object.freeze({
  tokens: 'the street\'s crowd: a few at a time on their tokens, the rest on the ring',
  volley: 'all together on the beat: one wall of rounds, a roll or a step through it',
  sweep: 'one after another down the formation: a ripple to walk through',
  alternate: 'by halves, half a beat apart: one half always firing (suppression)',
  pincer: 'by sides, half a beat apart: ahead, then behind',
});
export const PATTERN_IDS = Object.freeze(Object.keys(PATTERNS));
export const WAVE_RULES = Object.freeze({
  beat: 120,       // frames between two volleys unless a wave says
  after: 90,       // frames between a wave cleared and the next coming in
  gap: 14,         // frames between two shooters' volleys in a sweep
  ahead: 4200,     // mm a formation stands from the player along the street
  spacing: 900,    // mm between two bodies of a column or a stair
  ring: 3200,      // mm a surround stands round the player
  enter: 900,      // mm outside the view a body comes in from
  dead: 150,       // mm a body counts as at its station
});

/** the sampler: a volley's wall, a pincer by halves, a sweep down the stairs, a column to pierce, brawlers round you */
export const RANGE_WAVES = Object.freeze([
  { name: 'a wall of rifles', crowd: [{ type: 'rifleman', n: 3 }], formation: 'line', pattern: 'volley' },
  { name: 'caught between', crowd: [{ type: 'gunner', n: 4 }], formation: 'pincer', pattern: 'pincer' },
  { name: 'down the stairs', crowd: [{ type: 'rifleman', n: 4 }], formation: 'stairs', pattern: 'sweep' },
  { name: 'suppressed', crowd: [{ type: 'gunner', n: 2 }, { type: 'rifleman', n: 2 }], formation: 'back', pattern: 'alternate' },
  { name: 'a column', crowd: [{ type: 'rifleman', n: 3 }, { type: 'bazooka', n: 1 }], formation: 'column', pattern: 'volley' },
  { name: 'surrounded', crowd: [{ type: 'thug', n: 3 }, { type: 'grenadier', n: 1 }], formation: 'surround', pattern: 'tokens' },
].map((w) => Object.freeze(w)));

/** Read a range's waves (`true`: the sampler). */
export function readRangeWaves(waves0) {
  const waves = waves0 === true ? RANGE_WAVES : waves0;
  if (!Array.isArray(waves) || !waves.length || waves.length > 20) throw new Error('brawl: a range\'s waves are a list of 1 to 20 waves ({ crowd, formation?, pattern?, beat?, after? })');
  return waves.map((w, i) => {
    const at = `range.waves[${i}]`;
    if (!w || typeof w !== 'object') throw new Error(`brawl: ${at} is { crowd: [{ type, n }], formation?, pattern?, beat?, after? }`);
    if (!Array.isArray(w.crowd) || !w.crowd.length) throw new Error(`brawl: ${at}.crowd is a list of { type, n }`);
    const crowd = w.crowd.map((c, j) => {
      if (!CROWD_TYPES[c?.type]) throw new Error(`brawl: ${at}.crowd[${j}].type is one of ${Object.keys(CROWD_TYPES).join(', ')}`);
      if (!(Number.isInteger(c.n) && c.n >= 1 && c.n <= 8)) throw new Error(`brawl: ${at}.crowd[${j}].n is 1 to 8`);
      for (const k of ['hp', 'poise']) if (c[k] !== undefined && !(Number.isInteger(c[k]) && c[k] >= 1 && c[k] <= 9999)) throw new Error(`brawl: ${at}.crowd[${j}].${k} is a whole number from 1 to 9999`);
      return { type: c.type, n: c.n, ...(c.hp ? { hp: c.hp } : {}), ...(c.poise ? { poise: c.poise } : {}) };
    });
    if (crowd.reduce((a, c) => a + c.n, 0) > 12) throw new Error(`brawl: ${at} is 12 bodies at most`);
    const formation = w.formation ?? 'line', pattern = w.pattern ?? 'tokens';
    if (!FORMATIONS[formation]) throw new Error(`brawl: ${at}.formation is one of ${FORMATION_IDS.join(', ')}`);
    if (!PATTERNS[pattern]) throw new Error(`brawl: ${at}.pattern is one of ${PATTERN_IDS.join(', ')}`);
    for (const k of ['beat', 'after']) if (w[k] !== undefined && !(Number.isInteger(w[k]) && w[k] >= 20 && w[k] <= 1200)) throw new Error(`brawl: ${at}.${k} is a whole number of frames from 20 to 1200`);
    return { crowd, formation, pattern, beat: w.beat ?? WAVE_RULES.beat, after: w.after ?? WAVE_RULES.after, name: typeof w.name === 'string' ? w.name : `${formation} · ${pattern}` };
  });
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Each of `n` bodies' station round the player at `at` ([x, z]), held to the band and the view. */
export function stationsOf(formation, n, at, band, view) {
  const R = WAVE_RULES, [n0, n1] = band, [lo, hi] = view, [x0, z0] = at;
  // (ahead: the side of the player with more of the view; a formation never stands off the screen)
  const dir = hi - x0 >= x0 - lo ? 1 : -1;
  const across = (k, m) => Math.round(n0 + ((k + 1) * (n1 - n0)) / (m + 1));
  const out = Array.from({ length: n }, (_, k) => {
    switch (formation) {
      case 'column': return [x0 + dir * (R.ahead - 600 + k * R.spacing), z0];
      case 'stairs': return [x0 + dir * (R.ahead - 900 + k * R.spacing), across(k, n)];
      case 'pincer': { const side = k % 2 ? -dir : dir, j = Math.floor(k / 2), m = Math.ceil(n / 2); return [x0 + side * R.ahead, across(j, m)]; }
      case 'surround': { const a = (2 * Math.PI * k) / n; return [Math.round(x0 + Math.cos(a) * R.ring), Math.round(z0 + Math.sin(a) * R.ring)]; }
      case 'back': return [Math.round(x0 + dir * (((k - (n - 1) / 2) * R.spacing * 1.4) + 1200)), n1 - 200];
      default: return [x0 + dir * R.ahead, across(k, n)];   // line
    }
  });
  return out.map(([x, z]) => [clamp(Math.round(x), lo + 500, hi - 500), clamp(Math.round(z), n0 + 100, n1 - 100)]);
}

/** Where a body comes in from for its station: the view's edge on its side of the player, or the street's back. */
export function entryOf(station, at, band, view, formation) {
  const R = WAVE_RULES;
  if (formation === 'back') return [station[0], band[1]];
  return [station[0] >= at[0] ? view[1] + R.enter : view[0] - R.enter, station[1]];
}

/** The frame in each beat shooter `k` of `n` (its side of the player, ±1) starts its volley. */
export function volleyAt(pattern, k, n, side, beat) {
  if (pattern === 'sweep') return (k * WAVE_RULES.gap) % beat;
  if (pattern === 'alternate') return k % 2 ? Math.floor(beat / 2) : 0;
  if (pattern === 'pincer') return side > 0 ? 0 : Math.floor(beat / 2);
  return 0;   // volley: together
}
