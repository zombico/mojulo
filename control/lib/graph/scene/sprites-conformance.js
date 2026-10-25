/**
 * THE SPRITES CONFORMANCE CORPUS — a world's game sfx (spriteSfx) as the Godot kernel draws them (kernel/sfx.gd, since
 * 0.31.0) against the web's verb shelf (game/glyph-sfx-sprites.js beadsFor) and the page's card rule
 * (scene/channels/sprite-sfx.js: hidden under 0.05, sized and lit by the bead's brightness). A scenario is one layer
 * (a verb at an anchor, its params, size and rate) read at a run of clock readings; both sides print one canonical
 * string a reading: every bead's place and brightness to 1e-6, and the cards drawn.
 *
 *   SCENARIOS, corpus(), runSprites(sc) → [string]
 *
 * One scenario per verb with its defaults, and one per path a verb's params open (a wider orbit, a taller heal, a
 * longer reach, a shifted scatter, a shorter beacon).
 */
import { beadsFor, SPRITE_VERB_IDS, SPRITE_VERBS } from '../game/glyph-sfx-sprites.js';

// to 1e-6: the sparkle's scatter hash multiplies a sine's last bit by 43758, so two maths libraries part near the ninth
// digit; a card is drawn in float32, which keeps about seven
const nano = (x) => (Number.isFinite(x) ? Math.floor(x * 1e6 + 0.5) / 1e6 : null);
function canon(v) {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
// the clock: a second and a half of readings, then a jump far along (a long-running level)
const CLOCK = [...Array.from({ length: 45 }, (_, i) => i / 30), 37.25, 401.5];
const PARAMS = { enchant: { orbitR: 1.4 }, heal: { height: 2.5, cz: 0.3 }, accumulate: { reach: 3 }, sparkle: { spread: [3, 2, 0.5] }, beacon: { count: 4, height: 2 }, aura: { base: 0.1, pulse: 0.9 } };

export const SCENARIOS = [
  ...SPRITE_VERB_IDS.map((verb, i) => ({ id: `sprites-${verb}`, about: `${verb} with its defaults`, verb, cc: [i * 1.5 - 4, 2 - i * 0.25, 0.5], params: {}, size: 0.6, rate: SPRITE_VERBS[verb].rate })),
  ...Object.entries(PARAMS).map(([verb, params]) => ({ id: `sprites-${verb}-tuned`, about: `${verb} with its params set`, verb, cc: [3, -2, 1], params, size: 0.9, rate: 1.7 })),
];

const snap = (beads, size) => canon({
  beads: beads.map((b) => [b.p.map(nano), nano(b.w)]),
  cards: beads.map((b) => (!b || b.w < 0.05 ? null : [nano(size * (0.35 + 0.65 * Math.min(1, b.w))), nano(Math.min(1, 0.35 + 0.65 * b.w))])),
});

export function runSprites(sc) {
  return CLOCK.map((t) => snap(beadsFor(sc.verb, sc.cc, t * sc.rate, sc.params), sc.size));
}

export function corpus() {
  return SCENARIOS.map((sc) => ({ ...JSON.parse(JSON.stringify(sc)), clock: CLOCK }));
}

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id);
