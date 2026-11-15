/**
 * THE FIGHT — a place composed for one fight, out of the room primitives (primitives.js), from what the hero's kit asks
 * of the space (needs.js kitAsks). The room is where a fight is settled: tried in the practice door, approved there, then
 * laid by these same rules wherever a level has a place for it. A fight is never a level.
 *
 * Square, centred on the origin, like the room (compose.js): the hero comes in from the south, the way on is north. Laid
 * by rule; the dice (seeded) only turn what may be turned.
 *
 *   FIGHT_KINDS   a closed table, a new kind a row: { about, teaches, answers: [the asks it answers], waves: the waves it
 *                 starts with, by role (grunt, shooter, elite, boss: read against the world's bestiary where it is played) } and how it is laid:
 *     duel      one foe in a small ring, cover off each flank: where the string is learned
 *     melee     the ring at the centre, rifts round its far side where the waves come in, urns at the walls, a font by
 *               the way on: where the string is tested on a pack
 *     gallery   shooters on perches down both flanks, a deck an air dash short of the first, a run-up down the spine to a
 *               foe at its end, cover to break their lines: where the sidearm, the dash and the air are asked for
 *     boss      the widest ring, the boss on its dais to the north, pillars in pairs outside the ring, a font by the way
 *               in: where everything is asked for at once
 *
 *   composeFight(needs, { kind? ('melee'), seed? (1) }) → { kind, size, half, primitives, anchors: { spawn, goal, foes,
 *       ways: [{ id, side, at, back }], rifts: [{ id, at, spots }], ring: { at, r }, boss? }, reserves: { ring, runUp? },
 *       answers: [ask ids], headroom: null, work: null, seed }
 *     the room's shape (compose.js) and more: `ways` the ways a fight seals (`back`: where a walker is put back from one),
 *     `rifts` where waves come in, `reserves` the floor kept clear, `answers` which of the kit's asks it answers,
 *     `headroom` the height over the ring (null: open above, as the practice room is)
 *
 * Pure, seeded.
 */
import { PRIMITIVES, footprint } from './primitives.js';
import { streamOf } from '../city/plan/dice.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const GAP = 1;
const even = (v) => 2 * Math.ceil(v / 2);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const FIGHT_KINDS = Object.freeze({
  duel: { about: 'one foe in a small ring, cover off each flank', teaches: 'the string, on one foe that stands and comes back', answers: ['ring', 'air', 'lock'], waves: [{ grunt: 1 }] },
  melee: { about: 'the ring at the centre, rifts round its far side, urns at the walls, a font by the way on', teaches: 'the string and the launcher on a pack, wave after wave', answers: ['ring', 'air', 'lock'], waves: [{ grunt: 3 }, { grunt: 3, elite: 1 }] },
  gallery: { about: 'shooters on perches down both flanks, a deck short of the first, a run-up down the spine', teaches: 'the sidearm on a shooter out of reach, the dashing blow down a lane, the air to a perch', answers: ['ring', 'air', 'run-up', 'perch', 'gap', 'lock'], waves: [{ grunt: 1, shooter: 1 }, { grunt: 2, shooter: 2 }] },
  boss: { about: 'the widest ring, the boss on its dais, pillars in pairs outside the ring', teaches: 'everything at once, on one that does not fall to a string', answers: ['ring', 'air', 'lock'], waves: [{ boss: 1 }] },
});
export const FIGHT_KIND_IDS = Object.freeze(Object.keys(FIGHT_KINDS));

const boxOf = (at, r) => ({ x: [at[0] - r, at[0] + r], y: [at[1] - r, at[1] + r] });
const overlaps = (a, b, gap) => a.x[0] - gap < b.x[1] && b.x[0] - gap < a.x[1] && a.y[0] - gap < b.y[1] && b.y[0] - gap < a.y[1];
/** Whether a plan box comes within a circle. */
export const inCircle = (f, c, r) => Math.hypot(Math.max(f.x[0] - c[0], 0, c[0] - f.x[1]), Math.max(f.y[0] - c[1], 0, c[1] - f.y[1])) < r;

export function composeFight(needs, { kind = 'melee', seed = 1 } = {}) {
  const K = FIGHT_KINDS[kind];
  if (!K) throw new Error(`game room: no fight '${kind}' (${FIGHT_KIND_IDS.join(', ')})`);
  const dice = streamOf(seed, 'gameroom', 'fight', kind);
  const asks = needs.asks ?? {}, R0 = asks.ring?.r ?? 3.5, jump = needs.jump ?? 0.9;
  const R = kind === 'duel' ? Math.min(R0, 3.5) : kind === 'boss' ? clamp(R0 + 1.5, 4, 8) : kind === 'gallery' ? Math.min(R0, 3) : R0;
  const runUp = kind === 'gallery' ? { length: asks['run-up']?.length ?? 5, width: asks['run-up']?.width ?? 1.8 } : null;
  const size = kind === 'duel' ? Math.max(14, even(2 * (R + 4))) : kind === 'gallery' ? Math.max(20, even(needs.size ?? 20), even((runUp.length + 2 * R + 11))) : even(2 * (R + (kind === 'boss' ? 8 : 7)));
  const half = size / 2;
  const spawn = [0, r3(-half + 2), 0], goal = [0, r3(half - 2), 0];
  const ways = [{ id: 'back', side: 's', at: [0, -half, 0], back: spawn.slice() }, { id: 'on', side: 'n', at: [0, half, 0], back: [0, r3(half - 4.2), 0] }];
  const prims = [], taken = [boxOf(spawn, 1.2), boxOf(goal, 1.2)], keep = [];
  const place = (p) => {
    const f = footprint(p);
    if (f.x[0] < -half + GAP || f.x[1] > half - GAP || f.y[0] < -half + GAP || f.y[1] > half - GAP) return false;
    if (taken.some((t) => overlaps(f, t, PRIMITIVES[p.kind].mark ? 0 : GAP))) return false;
    if (keep.some((k) => (k.r ? inCircle(f, k.at, k.r) : overlaps(f, k, 0)))) return false;
    taken.push(f); prims.push(p); return true;
  };
  const pair = (kindOf, id, x, y, extra = {}) => {
    const a = { kind: kindOf, id: `${id}a`, at: [r3(x), r3(y), 0], rot: 0, ...extra }, b = { ...a, id: `${id}b`, at: [r3(-x), r3(y), 0] };
    if (!place(a)) return 0;
    if (!place(b)) { prims.pop(); taken.pop(); return 0; }
    return 2;
  };
  const turn = () => (dice() < 0.5 ? 0 : 90);
  let ring, rifts = [], foes = [], boss = null;
  const rift = (id, at, n) => {
    const p = { kind: 'rift', id, at: [r3(at[0]), r3(at[1]), 0], rot: 0 };
    if (!place(p)) return;
    // its spots round it, the nearest the ring first
    const toRing = Math.atan2(ring.at[1] - at[1], ring.at[0] - at[0]);
    const spots = Array.from({ length: n }, (_, k) => { const a = toRing + (k * 2 * Math.PI) / n; return [r3(at[0] + 1.1 * Math.cos(a)), r3(at[1] + 1.1 * Math.sin(a)), 0]; });
    rifts.push({ id, at: p.at.slice(), spots });
  };

  if (kind === 'duel') {
    ring = { at: [0, 0, 0], r: R }; keep.push(ring);
    pair('cover-low', 'cover-1', R + 1.5, 0, { rot: 90 });
    foes = [[0, 1.5, 0]];
  } else if (kind === 'melee') {
    ring = { at: [0, 0, 0], r: R }; keep.push(ring);
    const d = R + 2.4, turnBy = (dice() - 0.5) * 0.2;
    [0.22, 0.5, 0.78].forEach((t, k) => { const a = Math.PI * t + (k === 1 ? 0 : turnBy * (k ? -1 : 1)); rift(`rift-${k + 1}`, [d * Math.cos(a), d * Math.sin(a)], 3); });
    pair('pillar', 'pillar-1', R + 1.5, -R * 0.55);
    pair('urn', 'urn-1', half - 1.5, -half / 2);
    pair('urn', 'urn-2', half - 1.5, half / 2);
    place({ kind: 'font', id: 'font', at: [r3(half - 2.4), r3(half - 2.4), 0], rot: 0 });
    foes = rifts.map((q) => q.spots[0]);
  } else if (kind === 'gallery') {
    const y0 = spawn[1] + 1.6;
    keep.push({ x: [-runUp.width / 2, runUp.width / 2], y: [y0, y0 + runUp.length] });
    ring = { at: [0, r3(y0 + runUp.length + R + 0.5), 0], r: R }; keep.push(ring);
    const h = asks.perch?.h ?? Math.max(2.4, jump + 0.9), x = half - 2, gap = asks.gap?.span ?? null;
    const y1 = r3(-half / 6), y2 = r3(half / 2.4);
    const perches = [];
    if (pair('perch', 'perch-1', x, y1, { h })) perches.push([x, y1], [-x, y1]);
    if (pair('perch', 'perch-2', x, y2, { h })) perches.push([x, y2], [-x, y2]);
    // a deck an air dash short of the first perch, its step toward the spawn: the air's way up to a shooter
    if (gap && perches.length) pair('platform', 'deck-1', x, y1 - (0.8 + gap + 1.5), { h: needs.lift ?? 1.2 });
    pair('cover-low', 'cover-1', half / 2.6, r3(y0 + runUp.length / 2), { rot: turn() });
    rift('rift-1', [0, Math.min(half - 4.6, ring.at[1] + R + 1.8)], 3);
    foes = [...perches.map(([px, py]) => [r3(px), r3(py), h]), [0, r3(y0 + runUp.length - 0.6), 0]];
  } else {
    ring = { at: [0, -1, 0], r: R }; keep.push(ring);
    const dais = { kind: 'dais', id: 'dais', at: [0, r3(half - 6.5), 0], rot: 0 };
    if (place(dais)) boss = [0, dais.at[1], PRIMITIVES.dais.h];
    pair('pillar', 'pillar-1', R + 1.3, -1 - R * 0.5);
    pair('pillar', 'pillar-2', R + 1.3, -1 + R * 0.5);
    pair('urn', 'urn-1', half - 1.5, half / 3);
    place({ kind: 'font', id: 'font', at: [r3(-(half - 2.4)), r3(-half + 2.6), 0], rot: 0 });
    foes = boss ? [boss] : [[0, r3(half - 6.5), 0]];
  }
  const answers = K.answers.filter((a) => asks[a] !== undefined);
  return {
    kind, size, half, primitives: prims,
    anchors: { spawn, goal, foes, ways, rifts, ring: { at: ring.at.slice(), r: ring.r }, ...(boss ? { boss } : {}) },
    reserves: { ring: { at: ring.at.slice(), r: ring.r }, ...(runUp ? { runUp: { x: keep[0].x.map(r3), y: keep[0].y.map(r3) } } : {}) },
    answers, headroom: null, work: null, seed,
  };
}
