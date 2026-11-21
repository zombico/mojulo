// A MISSION IN A BUILDING (mission-building.js; world.js reads it, levels.js lays it): the firing range's rules, the
// building's rooms the ground. One world a procedure (a feel template whose loadout is guns alone), one core building (the
// one its kit's longest band picks, MISSION_BUILDINGS, chosen in code). The concepts: the reader takes the building form
// with a mission beside it and refuses what a building cannot hold; every place the phases name stands in a real room on
// its floor, clear of the walls, the stairs and the stock; the level carries the mission's cast, tasks, page and a gen-7
// cube whose bones are the building's kit; its tasks are proved on the bus; a building level with no mission is as it was.
// (The page resolved, the form render read and the gunner's play: mission-building.live.test.js, the e2e tier.)
import { describe, expect, it } from 'vitest';
import { readGameworld, resolveLevel } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { proveMission } from './mission-proof.js';
import { buildingMissionPlan, missionBuildingFor, MISSION_BUILDINGS, realOf, gridOf } from './mission-building.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { planOf } from '../arena-map/read-geocube.js';
import { stageColliders } from '../era/anchors.js';
import { stairColliders } from '../era/storeys.js';
import { PROGRAMS } from '../era/programs.js';
import { CELL, RISE } from '../arena-map/blocks.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const USE = missionBuildingFor({ id: 'k', feel: SHOOTER }).use;
const world = (level, extra = {}) => ({ id: 'mb', name: 'MB', seed: 3, feel: SHOOTER, start: 'one', ...extra, levels: { one: { name: 'Inside', ...level } } });

describe('a mission in a building: the reader', () => {
  it('takes the building form with a mission beside it, its fight true where it names none and false kept', () => {
    const G = readGameworld(world({ building: { use: USE }, mission: true }));
    const R = resolveLevel(G, 'one');
    expect(R.building).toMatchObject({ use: USE, fight: true });
    expect(R.mission).toMatchObject({ spec: {} });
    expect(resolveLevel(readGameworld(world({ building: { use: USE, fight: false }, mission: { foes: 2 } })), 'one')).toMatchObject({ building: { fight: false }, mission: { spec: { foes: 2 } } });
  });
  it('refuses a map, sections, a goal or foes of its own, a complex and a building by ref, each with what to do', () => {
    expect(() => readGameworld(world({ building: { use: USE }, mission: { map: true } }))).toThrow(/the building is the map.*drop map/);
    expect(() => readGameworld(world({ building: { use: USE }, mission: { sections: ['staging', 'contact', 'extract'] } }))).toThrow(/drop sections/);
    expect(() => readGameworld(world({ building: { use: USE }, mission: true, foes: { count: 2 } }))).toThrow(/no foes beside them/);
    expect(() => readGameworld(world({ building: { ref: 'x' }, mission: true }))).toThrow(/not in a building by ref/);
    expect(() => readGameworld({ id: 'n', name: 'N', start: 'one', levels: { one: { building: { use: USE }, mission: true } } })).toThrow(/carries none/);
  });
  it('proposes a core building for each band, a row of a closed table', () => {
    expect(Object.keys(MISSION_BUILDINGS)).toEqual(['close', 'mid', 'long']);
    for (const row of Object.values(MISSION_BUILDINGS)) expect(PROGRAMS[row.use]?.shape).toBe('core');
    expect(missionBuildingFor({ id: 'none' })).toBeNull();
  });
});

describe('a mission in a building: the level', () => {
  const W = world({ building: { use: USE }, mission: true }), G = readGameworld(W), st = gameStages(W)[0], P = st.mission, M = P.mission;
  it('stands every place in a real room on its floor, clear of the walls, the stairs and the stock', () => {
    expect(M.on).toBe('building');
    const plan = planOf(st.manifest), floors = plan.storeys?.map((s) => s.z0) ?? [0], t = plan.kit.wall / 2;
    const cols = [...floors.flatMap((z0, s) => stageColliders({ ...plan, rooms: plan.rooms.filter((r) => (r.storey ?? 0) === s) }, {}, []).map((c) => ({ min: [c.min[0], c.min[1], c.min[2] + z0], max: [c.max[0], c.max[1], c.max[2] + z0] }))), ...stairColliders(plan.stairs ?? [])];
    const places = M.sections.flatMap((S) => [...S.foes.map((f) => f.at), ...S.drops.map((d) => d.at), ...(S.task.kind === 'take' || S.task.kind === 'reach' ? [S.task.at] : [])]);
    expect(places.length).toBeGreaterThan(5);
    for (const p of places) {
      // (on a storey's floor, or a gallery's deck at the upper one's)
      expect(floors).toContain(p[2]);
      const s = floors.indexOf(p[2]), room = plan.rooms.find((r) => (r.storey ?? 0) === s && p[0] > r.box[0] + t && p[0] < r.box[2] - t && p[1] > r.box[1] + t && p[1] < r.box[3] - t)
        ?? plan.rooms.find((r) => r.id === (plan.galleries ?? []).find((g) => Math.abs(g.z - p[2]) < 0.05)?.hall && p[0] > r.box[0] && p[0] < r.box[2] && p[1] > r.box[1] && p[1] < r.box[3]);
      expect(room, `${p} stands in no room`).toBeTruthy();
      const hit = cols.find((c) => p[0] > c.min[0] - 0.3 && p[0] < c.max[0] + 0.3 && p[1] > c.min[1] - 0.3 && p[1] < c.max[1] + 0.3 && c.max[2] > p[2] + 0.05 && c.min[2] < p[2] + 1.7);
      expect(hit, `${p} stands in ${hit?.of}`).toBeUndefined();
      for (const s0 of plan.stairs ?? []) if (s0.z0 === p[2] || s0.z1 === p[2]) expect(p[0] > s0.rect[0] && p[0] < s0.rect[2] && p[1] > s0.rect[1] && p[1] < s0.rect[3]).toBe(false);
    }
    // (the start is the building's way in, the way out one of its doors, and the grid and the metres read each other)
    expect(M.anchors.spawn).toEqual(stageLevelOrder(G, { ...st, mission: undefined, manifest: st.manifest }, { ref: 'r', heroRef: null }).ends.spawn);
    const exit = M.sections.at(-1);
    expect(exit.task.kind).toBe('reach');
    expect(plan.ways.map((w) => w.room)).toContain(exit.way.room);
    for (const f of M.sections.flatMap((S) => S.foes)) { const c = gridOf(M.frame, f.at); expect(realOf(M.frame, [(c[0] + 0.5) * CELL, (c[1] + 0.5) * CELL, c[2] * RISE])[2]).toBe(f.at[2]); }
    expect(P.laws.filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`)).toEqual([]);
    // (the same seed, the same mission)
    expect(buildingMissionPlan(G, st.manifest, { spec: {}, seed: M.seed, spawn: M.anchors.spawn, heading: M.heading }).mission).toEqual(M);
  });
  it('carries the mission\'s cast, tasks and page under a gen-7 cube whose bones are the building\'s kit', () => {
    const O = stageLevelOrder(G, st, { ref: 'mb-level-one-0', heroRef: null }), m = O.args.manifest;
    expect(m.kind).toBe('stage');
    expect(m.geocube).toMatchObject({ era: 'gen-7', inside: { bones: PROGRAMS[USE].kit } });
    expect(m.kit).toBeUndefined();
    expect(m.program).toMatchObject({ use: USE, fight: true });
    expect(m.level).toMatchObject({ exit: false, complete: false });
    expect(m.level.mechanics.map((x) => x.kind)).toEqual(['objectives', 'fail-on-death', 'supplies']);
    // (a take and a reach read at the eye, never from the floor over or under them)
    const tasks = m.level.mechanics[0].tasks;
    expect(tasks.filter((x) => x.kind === 'take' || x.kind === 'reach').every((x) => x.planar === false)).toBe(true);
    const me = m.entities.find((e) => e.pilotable);
    expect(me.rule).toMatchObject({ type: 'platform', step: 0.3, gunplay: true });
    expect(me.rule.loadout.length).toBeGreaterThan(0);
    expect(m.camera).toMatchObject({ rule: 'eye', mouseLook: true });
    expect(m.entities.filter((e) => e.team === 'foes').every((e) => e.dormant)).toBe(true);
    expect(m.mission.plan.on).toBe('building');
    // (the storey over the ground handed to the wave a hold sends: its stairs from the ground, each walked by its own
    // points; the storeys' floors colliders, so nothing is seen or shot through a slab; a sentry keeps its post's mind)
    expect(st.manifest.ceilings).toBe(true);
    const plan = planOf(st.manifest), z1 = plan.storeys[1].z0;
    expect(M.floors).toHaveLength(1);
    expect(M.floors[0].z).toBe(z1);
    expect(M.floors[0].flights.length).toBe(plan.stairs.filter((x) => x.z0 === plan.storeys[0].z0 && x.z1 === z1).length);
    for (const fl of M.floors[0].flights) { expect(fl.way.length).toBeGreaterThan(2); expect(fl.way[0]).toEqual(fl.bottom); expect(fl.way.at(-1)).toEqual(fl.top); }
    const sent = m.entities.filter((e) => e.team === 'foes' && e.rule.floors);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((e) => e.rule.mind.motivation === 'frag' && e.rule.navLedges === true)).toBe(true);
    expect(sent.length).toBeLessThan(m.entities.filter((e) => e.team === 'foes').length);
    expect(m.mission.tasks.map((x) => x.kind)).toEqual(M.sections.map((S) => S.task.kind));
    expect(m.manaHud).toBeUndefined();
    expect(O.laws.every((l) => l.concern === 'mission')).toBe(true);
    // (its tasks proved on the bus, the stored stage lowered as the page lowers it)
    expect(proveMission(m)).toMatchObject({ proved: true, done: M.sections.map((S) => S.id) });
  }, 30000);
  it('with no mission, the building level is as it was: no cube, no mission, no fight', () => {
    const W0 = world({ building: { use: USE } }), s0 = gameStages(W0)[0];
    expect(s0.mission).toBeUndefined();
    expect(s0.manifest.geocube).toBeUndefined();
    expect(s0.manifest.mission).toBeUndefined();
    expect(s0.manifest.program.fight).toBeUndefined();
    expect(resolveLevel(readGameworld(W0), 'one').mission).toBeUndefined();
  });
});
