/**
 * THE DESTRUCTIBLE PHYSICS CONFORMANCE CORPUS (rupa: `destruction: 'physical'`), its ENERGY slice — what the Godot kernel
 * (kernel/rupa.gd) runs against the web's own (worlds/controllable/rupa.js and the gravity of rules-basic.js), frame by
 * frame, for an exported level's breakables: a blow is joules, a block holds joules (its matter's toughness × its volume),
 * the blows of a world (a burst's share by the solid angle a block fills, a round's, scaled by the world's power), what
 * loses its hold falls, a landing is an impact on what it lands on, and the load is worked out again (crushing, a hung
 * span in bending). Each scenario is a handful of blocks, each with its matter's numbers (rupa/matter.js blockMatter, so
 * both sides read the same numbers), the world's settings, and the blows a frame; both sides print one canonical
 * snapshot a frame: each block's state (standing, falling, or how it broke), its foot's height and its joules left.
 *
 *   SLICE, DT, SCENARIOS, corpus(), runRupa(sc) → [snapshot], scenarioById(id)
 *
 * The slice is the matter that breaks before it flows (brick, concrete, stone, glass): a plastic block's dents, heat,
 * fire, wind, the ground and water are later slices with their own corpora, so a world here sets `heatShare: 0` and
 * names no wind. One scenario a path: a burst over matters, a world's power, a span losing a support, a cantilever past
 * its bond, a stack landing, rounds wearing a wall, a block broken by a call.
 */
import { composeLive } from '../worlds/controllable/compose.js';
import { blockMatter } from '../rupa/matter.js';

export const SLICE = 'energy';
export { block };
export const DT = 1 / 30;
const clone = (x) => JSON.parse(JSON.stringify(x));
// a block of a matter, its numbers as the mint gives them (only the ones the energy slice reads travel)
const KEYS = ['joules', 'mass', 'compressive', 'cohesion', 'stiff', 'bounce', 'fill'];
function block(id, min, max, matter, extra = {}) {
  const m = blockMatter({ min, max }, matter), out = { id, min, max, hp: 1, ...extra };
  if (m.yield > 0 || m.kerfWork > 0) throw new Error(`rupa conformance: ${id} (${matter}) is plastic or cut: the energy slice is the brittle matters`);
  for (const k of KEYS) if (m[k] !== undefined) out[k] = m[k];
  return out;
}
// the brittle matters: none of them yields or is cut (a plastic block's dents are the distortion slice)
const BRITTLE = ['brick', 'concrete', 'stone', 'glass'];
const wall = (matter, x) => [0, 1, 2, 3].map((r) => block(`${matter}:${r}`, [x, 1.5, r * 0.5], [x + 1.2, 1.8, (r + 1) * 0.5], matter));
const at = (frame, blow) => ({ frame, ...blow });

export const SCENARIOS = [
  { id: 'burst-matters', about: 'one charge before four walls of four matters: glass and brick go, stone and concrete hold more',
    blocks: BRITTLE.flatMap((m, i) => wall(m, (i - 1.5) * 4 - 0.6)), world: { heatShare: 0 }, frames: 60,
    blows: [0, 1, 2, 3].map((i) => at(2, { burst: { pos: [(i - 1.5) * 4, 0, 0.3], radius: 2.5 } })) },
  { id: 'burst-power', about: 'the same far charge from a person and from a giant monster',
    blocks: wall('stone', 1.4), world: { heatShare: 0, power: 1e5 }, frames: 40, blows: [at(1, { burst: { pos: [0, 0, 0.5], radius: 3 } })] },
  { id: 'lintel-loses-a-jamb', about: 'a lintel on two jambs holds; a jamb broken by a call, the span it now cantilevers snaps and falls',
    blocks: [0, 1, 2, 3].flatMap((r) => [block(`L${r}`, [0, 0, r * 0.5], [0.5, 0.3, (r + 1) * 0.5], 'brick'), block(`R${r}`, [2.5, 0, r * 0.5], [3, 0.3, (r + 1) * 0.5], 'brick')])
      .concat([block('lintel', [0.5, 0, 1.7], [2.5, 0.3, 2], 'brick', { bond: 'lateral' })]), world: { heatShare: 0 }, frames: 70, blows: [at(10, { break: 'R0' })] },
  { id: 'cantilever-past-its-bond', about: 'two concrete slabs held off posts, a brick dropped on each (the landing works the load out): the short one carries it, the long one snaps',
    blocks: [[0, 2], [3, 6]].flatMap(([y, n]) => [block(`post${n}`, [0, y, 0], [0.5, y + 1, 2], 'concrete'),
      ...Array.from({ length: n }, (_, k) => block(`slab${n}.${k}`, [0.5 + k, y, 1.75], [1.5 + k, y + 1, 2], 'concrete', { bond: 'lateral' })),
      block(`brick${n}`, [n - 0.1, y + 0.4, 2.3], [n + 0.1, y + 0.6, 2.4], 'brick')]),
    world: { heatShare: 0 }, frames: 50, blows: [] },
  { id: 'stack-lands', about: 'a stone dropped from three metres lands on a glass sheet: the landing an impact, the glass breaks',
    blocks: [block('sheet', [0, 0, 0], [1, 1, 0.05], 'glass'), block('stone', [0.2, 0.2, 3], [0.8, 0.8, 3.6], 'stone')], world: { heatShare: 0 }, frames: 40, blows: [] },
  { id: 'rounds-wear-a-wall', about: 'rounds on a brick course: each one takes its joules, the fourth breaks it, the course above drops and the fifth wears it',
    blocks: [block('course', [3, -0.6, 0], [3.3, 0.6, 0.5], 'brick'), block('above', [3, -0.6, 0.5], [3.3, 0.6, 1], 'brick')], world: { heatShare: 0, power: 1, shot: 1500 }, frames: 40,
    blows: [5, 10, 15, 20, 25].map((f) => at(f, { shot: { from: [0, 0, 0.25], to: [3, 0, 0.25] } })) },
  { id: 'call-breaks-the-base', about: 'a column of stone courses: the base broken by a call, the rest falls a course and lands',
    blocks: [0, 1, 2, 3, 4].map((r) => block(`c${r}`, [0, 0, r * 0.6], [0.6, 0.6, (r + 1) * 0.6], 'stone')), world: { heatShare: 0 }, frames: 45, blows: [at(3, { break: 'c0' })] },
];

// ── the web side: the runtime as a page composes it, the blows put where its passes read them ───────────────────────
const CW = composeLive();
const SHOOTER = { id: 'gun', rule: { type: 'walk', speed: 0, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, transform: { pos: [-40, -40, 0], heading: 0, pitch: 0 } };   // clear of every block: the blows say where they come from
const r6 = (x) => (Math.round(x * 1e6) / 1e6).toFixed(6);
const r3 = (x) => (Math.round(x * 1e3) / 1e3).toFixed(3);

/** One block's canonical state: id, how it broke (or `fall`ing, or standing), its foot's height to 1e-6, its joules to 1e-3. */
export const blockSnap = (b) => `${b.id}|${b.broken ? b.broken.how : b.falling ? 'falling' : '-'}|${r6(b.min[2])}|${r3(b.rupa ? Math.max(0, b.rupa.joules) : 0)}`;
export const snapshot = (w) => w.breakables.map(blockSnap).join(';');

export function runRupa(sc) {
  const w = CW.createWorld({ entities: [clone(SHOOTER)], breakables: clone(sc.blocks), rupa: clone(sc.world), breakFloor: 0 });
  const snaps = [];
  for (let f = 0; f < sc.frames; f++) {
    for (const b of sc.blows.filter((x) => x.frame === f)) {
      if (b.burst) w.bursts.push({ seq: ++w.burstSeq, pos: b.burst.pos.slice(), t: w.time, radius: b.burst.radius });
      if (b.shot) w.byId.gun.lastShot = { mode: 'miss', t: w.time, from: b.shot.from.slice(), to: b.shot.to.slice() };
      if (b.break) CW.breakBlock(w, b.break, Infinity);
    }
    CW.stepWorld(w, {}, DT, { ground: () => 0 });
    snaps.push(snapshot(w));
  }
  return snaps;
}

// what the Godot side reads: the blocks with their numbers, the world's settings, the blows, the frame count
export function corpus() {
  return SCENARIOS.map((sc) => clone({ id: sc.id, blocks: sc.blocks, world: sc.world, blows: sc.blows, frames: sc.frames, dt: DT, floor: 0 }));
}

export const scenarioById = (id) => SCENARIOS.find((s) => s.id === id);
