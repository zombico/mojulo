/**
 * THE COMPOSITION — one room laid from its brief (needs.js) out of the room primitives (primitives.js). Square, centred
 * on the origin, its side the brief's. Three bands: the ENTRY (south, the spawn), the FIELD (the middle, where the
 * primitives stand) and the GOAL (north). Laid by the craft of an arena, not by chance:
 *
 *   a lane       a clear spine from the spawn to the goal: the room can always be crossed
 *   mirrored     what stands off the spine stands in pairs, mirrored across it: the room reads at a glance and neither
 *                flank is the better one
 *   kept apart   every primitive a metre clear of every other, the spawn and the goal, and the walls
 *   platforms    against the side walls, their steps facing the spawn
 *   foe spots    in the north half, behind cover from the spawn where there is cover, spread across the room
 *   a shift      its line (game/work-mechanics.js layWork) laid down the middle as counters, crates, shelves and the
 *                pass, the spawn among them and the goal the pass; the room grown to hold it
 *
 * The dice (seeded) only order the lattice the primitives are tried on; the bands, the lane and the mirror are rules.
 *
 *   composeRoom(needs, { seed? (1) }) → { size, half, primitives: [{ kind, id, at, rot, h? }], anchors: { spawn, goal,
 *     foes: [[x, y, z]] }, work: { card, layout } | null, seed }
 *
 * Pure, seeded.
 */
import { PRIMITIVES, footprint } from './primitives.js';
import { layWork } from '../game/work-mechanics.js';
import { streamOf } from '../city/plan/dice.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const GAP = 1;          // the clear metres kept round every primitive
const LATTICE = 2.5;    // the field's lattice, metres

const overlaps = (a, b, gap) => a.x[0] - gap < b.x[1] && b.x[0] - gap < a.x[1] && a.y[0] - gap < b.y[1] && b.y[0] - gap < a.y[1];
const box = (at, r) => ({ x: [at[0] - r, at[0] + r], y: [at[1] - r, at[1] + r] });

export function composeRoom(needs, { seed = 1 } = {}) {
  const dice = streamOf(seed, 'gameroom', 'lattice');
  const prims = [], taken = [];
  let size = needs.size, work = null;
  // A SHIFT: its line down the middle, the room grown to hold it with a lane round it
  if (needs.work) {
    const L = layWork(needs.work.card, [0, -0.4, 0], 0);
    const pts = [...Object.values(L.stations).flat(), ...Object.values(L.crates), ...Object.values(L.shelves), L.serve];
    const reach = Math.max(...pts.flatMap((q) => [Math.abs(q[0]), Math.abs(q[1])]));
    size = Math.max(size, 2 * Math.ceil(reach + 4));
    work = { card: needs.work.card, layout: L };
  }
  const half = size / 2;
  const spawn = work ? [0, r3((Math.max(...Object.values(work.layout.stations).flat().map((q) => q[1])) + Math.min(...Object.values(work.layout.shelves).map((q) => q[1]).concat([work.layout.serve[1] - 2.4]))) / 2), 0] : [0, r3(-half + 2), 0];
  const goal = work ? work.layout.serve.slice() : [0, r3(half - 2), 0];
  taken.push(box(spawn, 1.2), box(goal, 1.2));
  const place = (p) => {
    const f = footprint(p);
    if (f.x[0] < -half + GAP || f.x[1] > half - GAP || f.y[0] < -half + GAP || f.y[1] > half - GAP) return false;
    if (taken.some((t) => overlaps(f, t, GAP))) return false;
    taken.push(f); prims.push(p); return true;
  };
  if (work) {
    const L = work.layout;
    for (const [sid, list] of Object.entries(L.stations)) list.forEach((at, k) => { const p = { kind: 'counter', id: `station-${sid}-${k}`, at, rot: 0, verb: work.card.stations[sid].verb, sid }; prims.push(p); taken.push(footprint(p)); });
    for (const [item, at] of Object.entries(L.crates)) { const p = { kind: 'bin', id: `bin-${item}`, at, rot: 0, item }; prims.push(p); taken.push(footprint(p)); }
    for (const [item, at] of Object.entries(L.shelves)) { const p = { kind: 'shelf', id: `shelf-${item}`, at, rot: 0, item }; prims.push(p); taken.push(footprint(p)); }
    const p = { kind: 'pass', id: 'pass', at: L.serve, rot: 0 }; prims.push(p); taken.push(footprint(p));
  }
  // the lattice of the field (east half only: the west is its mirror), seeded in its order
  const cells = [];
  for (let x = LATTICE; x <= half - 2; x += LATTICE) for (let y = -half + 4.5; y <= half - 4; y += LATTICE) cells.push([r3(x), r3(y)]);
  for (let k = cells.length - 1; k > 0; k--) { const j = Math.floor(dice() * (k + 1)); [cells[k], cells[j]] = [cells[j], cells[k]]; }
  let n = 0;
  const pair = (kind, count, extra = {}) => {
    let laid = 0;
    for (const c of cells) {
      if (laid >= count) break;
      const rot = kind === 'pillar' ? 0 : dice() < 0.5 ? 0 : 90, id = `${kind}-${++n}`;
      const a = { kind, id: `${id}a`, at: [c[0], c[1], 0], rot, ...extra }, b = { kind, id: `${id}b`, at: [-c[0], c[1], 0], rot, ...extra };
      const fa = footprint(a), fb = footprint(b);
      if (overlaps(fa, fb, GAP)) continue;
      if (!place(a)) continue;
      if (!place(b)) { prims.pop(); taken.pop(); continue; }
      laid += 2;
    }
    return laid;
  };
  // PLATFORMS against the side walls, their steps toward the spawn
  for (let k = 0, laid = 0; laid < needs.platforms && k < 6; k++) {
    const y = r3(-half / 2 + (k * half) / 3), x = r3(half - 2.5);
    const a = { kind: 'platform', id: `platform-${k + 1}a`, at: [x, y, 0], rot: 0, h: needs.lift }, b = { ...a, id: `platform-${k + 1}b`, at: [-x, y, 0] };
    if (place(a)) { laid++; if (laid < needs.platforms && place(b)) laid++; }
  }
  // the rest in mirrored pairs (an overhead camera keeps the room low: no pillars)
  if (needs.camera !== 'top-down') pair('pillar', needs.pillars);
  pair('cover-low', needs.cover);
  // FOE SPOTS: in the north half, a step behind cover from the spawn where there is cover, spread east to west
  const covers = prims.filter((p) => PRIMITIVES[p.kind].affords.includes('cover') && p.at[1] > -1);
  const spots = [];
  const spotFree = (at) => !taken.some((t) => overlaps(box(at, 0.5), t, 0.3)) && Math.abs(at[0]) < half - 1.5 && at[1] < half - 1.5;
  for (const c of covers.slice().sort((a, b) => a.at[0] - b.at[0])) {
    if (spots.length >= needs.foes) break;
    const at = [c.at[0], r3(c.at[1] + footprint(c).y[1] - c.at[1] + 1), 0];
    if (spotFree(at) && !spots.some((s) => Math.hypot(s[0] - at[0], s[1] - at[1]) < 2.5)) spots.push(at);
  }
  for (let k = 0; spots.length < needs.foes && k < 24; k++) {
    const x = r3(((k % 5) - 2) * (half / 3)), y = r3(half / 3 + Math.floor(k / 5) * 1.5), at = [x, y, 0];
    if (spotFree(at) && !spots.some((s) => Math.hypot(s[0] - at[0], s[1] - at[1]) < 2.5)) spots.push(at);
  }
  return { size, half, primitives: prims, anchors: { spawn, goal, foes: spots }, work, seed };
}
