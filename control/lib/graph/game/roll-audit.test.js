import { describe, expect, it } from 'vitest';
import { rollAudit, navWin, referenceRoute, ROLL_LAWS } from './roll-audit.js';
import { readRoll, rolledIds, pickupsOf } from './roll.js';
import { rollOf } from './level-sim.js';
import { synthesizeLevel } from './level-synth.js';
import { standBlocks } from '../playscape/terrain.js';
import { rolledPlan, rollReports } from '@/lib/mcp/tools/create-game';

// THE SEEDS AUDIT: a level with a roll is many maps; a sample of its seeds is walked in Node. One small flat level: a
// yard walled round, the hero at one end, the exit at the other, walls across the middle that leave a gap or do not.
const YARD = [{ min: [-6, 8, 0], max: [41, 9, 3] }, { min: [-6, -9, 0], max: [41, -8, 3] }, { min: [-6, -9, 0], max: [-5, 9, 3] }, { min: [40, -9, 0], max: [41, 9, 3] }];
const hero = (body = true) => ({ id: 'hero', pilotable: true, rule: { type: 'walk', speed: 5, turn: 3, eye: 1.7, ...(body ? { collideRadius: 0.3, collideHeight: 1.7, step: 0.3 } : {}) }, body: { type: 'none' }, transform: { pos: [0, 0, 1.7], heading: 0 } });
// two half walls (each leaves the other half of the yard open) and a third that, with both, would shut it
const HALVES = [
  { id: 'north', form: 'wall', at: [15, 4, 0], N: [-1, 0], length: 8, height: 2, thick: 0.5 },
  { id: 'south', form: 'wall', at: [15, -4, 0], N: [-1, 0], length: 8, height: 2, thick: 0.5 },
  { id: 'far', form: 'wall', at: [28, 3, 0], N: [-1, 0], length: 9, height: 2, thick: 0.5 },
];
function level(blocks, roll, { body = true } = {}) {
  const read = readRoll(roll, { blocks }), B = standBlocks(blocks, { rolled: rolledIds(read) });
  const manifest = { entities: [hero(body)], game: { levelRef: 'yard', mechanics: [{ kind: 'reach-exit', at: [35, 0, 0], radius: 2 }] } };
  const { game, mechEvents } = synthesizeLevel(manifest);
  return { entities: manifest.entities, events: mechEvents, game, colliders: [...YARD, ...B.colliders], faces: [], roll: { cover: read.cover, things: B.things } };
}
// one of the two halves stands, and the far wall may: the yard is never shut
const OPEN = { cover: [{ of: ['north', 'south'], stand: 1 }, { of: ['far'], stand: [0, 1] }] };
// both halves may stand together: then the yard is shut
const SHUT = { cover: [{ of: ['north', 'south'], stand: [1, 2] }] };

describe('the seeds audit', () => {
  it('a level whose every roll leaves a way: each law holds, and it says how many seeds it walked', () => {
    const A = rollAudit(level(HALVES, OPEN), { seeds: 12, plays: 2 });
    expect(A.laws.map((l) => l.law)).toEqual([...ROLL_LAWS]);
    expect(A.laws.filter((l) => !l.holds)).toEqual([]);
    expect(A.ok).toBe(true);
    expect(A.seeds).toBe(12);
    expect(A.ways).toBe(4);
    expect(A.distinct).toBe(4);
    expect(A.laws.find((l) => l.law === 'way-through').says).toBe('the way is open on all 12 seeds walked');
    expect(A.laws.find((l) => l.law === 'apart').says).toBe('4 different rolls in 12 seeds, of 4 there are');
    expect(A.played.map((p) => p.outcome)).toEqual(['success', 'success']);
    expect(A.played[0].seed).toBe(1);
  });

  it('a roll that can shut the way is found, by seed, and said; nothing is refused', () => {
    const P = level(HALVES, SHUT), A = rollAudit(P, { seeds: 12, plays: 1 });
    const shut = Array.from({ length: 12 }, (_, k) => k + 1).filter((s) => rollOf(P.roll, s).stand.length === 2);
    expect(shut.length).toBeGreaterThan(0);
    expect(A.ok).toBe(false);
    expect(A.laws.find((l) => l.law === 'way-through').holds).toBe(false);
    expect([...new Set(A.failed.filter((f) => f.law === 'way-through').map((f) => f.seed))]).toEqual(shut);
    expect(A.failed[0].says).toMatch(/no way from \[0, 0\] to \[35, 0\]/);
  });

  it('a pilot with no body: said, since no cover stops it and every roll plays alike', () => {
    const A = rollAudit(level(HALVES, OPEN, { body: false }), { seeds: 4, plays: 1 });
    expect(A.laws.find((l) => l.law === 'body')).toMatchObject({ holds: false, says: expect.stringMatching(/no collide radius/) });
  });

  it('a played seed is led round what its roll stands, to the level\'s own end', () => {
    const P = level(HALVES, OPEN);
    for (const seed of [1, 2]) expect(navWin(P, { seed, seconds: 60 })).toMatchObject({ outcome: 'success' });
    // a shut seed: played, it ends nowhere
    const S = level(HALVES, SHUT), shut = Array.from({ length: 20 }, (_, k) => k + 1).find((s) => rollOf(S.roll, s).stand.length === 2);
    expect(navWin(S, { seed: shut, seconds: 20 }).outcome).toBeNull();
  });
});

describe('the audit follows the items and the start', () => {
  // the yard shut by both halves standing (never rolled away), two pickups beyond them, two starts: one each side
  const WALLS = [{ ...HALVES[0], id: 'n' }, { ...HALVES[1], id: 's' }, { id: 'loose', form: 'crate', at: [30, 6, 0] }];
  const beyond = (roll, mechanics) => {
    const blocks = WALLS, read = readRoll(roll, { blocks, pickups: pickupsOf(mechanics) }), B = standBlocks(blocks, { rolled: rolledIds(read) });
    const manifest = { entities: [hero()], game: { levelRef: 'yard', mechanics } };
    const { game, mechEvents } = synthesizeLevel(manifest);
    return { entities: manifest.entities, events: mechEvents, game, colliders: [...YARD, ...B.colliders], faces: [], roll: { ...(read.cover ? { cover: read.cover, things: B.things } : {}), ...(read.items ? { items: read.items } : {}), ...(read.start ? { start: read.start } : {}) } };
  };
  const EXIT = { kind: 'reach-exit', at: [35, 0, 0], radius: 2 };

  it('a start the far side of a shut wall: only the seeds that start the near side are shut', () => {
    const P = beyond({ start: [{ pos: [0, 0, 1.7] }, { pos: [25, 0, 1.7] }] }, [EXIT]);
    const A = rollAudit(P, { seeds: 10, plays: 0 }), near = Array.from({ length: 10 }, (_, k) => k + 1).filter((s) => rollOf(P.roll, s).start === 0);
    expect(near.length).toBeGreaterThan(0);
    expect(near.length).toBeLessThan(10);
    expect([...new Set(A.failed.map((f) => f.seed))]).toEqual(near);
    expect(A.distinct).toBe(2);
  });

  it('a pickup the seed left out is not asked a way to', () => {
    // one pickup this side of the wall, one beyond it: of the two, one lies
    const mechanics = [{ kind: 'collect', into: 'bag', pickups: [{ id: 'near', item: 'gem', at: [5, 0, 0] }, { id: 'far', item: 'gem', at: [30, 0, 0] }] }, { kind: 'bag', slice: 'bag' }, { kind: 'reach-exit', at: [8, 0, 0], radius: 1 }];
    const P = beyond({ items: [{ of: ['near', 'far'], lay: 1 }] }, mechanics);
    const A = rollAudit(P, { seeds: 10, plays: 0 }), far = Array.from({ length: 10 }, (_, k) => k + 1).filter((s) => rollOf(P.roll, s).lay[0] === 'pk_0_1');
    expect([...new Set(A.failed.map((f) => f.seed))]).toEqual(far);
    expect(A.failed.every((f) => /no way to the pickup at \[30, 0\]/.test(f.says))).toBe(true);
  });
});

describe('the reference roll\'s route', () => {
  it('the walk a straight-legged walker takes round what seed 1 stands, ending at the exit', () => {
    const P = level(HALVES, OPEN), route = referenceRoute(P), stands = rollOf(P.roll, 1).stand;
    expect(route.at(-1)).toEqual([35, 0]);
    expect(route.length).toBeGreaterThan(1);
    // every straight leg of it clears every wall that stands, by the body's width (sampled along the leg)
    const boxes = stands.map((id) => P.roll.things[id]), pts = [[0, 0], ...route];
    for (let k = 0; k + 1 < pts.length; k++) {
      for (let u = 0; u <= 1; u += 0.01) {
        const x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u;
        for (const b of boxes) expect(x > b.min[0] - 0.3 && x < b.max[0] + 0.3 && y > b.min[1] - 0.3 && y < b.max[1] + 0.3, `leg ${k} at [${x.toFixed(1)}, ${y.toFixed(1)}]`).toBe(false);
      }
    }
    // and it is not the straight walk: seed 1 stands a wall across it
    expect(stands.length).toBeGreaterThan(0);
    expect(referenceRoute({ ...P, roll: null })).toBeNull();
  });

  it('a level\'s one-leg audit plan is led round its reference roll; any other plan is as it was', async () => {
    const P = level(HALVES, OPEN), payloadOf = async () => P;
    const plan = { motion: 'traversal', fps: 12, waypoints: [[35, 0]], expect: 'success' };
    const led = await rolledPlan('yard', plan, { payloadOf });
    expect(led.waypoints).toEqual(referenceRoute(P));
    expect({ ...led, waypoints: plan.waypoints }).toEqual(plan);
    // a level with no roll, a plan with a route of its own, an idle plan
    expect(await rolledPlan('yard', plan, { payloadOf: async () => null })).toBe(plan);
    const routed = { ...plan, waypoints: [[5, 5], [35, 0]] };
    expect(await rolledPlan('yard', routed, { payloadOf })).toBe(routed);
    const idle = { motion: 'traversal', ticks: 40 };
    expect(await rolledPlan('yard', idle, { payloadOf })).toBe(idle);
  });
});

describe('the game\'s readout', () => {
  it('each level that rolls is reported with its gate said; a level with no roll is not', async () => {
    const P = level(HALVES, SHUT), payloadOf = async (ref) => (ref === 'yard' ? P : null);
    const R = await rollReports(['plain', 'yard'], { payloadOf, seeds: 8, plays: 1 });
    expect(R.map((r) => r.ref)).toEqual(['yard']);
    expect(R[0]).toMatchObject({ seeds: 8, ways: 3, ok: false });
    expect(R[0].gate).toMatch(/^machine: .*eyes gate$/);
    expect(R[0].failed.length).toBeGreaterThan(0);
    expect(await rollReports(['plain'], { payloadOf })).toEqual([]);
  });
});
