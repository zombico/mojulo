/**
 * A PLANNED MAP'S SEGMENTS as a crew's units (level/plan.js): `level:<id>/<segment>`, each written by its own author
 * against the gates its level's plan fixed, its pages its segment only (`/levels/<id>/glyphs/segments/<S>`), the map
 * consolidated by the plan's stitch and its laws.
 *
 *   levelPlan(W, level)       → the plan of a glyph-map level, read (plan.js readPlan); throws, naming what is missing
 *   segmentUnits(W, level)    → every segment's unit, in the order the route walks them, the segments off it (joined)
 *                               after
 *   checkSegment(W, unit)     → throws unless the unit names a segment its level's plan lays out
 *   segmentRemit(W, unit)     → what the segment's author is handed: its size, role, words, gates and the neighbour each
 *                               joins, the quest beats played on it, the default fill (the floor to beat) and its law;
 *                               and its SKETCH's brief (level/map-sketch.js): the level's pitch and the journey's beats
 *                               here, the ground across each gate, what to decide (ground, height, marks), the sketch's
 *                               laws as they stand: the segment planned in miniature beside its glyphs
 * Pure.
 */
import { unitOf } from './chapters.js';
import { readPlan, fillSegment, gateTile } from '../level/plan.js';
import { readGrid } from '../level/grid.js';
import { readSketch, segmentBriefs, sketchLaws } from '../level/map-sketch.js';

const SIDE = Object.freeze({ n: 'north', e: 'east', s: 'south', w: 'west' });

export function levelPlan(W, level) {
  const L = W?.levels?.[level];
  if (!L) throw new Error(`no level '${level}' in this world (its levels: ${Object.keys(W?.levels ?? {}).join(', ') || 'none'})`);
  if (!L.glyphs?.plan) throw new Error(`level '${level}' is not a planned map (its glyphs carry no plan): its segments are a plan's`);
  return readPlan(L.glyphs.plan, `levels.${level}.glyphs.plan`);
}

export const segmentUnits = (W, level) => { const P = levelPlan(W, level); return [...P.route, ...Object.keys(P.at).filter((S) => !P.route.includes(S))].map((S) => `level:${level}/${S}`); };

export function checkSegment(W, unit) {
  const u = unitOf(unit);
  if (!u?.segment) return;
  const P = levelPlan(W, u.level);
  if (!P.at[u.segment]) throw new Error(`level '${u.level}' has no segment '${u.segment}' (its plan's: ${Object.keys(P.at).join(', ')})`);
}

export function segmentRemit(W, unit) {
  const u = unitOf(unit), P = levelPlan(W, u.level), S = u.segment, n = P.size, name = (X) => P.key[X]?.name ?? X;
  const { role: _r, goal, name: _n, ...words } = P.key[S] ?? {};
  // (every gate of it: the walk's way in and out, and its joins)
  const gates = Object.entries(P.ways[S]).map(([side, to]) => ({ side, way: side === P.sides[S].in ? 'in' : side === P.sides[S].out ? 'out' : 'joined', tile: gateTile(n, side), joins: name(to) }));
  // (the main quest's beats played on this segment: by its letter or its name)
  const beats = (W.mainQuest?.acts ?? W.mainQuest?.chapters ?? []).flatMap((A) => (A.beats ?? []).filter((b) => b?.as?.level === u.level && (b.as.region === S || b.as.region === name(S))).map((b) => ({ act: A.id, beat: b.id, goal: b.goal })));
  return {
    segment: S, name: name(S), role: P.roles[S], size: n, ...(Object.keys(words).length ? { words } : {}),
    gates: gates.map((g) => `${g.way === 'joined' ? 'a join' : g.way} by the ${SIDE[g.side]} side, row ${g.tile[0] + 1} column ${g.tile[1] + 1} a path ('#'), joining ${g.joins}`),
    ...(goal ? { goal: `the walk ends here: a place whose key says goal: true (the plan's: ${goal.use})` } : {}),
    ...(beats.length ? { beats } : {}),
    // (its floor: what is written there already, else what the plan's fill lays; the bar to beat either way)
    ...(W.levels[u.level].glyphs.segments?.[S] ? { written: W.levels[u.level].glyphs.segments[S] } : { floor: fillSegment(P, S) }),
    law: `${n} rows of ${n} glyphs; a path at each gate and none other on a side a neighbour segment lies beyond; every path reached from the gates; a side on open land or the map's edge is yours`,
    sketch: sketchRemit(W, u.level, S),
    writes: `set /levels/${u.level}/glyphs/segments/${S} to { rows, key? }, and /levels/${u.level}/glyphs/sketch/segments/${S} to { ground, height, marks, notes? } (its approval is the creator's)`,
  };
}

// THE SKETCH'S BRIEF of one segment (level/map-sketch.js): planned in miniature beside its glyphs
function sketchRemit(W, level, S) {
  const g = W.levels[level].glyphs, G = readGrid({ ...(g.tile !== undefined ? { tile: g.tile } : {}), plan: g.plan, ...(g.segments !== undefined ? { segments: g.segments } : {}) }, 'glyphs');
  const K = readSketch(g.sketch, G.plan), B = segmentBriefs(G, K)[S];
  return {
    ...(B.pitch ? { pitch: B.pitch } : {}),
    journey: B.beats.length ? B.beats.map((b) => `${b.say} (${b.kind})`) : 'no beat of the journey here yet (the director writes it: glyphs.sketch.concept)',
    land: `its land stands ${B.riseBase} m up; a height step is ${B.step} m over that`,
    across: B.gates.map((x) => `${x.side}: ${x.toName}'s ground across the gate stands ${x.neighbourHeight} m up${x.neighbourSketched ? '' : ' (not yet sketched)'}`),
    decide: B.decide,
    laws: B.laws,
    now: sketchLaws(G, K).filter((l) => !l.ok).map((l) => `${l.law}: ${l.value}`),
    ...(B.current ? { current: B.current } : {}),
  };
}
