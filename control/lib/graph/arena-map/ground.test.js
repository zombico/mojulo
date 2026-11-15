// THE ARENA MAP LAID AS GROUND (ground.js): one small map that has every block, played on the runtime a page ships
// (game/level-sim.js, the platform rule a mission's body walks on). The concepts: a ramp is walked up to the floor above
// and back down; an open edge is dropped off and landed from; a wall and a rail stop a body; a slab is walked under and
// not passed through from below by the body's own jump; a ladder is the runtime's climb, from its foot to its ledge; and
// what the map is laid as is the map (every block has its pieces, a template laid whole).
import { describe, expect, it } from 'vitest';
import { mapGround, mapPoint, MAP_GREY } from './ground.js';
import { blank, seal, TEMPLATES, TEMPLATE_IDS } from './templates.js';
import { indexMap } from './map.js';
import { CELL, RISE, SLAB, LOW } from './blocks.js';
import { simLevel } from '../game/level-sim.js';
import { faceGround, pageGroundFaces, SIM_DT } from '../game/level-equivalence.js';
import { feelRule } from '../gameworld/feel/lower.js';
import { TEMPLATE_LOADOUTS } from '../gameworld/loadout.js';
import { POLES } from '../gameworld/feel/cards.js';

// a feel that shoots (the mission's own body: the platform rule its card is lowered onto, at the eye)
const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const EYE = 1.6;
const RULE = { type: 'platform', speed: 4.5, walkSpeed: 1.6, turn: 2.4, eye: EYE, step: 0.3, ...feelRule(SHOOTER), turnMode: 'look', lookPitch: true, strafe: 1, collideRadius: 0.3, collideHeight: 1.7 };

// the ground 6 by 4, an upper floor over its two east columns; a ramp and a ladder up to it, a rail and a drop on it
function small() {
  const M = blank(6, 4, 2);
  for (let i = 4; i <= 5; i++) for (let j = 0; j <= 3; j++) M.floors.push([i, j, 1]);
  M.ramps.push({ at: [2, 1, 0], dir: [1, 0], run: 2 });
  M.ladders.push({ at: [3, 0, 0], dir: [1, 0] });
  M.walls.push({ at: [3, 2, 1], side: 'e', kind: 'low' }, { at: [0, 2, 0], side: 'e', kind: 'full' });
  return seal(M);
}
const M = small(), G = mapGround(M);
function walk(cell, heading, seconds, input = { forward: 1 }) {
  const p = mapPoint(cell);
  const sim = simLevel({ entities: [{ id: 'player', pilotable: true, rule: RULE, body: { type: 'none' }, transform: { pos: [p[0], p[1], p[2] + EYE], heading } }, ...G.entities], events: {}, colliders: G.colliders }, { ground: faceGround(pageGroundFaces(G.faces)) });
  const me = sim.world.byId.player;
  let top = -Infinity;
  for (let t = 0; t < seconds; t += SIM_DT) {
    for (const [k, v] of Object.entries(input)) sim.input[k] = typeof v === 'function' ? v(t) : v;
    sim.frame(SIM_DT);
    top = Math.max(top, me.transform.pos[2] - EYE);
  }
  const at = me.transform.pos;
  return { x: at[0], y: at[1], foot: at[2] - EYE, top, climbed: me.climbed ?? null };
}
const E = 0.05, W = Math.PI, N = Math.PI / 2;

describe('a map laid as ground, walked on the runtime', () => {
  it('is the map the laws read: its ways sound as built', () => {
    const I = indexMap(M);
    expect(I.connectors.every((c) => !c.faults.length)).toBe(true);
    expect(I.dropFaults).toEqual([]);
  });
  it('a ramp is walked up to the floor above, and back down', () => {
    const up = walk([1, 1, 0], 0, 3);
    expect(up.foot).toBeCloseTo(RISE, 2);
    expect(up.x).toBeGreaterThan(4 * CELL);
    const down = walk([4, 1, 1], W, 3);
    expect(down.foot).toBeCloseTo(0, 2);
    expect(down.x).toBeLessThan(2 * CELL);
  });
  it('an open edge is dropped off and landed from', () => {
    const R = walk([4, 3, 1], W, 2);
    expect(R.foot).toBeCloseTo(0, 2);
    expect(R.x).toBeLessThan(4 * CELL);
  });
  it('a wall stops a body on the ground, and a rail one on the floor above', () => {
    const wall = walk([0, 2, 0], 0, 2), rail = walk([4, 2, 1], W, 2);
    expect(wall.x).toBeLessThan(CELL - 0.1 + E);
    expect(rail.x).toBeGreaterThan(4 * CELL + 0.1 - E);
    expect(rail.foot).toBeCloseTo(RISE, 2);
  });
  it('a ramp\'s side stops a body beside it', () => {
    const R = walk([2, 0, 0], N, 2);
    expect(R.y).toBeLessThan(CELL);
    expect(R.foot).toBeCloseTo(0, 2);
  });
  it('a slab is walked under, and the body\'s own jump does not pass it from below', () => {
    const R = walk([5, 1, 0], N, 3, { forward: 1, jump: (t) => Math.floor(t * 4) % 2 });
    expect(R.top).toBeLessThan(RISE - SLAB - RULE.collideHeight);
    expect(R.foot).toBeLessThan(1);
  });
  it('a ladder is the runtime\'s climb: walked into at its foot, mounted at its ledge', () => {
    expect(G.entities.map((e) => e.rule.type)).toEqual(['climbable']);
    const R = walk([3, 0, 0], 0, 4);
    expect(R.climbed).toMatchObject({ end: 'top' });
    expect(R.foot).toBeCloseTo(RISE, 2);
    // (it stands in its foot cell: the climb's line inside it, against the ledge's edge)
    const L = G.entities[0].rule, x = L.base[0] + L.N[0] * L.standoff;
    expect(x).toBeGreaterThan(3 * CELL);
    expect(x).toBeLessThan(4 * CELL);
  });
  it('a ladder is climbed by standing at its foot and holding jump: up while it is held, hung when it is let go', () => {
    expect(G.entities[0].rule.hold).toBe(true);
    // (stood in its foot cell with its back to it, no step forward: the key alone)
    const up = walk([3, 0, 0], W, 4, { jumpHeld: 1 });
    expect(up.climbed).toMatchObject({ end: 'top' });
    expect(up.foot).toBeCloseTo(RISE, 2);
    // let go half way: it hangs there, neither fallen nor mounted
    const hung = walk([3, 0, 0], W, 4, { jumpHeld: (t) => (t < 0.8 ? 1 : 0) });
    expect(hung.climbed).toBeNull();
    expect(hung.foot).toBeGreaterThan(0.5);
    expect(hung.foot).toBeLessThan(RISE - 0.5);
    // and a body nowhere near it only jumps
    const far = walk([0, 2, 0], 0, 1.5, { jumpHeld: 1 });
    expect(far.foot).toBeLessThan(1);
  });
  it('every block has its pieces, in the greybox values; and a template is laid whole', () => {
    const groups = new Set(G.faces.map((f) => f.group));
    for (const g of ['map:floor:0', 'map:floor:1', 'map:under', 'map:wall', 'map:low-wall', 'map:ramp', 'map:ladder']) expect(groups.has(g)).toBe(true);
    expect(G.faces.every((f) => f.corners.length >= 3 && typeof f.fill === 'string')).toBe(true);
    const low = G.colliders.filter((c) => Math.abs(c.max[2] - c.min[2] - LOW) < 1e-6);
    expect(low.length).toBe(1);
    expect(MAP_GREY.wall).toMatch(/^#/);
    // (the smallest template, chosen in code: its floors, walls and ways each laid)
    const id = TEMPLATE_IDS.reduce((a, b) => { const A = TEMPLATES[a].build(), B = TEMPLATES[b].build(); return A.nx * A.ny * A.nz <= B.nx * B.ny * B.nz ? a : b; });
    const T = TEMPLATES[id].build(), L = mapGround(T, { at: [10, 0, 0] });
    expect(L.entities.length).toBe(T.ladders.length);
    expect(L.colliders.length).toBeGreaterThanOrEqual(T.walls.length + (T.solids?.length ?? 0) + T.floors.filter((c) => c[2] > 0).length);
    expect(Math.min(...L.faces.flatMap((f) => f.corners.map((c) => c[0])))).toBeGreaterThanOrEqual(10 - 0.1 - E);
  });
});
