/**
 * A PLANNED MAP'S SEGMENTS as a crew's units (level/plan.js): `level:<id>/<segment>`, each written by its own author
 * against the gates its level's plan fixed, its pages its segment only (`/levels/<id>/glyphs/segments/<S>`), the map
 * consolidated by the plan's stitch and its laws.
 *
 *   levelPlan(W, level)       → the plan of a glyph-map level, read (plan.js readPlan); throws, naming what is missing
 *   segmentUnits(W, level)    → every segment's unit, in the order the route walks them
 *   checkSegment(W, unit)     → throws unless the unit names a segment its level's plan lays out
 *   segmentRemit(W, unit)     → what the segment's author is handed: its size, role, words, gates and the neighbour each
 *                               joins, the quest beats played on it, the default fill (the floor to beat) and its law
 * Pure.
 */
import { unitOf } from './chapters.js';
import { readPlan, fillSegment, gateTile } from '../level/plan.js';

const SIDE = Object.freeze({ n: 'north', e: 'east', s: 'south', w: 'west' });

export function levelPlan(W, level) {
  const L = W?.levels?.[level];
  if (!L) throw new Error(`no level '${level}' in this world (its levels: ${Object.keys(W?.levels ?? {}).join(', ') || 'none'})`);
  if (!L.glyphs?.plan) throw new Error(`level '${level}' is not a planned map (its glyphs carry no plan): its segments are a plan's`);
  return readPlan(L.glyphs.plan, `levels.${level}.glyphs.plan`);
}

export const segmentUnits = (W, level) => levelPlan(W, level).route.map((S) => `level:${level}/${S}`);

export function checkSegment(W, unit) {
  const u = unitOf(unit);
  if (!u?.segment) return;
  const P = levelPlan(W, u.level);
  if (!P.at[u.segment]) throw new Error(`level '${u.level}' has no segment '${u.segment}' (its plan's: ${Object.keys(P.at).join(', ')})`);
}

export function segmentRemit(W, unit) {
  const u = unitOf(unit), P = levelPlan(W, u.level), S = u.segment, n = P.size, name = (X) => P.key[X]?.name ?? X;
  const { role: _r, goal, name: _n, ...words } = P.key[S] ?? {};
  const gates = Object.entries(P.sides[S]).map(([way, side]) => ({ side, way: way === 'in' ? 'in' : 'out', tile: gateTile(n, side), joins: name(P.route[P.route.indexOf(S) + (way === 'in' ? -1 : 1)]) }));
  // (the main quest's beats played on this segment: by its letter or its name)
  const beats = (W.mainQuest?.acts ?? W.mainQuest?.chapters ?? []).flatMap((A) => (A.beats ?? []).filter((b) => b?.as?.level === u.level && (b.as.region === S || b.as.region === name(S))).map((b) => ({ act: A.id, beat: b.id, goal: b.goal })));
  return {
    segment: S, name: name(S), role: P.roles[S], size: n, ...(Object.keys(words).length ? { words } : {}),
    gates: gates.map((g) => `${g.way} by the ${SIDE[g.side]} side, row ${g.tile[0] + 1} column ${g.tile[1] + 1} a path ('#'), joining ${g.joins}`),
    ...(goal ? { goal: `the walk ends here: a place whose key says goal: true (the plan's: ${goal.use})` } : {}),
    ...(beats.length ? { beats } : {}),
    floor: fillSegment(P, S),
    law: `${n} rows of ${n} glyphs; a path at each gate and none other on a side a neighbour segment lies beyond; every path reached from the gates; a side on open land or the map's edge is yours`,
    writes: `set /levels/${u.level}/glyphs/segments/${S} to { rows, key? }`,
  };
}
