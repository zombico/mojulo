// A MISSION ON A FIGHTING MAP (mission-level.js with `mission.map`, arena-map/): the firing range decides the rules, the
// map is grown under the arena laws and the phases placed on it. One world a procedure (a feel template that shoots), one
// map (the smallest template, chosen in code), and the kit's own pick once. The concepts: the level is a controllable
// page whose ground is the map's blocks, carried as grown so the page is rebuilt from them and never regrown; its tasks
// are proved on the bus; a gunner that walks the map's own graph wins it and one that gives no input does not; a level's
// own form takes it as the practice room does; the greybox mission is untouched by it.
import { describe, expect, it } from 'vitest';
import { missionLevel, missionPlan, missionMapOf, missionCube } from './mission-level.js';
import { mapFormGround, MAP_FORM, mapDress } from '../arena-map/ground-form.js';
import { proveMission, playMission, proveMissions, missionStageManifests } from './mission-proof.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { runSteps } from './runner.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { readMission, missionBrief, MISSION_MAPS } from '../mission/index.js';
import { TEMPLATES, TEMPLATE_IDS } from '../arena-map/templates.js';
import { mapGround } from '../arena-map/ground.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const SMALLEST = TEMPLATE_IDS.reduce((a, b) => { const A = TEMPLATES[a].build(), B = TEMPLATES[b].build(); return A.nx * A.ny * A.nz <= B.nx * B.ny * B.nz ? a : b; });
const WORLD = { id: 'map-test', name: 'Map test', feel: SHOOTER };

describe('a mission on a map', () => {
  it('reads `map` as true or a template, and the kit picks one by its longest band', () => {
    expect(readMission({ map: true })).toEqual({ map: true });
    expect(readMission({ map: SMALLEST })).toEqual({ map: SMALLEST });
    expect(() => readMission({ map: 'maze' })).toThrow(/is true \(the map the kit picks\), a template .*or a place/);
    const B = missionBrief(WORLD, { map: true }), top = B.serves.long ? 'long' : B.serves.mid ? 'mid' : 'close';
    expect(B.map).toEqual({ template: MISSION_MAPS[top].template });
    expect(Object.values(MISSION_MAPS).every((m) => TEMPLATE_IDS.includes(m.template))).toBe(true);
    expect(missionBrief(WORLD).map).toBeNull();
  });
  const L = missionLevel(WORLD, { quiet: true, spec: { map: SMALLEST } }), m = L.manifest;
  it('is a controllable page on the map\'s blocks, carried as grown and rebuilt from them', () => {
    expect(m.kind).toBe('controllable');
    expect(L.mission.on).toBe('map');
    const carried = missionMapOf(m);
    expect(carried).toMatchObject({ template: SMALLEST, seed: L.map.seed });
    // (read by the seventh generation: the blocks as material under the mission's cube, rebuilt from them the same)
    const G = mapFormGround(carried.blocks, { cube: missionCube(WORLD) });
    expect(G.faces).toEqual(m.faces);
    expect(G.colliders).toEqual(mapGround(carried.blocks).colliders);
    expect(G.colliders).toEqual(m.colliders);
    expect(m.form).toEqual(G.form);
    // its ladders the runtime's climbs, among the cast; its foes asleep
    expect(m.entities.filter((e) => e.rule?.type === 'climbable').length).toBe(carried.blocks.ladders.length);
    expect(m.entities.filter((e) => e.team === 'foes').every((e) => e.dormant)).toBe(true);
    // planned again on the blocks it carries: the same mission, no growing
    expect(missionPlan(WORLD, { spec: { map: SMALLEST }, seed: L.map.seed, grown: carried.blocks }).mission).toEqual(L.mission);
    expect(L.laws.filter((l) => !l.holds).map((l) => `${l.law}: ${l.says}`)).toEqual([]);
  });
  it('is proved on the bus, won by the gunner on the map\'s own graph, and not by a player who does nothing', () => {
    expect(proveMission(m)).toMatchObject({ proved: true, sealed: 0 });
    const R = playMission(m, L.mission, { seconds: 240 });
    expect(R.won, `${R.reason}`).toBe(true);
    expect(R.tasks).toEqual(L.mission.sections.map((S) => S.id));
    expect(playMission(m, L.mission, { player: 'still', seconds: 30 }).won).toBe(false);
  }, 60000);
  it('is a level\'s own form: one controllable stage on the map, proved and played from a run', () => {
    const W = { id: 'm', name: 'M', seed: 3, style: { kit: 'trail-valley' }, feel: SHOOTER, start: 'one', levels: { one: { name: 'First contact', mission: { map: SMALLEST } } } };
    const G = readGameworld(W), st = gameStages(W)[0], O = stageLevelOrder(G, st, { ref: 'm-level-one-0', heroRef: null }), lm = O.args.manifest;
    expect([st.section, lm.kind, lm.mission.plan.on]).toEqual(['mission', 'controllable', 'map']);
    const me = lm.entities.find((e) => e.pilotable);
    expect(me.transform.pos.slice(0, 2)).toEqual(st.mission.mission.anchors.spawn.slice(0, 2));
    expect(O.laws.every((l) => l.concern === 'mission')).toBe(true);
    const S = missionStageManifests(runSteps(W, { ref: 'm' }));
    // (proved on the bus and played; whether the gunner wins it is said, never forced: a map and a seed it loses on say
    // where, with the dials that move it)
    const R = proveMissions(W, S.manifests);
    expect(R.map((x) => [x.level, x.proved])).toEqual([['one', true]]);
    expect(R[0].play).toMatch(/^gunner: /);
    if (!R[0].won) expect(R[0].advice).toMatch(/the gunner/);
  }, 60000);
});

// THE MINDS ON A MAP: a hold's wave crosses its floors. One map with an upper floor a ramp reaches, chosen in code.
import { mapFloors } from '../arena-map/ground.js';

describe('a hold\'s wave on a map with floors', () => {
  const withFloor = TEMPLATE_IDS.find((id) => mapFloors(TEMPLATES[id].build()).length > 0);
  const R = missionLevel({ id: 'w', name: 'W', feel: SHOOTER }, { spec: { map: withFloor }, seed: 1 }), by = Object.fromEntries(R.manifest.entities.map((e) => [e.id, e]));
  it('is given the map\'s floors and their ramps, a path kept to its ground, and the mind that crosses them', () => {
    expect(R.mission.floors.length).toBeGreaterThan(0);
    for (const F of R.mission.floors) { expect(F.flights.length).toBeGreaterThan(0); expect(F.area[2]).toBeGreaterThan(F.area[0]); }
    const hold = R.mission.sections.find((S) => S.task.kind === 'hold');
    for (const f of hold.foes) expect(by[f.id].rule).toMatchObject({ navLedges: true, floors: R.mission.floors, mind: { motivation: 'frag', perception: 'memory', pathing: 'navmesh' } });
    // a clear's foes are found where they stand: their class's own mind, no floors
    const clear = R.mission.sections.find((S) => S.task.kind === 'clear');
    for (const f of clear.foes) { expect(by[f.id].rule.floors).toBeUndefined(); expect(by[f.id].rule.navLedges).toBeUndefined(); }
  });
});

// A PLACE AS THE MAP (`mission.map: { town } | { city, on }`): a window of a designed town or city cut onto the grid
// (arena-map/read-town.js) and grown for the kit with what it is made of kept. One place, a town's block (the quickest
// design), chosen from the segment table in code.
import { SEGMENTS } from '../geotown/pattern.js';
import { PLACE_SIZE } from '../mission/brief.js';

describe('a mission on a place', () => {
  const SEG = Object.keys(SEGMENTS).find((k) => SEGMENTS[k].rows.length && !SEGMENTS[k].main);
  it('reads a place of a town or of a city, its cut\'s side its own or the mission\'s, and refuses what is off its words', () => {
    expect(readMission({ map: { town: { segment: SEG } } })).toEqual({ map: { town: { segment: SEG }, size: PLACE_SIZE[2] } });
    expect(readMission({ map: { city: true, size: PLACE_SIZE[0] } }).map).toMatchObject({ city: {}, size: PLACE_SIZE[0] });
    expect(readMission({ map: { city: true } }).map.on).toBeTruthy();
    expect(() => readMission({ map: { town: true, city: true } })).toThrow(/of a town or of a city/);
    expect(() => readMission({ map: { town: true, on: 'quay' } })).toThrow(/what a city's cut is held to/);
    expect(() => readMission({ map: { city: true, on: 'forest' } })).toThrow(/what a city's cut is held to/);
    expect(() => readMission({ map: { town: true, size: 500 } })).toThrow(/the cut's side in metres/);
    expect(() => readMission({ map: { town: true, hills: 3 } })).toThrow(/not a place's word/);
    expect(missionBrief(WORLD, { map: { town: { segment: SEG }, size: PLACE_SIZE[2] } }).map).toEqual({ template: 'given', place: { town: { segment: SEG }, size: PLACE_SIZE[2] } });
  });
  const L = missionLevel(WORLD, { quiet: true, spec: { map: { town: { segment: SEG } } }, seed: 1 }), m = L.manifest;
  it(`(${SEG}) is the place's cut grown under the laws, its buildings kept, carried and rebuilt as any map is`, () => {
    const carried = missionMapOf(m);
    expect(carried.template).toBe('given');
    expect(carried.blocks.nx).toBe(PLACE_SIZE[2] / 3);
    expect(carried.blocks.read.notes.join(' ')).toMatch(/a cut of block/);
    expect(carried.blocks.read.masses).toBeGreaterThan(0);
    expect(mapFormGround(carried.blocks, { cube: missionCube(WORLD) }).faces).toEqual(m.faces);
    expect(missionPlan(WORLD, { spec: readMission({ map: { town: { segment: SEG } } }), seed: L.map.seed, grown: carried.blocks }).mission).toEqual(L.mission);
    expect(L.brief.why.map).toMatch(/cut of a town/);
    // (its tasks proved on the bus; a law of the map it does not hold is said, as advice)
    expect(proveMission(m)).toMatchObject({ proved: true });
    expect(L.laws.filter((l) => !l.holds).every((l) => l.law.startsWith('map:'))).toBe(true);
  }, 60000);
});

// THE MAP IN THE SEVENTH GENERATION (arena-map/ground-form.js): its blocks as material under the cube's day. One map (the
// smallest template) and one place's cut. The concepts: the geometry is the greybox's, face for face; every block face
// wears its dress's tile, mapped in metres, with its colour and the day's light apart; a face the sun cannot see is in
// shadow; the page is handed the form render; a world that names the sixth generation keeps the greybox, not a key more.
import { ERAS, ERA_IDS } from '../era/eras.js';

describe('a map read by the seventh generation', () => {
  const M = TEMPLATES[SMALLEST].build(), G = mapFormGround(M, { cube: missionCube(WORLD) }), P = mapGround(M);
  it('is the greybox\'s geometry in its dress\'s tiles, baked under the cube\'s sun', () => {
    expect(G.faces.map((f) => f.corners)).toEqual(P.faces.map((f) => f.corners));
    expect(mapDress(M)).toBe('arena');
    const worn = G.faces.filter((f) => f.texture);
    expect(worn.length).toBeGreaterThan(G.faces.length * 0.8);
    expect(new Set(worn.map((f) => f.texture)).size).toBeLessThanOrEqual(Object.keys(MAP_FORM.arena).length);
    for (const f of worn.slice(0, 40)) { expect(f.uv).toHaveLength(f.corners.length); expect(f.cornerLight).toHaveLength(f.corners.length); expect(f.sunShare).toHaveLength(f.corners.length); }
    // (the sun reaches some corners and not others: the blocks shade each other)
    const shares = worn.flatMap((f) => f.sunShare);
    expect(shares.some((v) => v > 0.3) && shares.some((v) => v === 0)).toBe(true);
    expect(G.form.town.lights).toHaveLength(1);
    expect(mapFormGround(M, { cube: missionCube(WORLD) })).toEqual(G);
  });
  it('is the mission\'s ground only in an era whose surface is the form\'s; the sixth keeps the greybox and carries no form', () => {
    const SIXTH = ERA_IDS.find((e) => ERAS[e].surface !== 'form');
    const old = missionLevel({ ...WORLD, style: { geocube: { from: 'valley-morning', era: SIXTH } } }, { quiet: true, spec: { map: SMALLEST }, seed: 1 }).manifest;
    expect(old.form).toBeUndefined();
    expect(old.faces).toEqual(mapGround(missionMapOf(old).blocks).faces);
    // (the lane, no map: greybox in either era)
    expect(missionLevel(WORLD, { quiet: true }).manifest.form).toBeUndefined();
  });
});

// WHERE A CITY'S CUT STANDS (`map.at`, a design step's answer: arena-map/facility.js designFacility).
describe('a mission on a cut that names where it stands', () => {
  it('reads `at` for a city\'s cut and for none other', () => {
    expect(readMission({ map: { city: true, at: [100, 200] } }).map).toMatchObject({ city: {}, at: [100, 200] });
    expect(() => readMission({ map: { city: true, at: [1] } })).toThrow(/a city cut's middle/);
    expect(() => readMission({ map: { town: true, at: [1, 2] } })).toThrow(/a city cut's middle/);
    expect(() => readMission({ map: { city: true, weather: 'rain' } })).toThrow(/not a place's word/);
  });
});
