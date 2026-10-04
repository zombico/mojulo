import { describe, it, expect } from 'vitest';
import { assembleStageScene, buildStageGeometry, planStage } from './stage.js';
import { stageDoors, stageItems } from './doors.js';
import { plazaPortico, plazaObelisks } from './piazza.js';
import { plazaSite } from './plaza-dress.js';
import { validateAtlas, emitAtlasShell } from './atlas.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { MSG_MAP_DOOR, MSG_MAP_ENTER, MSG_MAP_READY } from '../scene/channels/doors.js';

// a played map is a closed room: walls on every side (the open-sided SET is a framing for iterating on a look, not a
// level, and nothing here leans on its open sides)
const PLAZA = { kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12 }] };
const NAVE = { kind: 'stage', reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'nave', x: 0, y: 0, w: 12, d: 24, h: 13 }] };
const ATLAS = {
  title: 'the square and the church',
  maps: {
    plaza: { ...PLAZA, doors: [{ id: 'church', at: { house: 1, side: '-x' }, to: { map: 'nave', door: 'west' } }, { id: 'gate', at: { house: 2, side: '+x' }, to: { map: 'nave', door: 'vestry' } }],
      items: [{ id: 'key:vestry', at: [5.85, 13.6875] }] },
    nave: { ...NAVE, doors: [{ id: 'west', at: { portal: true }, to: { map: 'plaza', door: 'church' } }, { id: 'vestry', at: { side: '-y', u: 6 }, to: { map: 'plaza', door: 'gate' }, locked: 'key:vestry' }] },
  },
  start: { map: 'nave', door: 'west' },
};
const inBox = (p, b) => [0, 1, 2].every((k) => p[k] >= b.min[k] - 1e-9 && p[k] <= b.max[k] + 1e-9);

describe('door ends', () => {
  const { ends } = validateAtlas(ATLAS);
  const all = Object.entries(ends).flatMap(([map, list]) => list.map((e) => [map, e]));
  it('resolve from what the kit built: a plaza house door and the nave portal', () => {
    const plan = planStage(PLAZA), geom = buildStageGeometry(plan), h = geom.houses.filter((q) => q.F.N[0] === 1)[1];
    expect(ends.plaza[0].sill[1]).toBeCloseTo(h.F.o[1] + h.F.U[1] * h.door.mid, 5);
    const bay = buildStageGeometry(planStage(NAVE)).bays.find((b) => b.portal);
    expect(ends.nave[0].N).toEqual(bay.F.N.map((v) => v + 0));
  });
  it('a spawn stands inside its room, on floor, outside its trigger, facing away from the end', () => {
    for (const [map, e] of all) {
      const plan = planStage(ATLAS.maps[map]), r = plan.rooms[0];
      expect(e.spawn[0] > r.x0 && e.spawn[0] < r.x1 && e.spawn[1] > r.y0 && e.spawn[1] < r.y1).toBe(true);
      expect(inBox(e.spawn, e.trigger)).toBe(false);
      // a metre on along the facing takes you further from the end, never into the trigger
      const on = [e.spawn[0] + e.face[0], e.spawn[1] + e.face[1], e.spawn[2]];
      expect(inBox(on, e.trigger)).toBe(false);
      expect((on[0] - e.sill[0]) * e.N[0] + (on[1] - e.sill[1]) * e.N[1]).toBeGreaterThan((e.spawn[0] - e.sill[0]) * e.N[0] + (e.spawn[1] - e.sill[1]) * e.N[1]);
      // floor under the spawn: some upward face of the built map covers its x, y
      const floor = buildStageGeometry(plan).faces.filter((f) => f.normal[2] > 0.99 && f.corners.every((q) => q[2] < 0.5));
      const covers = (f) => { const xs = f.corners.map((q) => q[0]), ys = f.corners.map((q) => q[1]); return e.spawn[0] >= Math.min(...xs) && e.spawn[0] <= Math.max(...xs) && e.spawn[1] >= Math.min(...ys) && e.spawn[1] <= Math.max(...ys); };
      expect(floor.some(covers)).toBe(true);
      // walking back the way you came reaches the trigger before the wall
      const back = [e.spawn[0] - e.face[0] * 2, e.spawn[1] - e.face[1] * 2, 1];
      expect(inBox(back, e.trigger)).toBe(true);
    }
  });
  it('every door has two ends that name each other; a one-way or dangling end is refused', () => {
    expect(all.length).toBe(4);
    const dangling = structuredClone(ATLAS); dangling.maps.plaza.doors[0].to.door = 'east';
    expect(() => validateAtlas(dangling)).toThrow(/not an end/);
    const oneWay = structuredClone(ATLAS); oneWay.maps.nave.doors.push({ id: 'side', at: { side: '-x', u: 6 }, to: { map: 'plaza', door: 'church' } });
    const keyless = structuredClone(ATLAS); keyless.maps.plaza.items = [];
    expect(() => validateAtlas(keyless)).toThrow(/no map holds that item/);
    const twice = structuredClone(ATLAS); twice.maps.nave.items = [{ id: 'key:vestry', at: [6, 12] }];
    expect(() => validateAtlas(twice)).toThrow(/two maps/);
    expect(() => validateAtlas(oneWay)).toThrow(/name each other/);
    expect(() => validateAtlas({ ...ATLAS, start: { map: 'plaza', door: 'nope' } })).toThrow(/start/);
    expect(() => stageDoors(planStage(PLAZA), buildStageGeometry(planStage(PLAZA)), [{ id: 'x', at: { house: 9, side: '-x' }, to: { map: 'a', door: 'b' } }])).toThrow(/house 9/);
  });
  it('a recipe without doors carries none: no payload key, no page block', () => {
    const plain = assembleStageScene(PLAZA);
    expect('doors' in plain).toBe(false); expect('items' in plain).toBe(false);
    const box = [{ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], normal: [0, 0, 1], fill: '#888888' }];
    const without = emitThreeWorld({ faces: box, walk: { speed: 5, spawn: [2, 2, 1.7] } });
    expect(without).not.toContain('__DOORS');
    expect(emitThreeWorld({ faces: box, walk: { speed: 5, spawn: [2, 2, 1.7] }, doors: [] })).toBe(without);
    const withDoors = emitThreeWorld({ faces: box, walk: { speed: 5, spawn: [2, 2, 1.7] }, doors: ends.plaza });
    expect(withDoors).toContain('stepDoors(t);');
    expect(withDoors).toContain(MSG_MAP_DOOR); expect(withDoors).toContain(MSG_MAP_ENTER); expect(withDoors).toContain(MSG_MAP_READY);
    // doors ride the walk: no walk, no block
    expect(emitThreeWorld({ faces: box, doors: ends.plaza })).not.toContain('__DOORS');
  });
  it('a wall-point end on a closed wall gets a door: an oak leaf in a stone frame, in the middle of its bay', () => {
    const scene = assembleStageScene(ATLAS.maps.nave), leaf = scene.faces.filter((f) => f.group === 'stage:door' && f.texture === 'wood-oak');
    const vestry = ends.nave.find((e) => e.id === 'vestry');
    expect(leaf.some((f) => f.corners.every((q) => Math.abs(q[0] - vestry.sill[0]) < 1.2 && q[1] < 1))).toBe(true);
    expect(scene.doors.every((e) => !('build' in e))).toBe(true);   // the payload carries the end, not how it was built
    const bay = buildStageGeometry(planStage(NAVE)).bays.find((b) => b.F.N[1] === 1 && vestry.sill[0] >= Math.min(b.F.o[0] + b.F.U[0] * b.u0, b.F.o[0] + b.F.U[0] * b.u1) && vestry.sill[0] <= Math.max(b.F.o[0] + b.F.U[0] * b.u0, b.F.o[0] + b.F.U[0] * b.u1));
    if (bay) expect(vestry.sill[0]).toBeCloseTo(bay.F.o[0] + bay.F.U[0] * (bay.u0 + bay.u1) / 2, 5);
  });
  it('an item is a thing on a plinth in its own group, so the page can take it; a map entered again keeps it taken', () => {
    const scene = assembleStageScene(ATLAS.maps.plaza);
    expect(scene.items).toEqual([{ id: 'key:vestry', at: [5.85, 13.6875, 1.37], r: 1 }]);
    const key = scene.faces.filter((f) => f.group === 'item:key:vestry');
    expect(key.length).toBeGreaterThan(20);
    expect(key.every((f) => f.fill && !f.texture)).toBe(true);
    expect(scene.faces.some((f) => f.group === 'stage:plinth')).toBe(true);
    expect(() => stageItems(planStage(PLAZA), [{ id: 'k' }])).toThrow(/at: \[x, y\]/);
    const shell = emitAtlasShell({ maps: [{ id: 'plaza' }, { id: 'nave' }], ends, start: ATLAS.start });
    expect(shell).toContain('RUN.maps[RUN.map].taken.push(d.item)');
    expect(shell).toContain('state: RUN.maps[RUN.map]');
  });
  it('a closed square dresses as well as the open set: the portico clear of the side it meets, obelisks set from the door', () => {
    const plan = planStage(ATLAS.maps.plaza), site = plazaSite(plan), Po = plan.kit.dress.portico, portico = plazaPortico(plan, site);
    expect(site.closed.length).toBe(4);
    expect(portico.u0).toBe(Po.end);   // its start end stands clear of the houses on the side it meets
    const r = site.r, reach = portico.faces.flatMap((f) => f.corners).filter((q) => q[2] < 4);
    expect(Math.max(...reach.map((q) => q[0]))).toBeLessThanOrEqual(r.x1 - Po.end + 1e-6);
    const { spots } = plazaObelisks(plan, site, ends.plaza), way = ends.plaza[0].sill, c = site.c, v = [c[0] - way[0], c[1] - way[1]];
    const side = (p) => Math.sign(v[0] * (p[1] - way[1]) - v[1] * (p[0] - way[0]));
    expect(side(spots[0]) * side(spots[1])).toBe(-1);
    for (const p of spots) expect(p[0] > r.x0 + 2 && p[0] < r.x1 - 2 && p[1] > r.y0 + 2 && p[1] < r.y1 - Po.depth - 1).toBe(true);
  });
  it('the atlas page hosts one map at a time and links each end to its pair; deterministic', () => {
    const shell = () => emitAtlasShell({ title: ATLAS.title, maps: [{ id: 'plaza' }, { id: 'nave' }], ends, start: ATLAS.start });
    const html = shell();
    expect(html).toBe(shell());
    expect(html).toContain('"church":{"map":"nave","door":"west"}');
    expect(html).toContain('"vestry":{"map":"plaza","door":"gate","locked":"key:vestry"}');
    expect(html).toContain('maps/nave.html');
    expect(html).not.toMatch(/Math\.random|Date\.now/);
  });
});
