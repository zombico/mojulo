/**
 * THE DEPICTION SOLVER — how a class of grooms (hair-depict.js hairClass) is best cut into the grass hat's blades at a
 * rung: each candidate's numbers (over HAIR_LADDER's rung: `widen`, `turn`, `lie`, `cap`) scored on every case of the
 * class (hair-score.js: the coverage, the blades' own cover, the outline against the case's strands, the faces), the
 * one kept that every case passes on (no bald spot, the outline held to the rung's own within `slack`) and that reads
 * best for its cost. Its rows go in HAIR_DEPICTION; a new style is covered by its class's row.
 *
 *   candidatesFor(cls, level)            the numbers searched for a class (what its procedure can turn)
 *   prepareCase(chart, D, S, opts)       a case's costly half, once: its hat's strands, its coat, its reference strands
 *   scoreCandidate(kase, rules, opts)    a case under a candidate: { coverage, bladeCover, silhouette, faces }
 *   solveClass(cases, level, opts)       → { rules, baseline, best, table }
 *
 * Pure: the same cases, the same row.
 */
import { hatStrands, hatBlades, growScalp, HAIR_LADDER } from './dermal-hair.js';
import { capMesh, stripsOf } from './hair-depict.js';
import { scoreHair, strandMesh } from './hair-score.js';

/** the gate a candidate passes on every case: the coverage, and the outline at most `slack` under the rung's own */
export const SOLVE_GATE = Object.freeze({ coverage: 0.97, slack: 0.01 });
/** the read a passing candidate is ranked by: its blades' cover and its outline, less `faces` per 10,000 faces */
export const SOLVE_RANK = Object.freeze({ faces: 0.02 });

const grid = (axes) => Object.entries(axes).reduce((all, [k, vs]) => all.flatMap((c) => vs.map((v) => (v === undefined ? c : { ...c, [k]: v }))), [{}]);
/** the numbers a class's procedure turns at `level` (undefined: the rung's own) */
export function candidatesFor(cls, level = 'L1') {
  const R = HAIR_LADDER[level] || HAIR_LADDER.L2, widen = R.guides ? [undefined] : [undefined, 1.8, 2.2];
  const turn = [undefined, R.turn * 2];
  if (cls === 'cropped' || cls === 'short') return grid({ widen, turn, lie: [undefined, 0.6, 0.9] });
  if (cls === 'standing') return grid({ widen, turn, lie: [undefined, 0.4] });
  if (cls === 'coil' || cls === 'tied' || cls === 'rope') return grid({ widen, turn, cap: [undefined, R.stations * 2, R.stations] });
  return grid({ widen, turn });
}

/** a case: the groom `S` on `chart` with dermis `D`, its strands grown at the rung once, its coat, its reference */
export function prepareCase(chart, D, S, { level = 'L1', centre = [0, 0, 0], name = S.style } = {}) {
  const G = hatStrands(chart, D, S, { level });
  const reference = S.length < 0.02 ? null : strandMesh(growScalp(chart, D, S, { colliders: ['head'] }).strands.filter((_, i) => i % 2 === 0), 0.0012);
  return { name, chart, D, S, G, level, centre, cap: capMesh(chart, D, { S }), reference };
}
export function scoreCandidate(kase, rules, { px = 120 } = {}) {
  const blades = kase.G.counts.lying ? [] : hatBlades(kase.G, { level: kase.level, centre: kase.centre, rules });
  const { coverage, bladeCover, silhouette, faces } = scoreHair(kase.chart, kase.D, { strips: stripsOf(blades, kase.centre), cap: kase.cap }, { reference: kase.reference, px });
  return { coverage, bladeCover, silhouette, faces };
}
const read = (s) => s.bladeCover + (s.silhouette ?? 1) - (SOLVE_RANK.faces * s.faces) / 10000;

/** a class's row at `level` over its `cases` (prepareCase each): the candidate every case passes on that reads best */
export function solveClass(cases, cls, { level = 'L1', px = 120, candidates = candidatesFor(cls, level) } = {}) {
  const table = candidates.map((rules) => ({ rules, scores: cases.map((k) => scoreCandidate(k, rules, { px })) }));
  const baseline = table.find((t) => !Object.keys(t.rules).length) ?? table[0];
  const passes = (t) => t.scores.every((s, i) => s.coverage >= SOLVE_GATE.coverage && (s.silhouette ?? 1) >= (baseline.scores[i].silhouette ?? 1) - SOLVE_GATE.slack);
  const mean = (t) => t.scores.reduce((a, s) => a + read(s), 0) / t.scores.length;
  const best = table.filter(passes).sort((a, b) => mean(b) - mean(a))[0] ?? baseline;
  return { cls, level, rules: best.rules, best, baseline, table: table.map((t) => ({ ...t, passes: passes(t), read: Math.round(mean(t) * 1000) / 1000 })) };
}
