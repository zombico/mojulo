// storeys — a room-kit stage on more than one floor. The laws: a stage without `storey` is the stage as it was; each
// storey stands over the storey below, its floor over the tallest room it stands over and a slab; a room with a room
// over it has a flat ceiling; a link across two storeys is a stair, its flight in the lower room clear of every
// doorway, its hole cut in the upper floor and railed (the head open); each storey is built and lifted to its floor,
// its ids tagged, its set piece only where the walk ends; the level climbs the stairs to a goal upstairs; and the
// programs that build upward (the tower, the keep) do so on every seed and kit.

import { describe, it, expect } from 'vitest';
import { planStage, assembleStageScene } from './stage.js';
import { planProgram, withProgram, programPlanSvg } from './programs.js';
import { storeyCut, stairColliders, SLAB, RISE } from './storeys.js';
import { stageLevel, withBuildingLevel } from '../structure/level.js';
import { stairProfile } from '../construction/circulation.js';

const KEEP2 = {
  kind: 'stage', kit: 'gothic-stone',
  rooms: [
    { id: 'base', x: 0, y: 0, w: 8, d: 8, h: 4 }, { id: 'stair', x: 8, y: 0, w: 7, d: 8, h: 4 }, { id: 'hall', x: -10, y: 0, w: 10, d: 8, h: 7 },
    { id: 'landing', x: 8, y: 0, w: 7, d: 8, h: 4, storey: 1 }, { id: 'guard', x: 0, y: 0, w: 8, d: 8, h: 4.5, storey: 1 },
  ],
  links: [{ from: 'hall', to: 'base' }, { from: 'base', to: 'stair' }, { from: 'stair', to: 'landing' }, { from: 'landing', to: 'guard' }],
};
const plan = planStage(KEEP2);
const scene = assembleStageScene(KEEP2, { unshaded: true });
const st = plan.stairs[0];
const inRect = (p, R, m = 0) => p[0] > R[0] + m && p[0] < R[2] - m && p[1] > R[1] + m && p[1] < R[3] - m;
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length);

describe('a stage on storeys', () => {
  it('a stage without storeys plans as it did: no storeys, stairs or cuts, and rooms without floors', () => {
    const p = planStage({ ...KEEP2, rooms: KEEP2.rooms.filter((r) => !r.storey), links: KEEP2.links.slice(0, 2) });
    for (const k of ['storeys', 'stairs', 'flat', 'cuts']) expect(p[k]).toBeUndefined();
    for (const r of p.rooms) for (const k of ['storey', 'z0', 'flat']) expect(r[k]).toBeUndefined();
  });

  it('stacks each storey over the tallest room it stands over, and flattens the ceilings under it', () => {
    // the guard and the landing stand over the base and the stair (4 m), not the hall (7 m): the floor at 4 + the slab
    expect(plan.storeys).toEqual([{ index: 0, z0: 0 }, { index: 1, z0: 4 + SLAB }]);
    expect([...plan.flat].sort()).toEqual(['base', 'stair']);
    expect(plan.rooms.find((r) => r.id === 'guard')).toMatchObject({ storey: 1, z0: 4.5 });
    // the links on one storey are doorways; the one across is the stair
    expect(plan.links.map((l) => `${l.from}-${l.to}`)).toEqual(['hall-base', 'base-stair', 'landing-guard']);
    expect(st).toMatchObject({ lower: 'stair', upper: 'landing', rise: 4.5, z0: 0, z1: 4.5 });
  });

  it('lays the flight in the lower room, under the upper, its treads no higher than a step, clear of the doorways', () => {
    const lo = plan.rooms.find((r) => r.id === 'stair');
    expect(st.rise / st.n).toBeLessThanOrEqual(RISE + 1e-9);
    expect(st.rect[0]).toBeGreaterThanOrEqual(lo.x0 + 0.6 - 1e-9); expect(st.rect[2]).toBeLessThanOrEqual(lo.x1 - 0.6 + 1e-9);
    expect(st.rect[1]).toBeGreaterThanOrEqual(lo.y0); expect(st.rect[3]).toBeLessThanOrEqual(lo.y1);
    // the stair room's doorway (to the base, on its -x wall) keeps its landing: no tread within a metre and a half of it
    const door = plan.links.find((l) => l.to === 'stair');
    const strip = [door.at, door.lo, door.at + 1.45, door.hi];
    expect(st.rect[0] >= strip[2] || st.rect[1] >= strip[3] || st.rect[3] <= strip[1]).toBe(true);
    // met on the lower floor, left on the upper
    expect(inRect(st.approach, [lo.x0, lo.y0, lo.x1, lo.y1])).toBe(true);
    expect(inRect(st.arrival, st.rect)).toBe(false);
  });

  it('builds each storey and lifts it to its floor: its rooms, anchors and colliders there, its ids tagged', () => {
    expect(scene.storeys.map((s) => s.z0)).toEqual([0, 4.5]);
    const guard = scene.rooms.find((r) => r.id === 'guard');
    expect(guard).toMatchObject({ storey: 1 }); expect(guard.box.min[2]).toBe(4.5);
    const ids = scene.anchors.map((a) => a.id);
    expect(ids.some((id) => id.endsWith('@1'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(scene.anchors.find((a) => a.kind === 'stair')).toMatchObject({ id: 'stair-stair-landing', between: ['stair', 'landing'], rise: 4.5, treads: st.n });
    expect(scene.colliders.filter((c) => c.of.startsWith('stair:')).length).toBe(2 * st.n + 1);
    expect(scene.colliders.filter((c) => c.of === 'rail:landing').length).toBe(3);
    // the upper storey's walls stand on its floor
    expect(scene.colliders.filter((c) => c.of.startsWith('wall:guard')).every((c) => c.min[2] >= 4.5)).toBe(true);
  });

  it('cuts the ceiling over the flight and the floor under the hole; the treads climb from floor to floor', () => {
    // (under the floor over it: the upper room's own vault stands over its hole)
    const over = scene.faces.filter((f) => inRect(mid(f), st.rect, 0.05) && mid(f)[2] < st.z1 + 0.5);
    // nothing over the flight but the treads and the stair's own faces
    expect(over.filter((f) => f.normal && f.normal[2] < -0.7).length).toBe(0);
    expect(over.filter((f) => f.normal && f.normal[2] > 0.7 && f.group !== 'stage:stair' && mid(f)[2] > 0.05).length).toBe(0);
    const treads = over.filter((f) => f.group === 'stage:stair' && f.normal[2] > 0.7).map((f) => mid(f)[2]);
    expect(Math.max(...treads)).toBeCloseTo(4.5, 5); expect(Math.min(...treads)).toBeCloseTo(4.5 / st.n, 5);
  });

  it('cuts a level face exactly, its pieces wound as it was and its uv carried', () => {
    const f = { corners: [[0, 0, 1], [4, 0, 1], [4, 4, 1], [0, 4, 1]], normal: [0, 0, 1], uv: [[0, 0], [2, 0], [2, 2], [0, 2]], group: 'g' };
    const out = storeyCut([f], { flights: [], holes: [{ rect: [1, 1, 2, 3] }] });
    expect(out).toHaveLength(1);   // a face at 1 m is not the floor a hole is cut in
    const cut = storeyCut([{ ...f, corners: f.corners.map((c) => [c[0], c[1], 0]) }], { flights: [], holes: [{ rect: [1, 1, 2, 3] }] });
    const area = (q) => Math.abs((q.corners[1][0] - q.corners[0][0]) * (q.corners[3][1] - q.corners[0][1]));
    expect(cut.reduce((a, q) => a + area(q), 0)).toBeCloseTo(16 - 2, 9);
    for (const q of cut) q.corners.forEach((c, i) => { expect(q.uv[i][0]).toBeCloseTo(c[0] / 2, 9); expect(q.uv[i][1]).toBeCloseTo(c[1] / 2, 9); });
  });

  it('stands its set piece only on the storey the walk ends on', () => {
    expect(scene.anchors.filter((a) => a.kind === 'set-piece').map((a) => a.storey)).toEqual([1]);
  });

  it('keeps a walker out from under a flight and out of a hole, never in its way up', () => {
    const C = stairColliders([st]);
    const rr = st.rise / st.n, mid0 = (st.lat[0] + st.lat[1]) / 2;
    // the flight's middle line is clear of every collider below the tread it is on
    for (let k = 0; k < st.n; k++) {
      const u = st.foot + st.dir * (k + 0.5) * 0.3, p = st.axis === 'y' ? [mid0, u] : [u, mid0], foot = (k + 1) * rr;
      expect(C.filter((c) => foot < c.max[2] - 0.35 && foot + 1.7 > c.min[2] && p[0] > c.min[0] - 0.3 && p[0] < c.max[0] + 0.3 && p[1] > c.min[1] - 0.3 && p[1] < c.max[1] + 0.3)).toEqual([]);
    }
  });

  it('says what is wrong', () => {
    const R = KEEP2.rooms;
    expect(() => planStage({ ...KEEP2, rooms: [...R, { id: 'out', x: 30, y: 0, w: 4, d: 4, h: 3, storey: 1 }] })).toThrow(/stands over nothing/);
    expect(() => planStage({ ...KEEP2, rooms: [...R, { id: 'up2', x: 8, y: 0, w: 7, d: 8, h: 4, storey: 2 }], links: [...KEEP2.links, { from: 'stair', to: 'up2' }] })).toThrow(/a stair climbs one storey/);
    // (a way out of an upper storey is a building set into its slope's: stage-buildings.js `embed`; a side with no
    // outside wall is still refused)
    expect(planStage({ ...KEEP2, ways: [{ room: 'guard', side: '-y' }] }).ways[0]).toMatchObject({ room: 'guard', side: '-y' });
    expect(() => planStage({ ...KEEP2, ways: [{ room: 'guard', side: 'up' }] })).toThrow(/needs side/);
    expect(() => planStage({ ...KEEP2, rooms: R.map((r) => (r.id === 'stair' || r.id === 'landing' ? { ...r, d: 4 } : r)) })).toThrow(/finds no wall to climb along/);
    expect(() => planStage({ ...KEEP2, rooms: [{ ...R[0], storey: 1.5 }] })).toThrow(/whole number/);
  });
});

describe('a level on storeys', () => {
  it('climbs the stair to its goal upstairs, the exit at that floor, its walker looking for ground over its feet', () => {
    const L = stageLevel(KEEP2, { goal: 'guard' });
    expect(L.goal).toMatchObject({ room: 'guard', storey: 1 }); expect(L.goal.at[2]).toBe(4.5);
    // the way: through the base, up the stair (approach, foot, head, arrival), into the guard room
    expect(L.route).toContainEqual(st.approach); expect(L.route).toContainEqual(st.arrival);
    expect(stageLevel(KEEP2, { goal: 'top' }).goal.room).toBe('guard');
    const m = withBuildingLevel({ ...KEEP2, level: { goal: 'guard' } }, 'lv');
    expect(m.game.mechanics[0].at[2]).toBeCloseTo(4.5 + 1.7, 9);
    expect(m.entities[0].rule.probe).toBeGreaterThan(0.35);
    // one storey: no probe (the walker casts from its eye, as it did)
    expect(withBuildingLevel({ ...KEEP2, rooms: KEEP2.rooms.filter((r) => !r.storey), links: KEEP2.links.slice(0, 2), level: {} }, 'lv').entities[0].rule.probe).toBeUndefined();
  });
});

describe('the programs that build upward', () => {
  it('the tower stands three storeys, each over the one below, one stair room over another; the keep two', () => {
    for (const kit of ['gothic-stone', 'catacomb', 'research-lab']) for (let seed = 1; seed <= 10; seed++) {
      const T = planProgram({ use: 'tower', seed }, kit), K = planProgram({ use: 'keep', seed }, kit);
      expect(T.findings, `tower ${kit} s${seed}`).toEqual([]);
      expect(Math.max(...T.rooms.map((r) => r.storey ?? 0))).toBe(2);
      expect(Math.max(...K.rooms.map((r) => r.storey ?? 0))).toBe(1);
      const by = new Map(T.rooms.map((r) => [r.id, r]));
      for (const [a, b] of [['stair', 'landing'], ['landing', 'top'], ['base', 'guard'], ['guard', 'lookout']]) expect([by.get(b).x, by.get(b).y, by.get(b).w, by.get(b).d]).toEqual([by.get(a).x, by.get(a).y, by.get(a).w, by.get(a).d]);
      // planned and levelled: the goal on the top storey, reached
      for (const use of ['tower', 'keep']) {
        const m = withProgram({ kind: 'stage', kit, program: { use, seed } });
        const L = stageLevel(m, { goal: m._program.goal });
        expect(L.error, `${use} ${kit} s${seed}`).toBeUndefined();
        expect(L.goal.storey).toBe(use === 'tower' ? 2 : 1);
      }
    }
  });

  it('draws each storey beside the one below', () => {
    const svg = programPlanSvg(planProgram({ use: 'tower', seed: 1 }, 'gothic-stone'));
    expect(svg).toContain('>ground<'); expect(svg).toContain('>storey 2<');
    expect(svg).toContain('stair ↑');
  });
});

describe('a building\'s stair: the game profile\'s switchback (construction/circulation.js)', () => {
  const G = stairProfile('game'), K = stairProfile('keep');
  // three storeys of a stair core with a room beside it: each core over the one below
  const core = (s) => ({ id: `core-${s}`, x: 0, y: 0, w: 10, d: 12, h: 3.5, ...(s ? { storey: s } : {}) });
  const wing = (s) => ({ id: `wing-${s}`, x: 10, y: 0, w: 8, d: 12, h: 3.5, ...(s ? { storey: s } : {}) });
  const TOWER = { kind: 'stage', kit: 'bay-everyday', stair: 'game', rooms: [0, 1, 2].flatMap((s) => [core(s), wing(s)]),
    links: [0, 1, 2].map((s) => ({ from: `core-${s}`, to: `wing-${s}` })).concat([{ from: 'core-0', to: 'core-1' }, { from: 'core-1', to: 'core-2' }]) };
  const P = planStage(TOWER), [s1, s2] = P.stairs;

  it('two flights side by side up to a half landing, its steps no higher than the profile\'s riser, room at its foot and head', () => {
    expect(s1.flights).toHaveLength(2);
    expect(s1.flights[0].n).toBe(s1.flights[1].n);
    expect(s1.landing.z).toBeCloseTo(s1.rise / 2, 5);
    expect(s1.rise / s1.n).toBeLessThanOrEqual(G.riser + 1e-9);
    // (the second flight climbs back the other way and ends where the first began)
    expect(s1.flights[1].dir).toBe(-s1.flights[0].dir);
    const A = s1.axis === 'y' ? 1 : 0, footEnd = s1.foot;
    expect(Math.abs(s1.approach[A] - footEnd)).toBeCloseTo(G.foot, 5);
    expect(Math.abs(s1.arrival[A] - footEnd)).toBeCloseTo(G.head, 5);
    // shallower than a keep's and with more room at both ends
    expect(G.riser / G.going).toBeLessThan(K.riser / K.going);
    expect(G.foot).toBeGreaterThan(K.foot); expect(G.head).toBeGreaterThan(K.head);
    // the walker climbs it by its route: up, across the landing, up again
    expect(s1.route.length).toBeGreaterThan(4);
  });

  it('a stair over a stair stacks in the one shaft: the same footprint, its flights slabs, the hole under it open to it', () => {
    expect(s2.rect).toEqual(s1.rect);
    expect(s2.stacked).toBe(true);
    expect(s1.through).toBe(true);
    expect(s2.through).toBeUndefined();
  });

  it('a keep\'s stair is laid as it always was: one straight flight, no profile fields on its record', () => {
    for (const k of ['flights', 'landing', 'route', 'exit', 'profile', 'going', 'guard']) expect(st[k], k).toBeUndefined();
    expect(() => planStage({ ...TOWER, stair: 'ladder' })).toThrow(/keep or game/);
  });
});
