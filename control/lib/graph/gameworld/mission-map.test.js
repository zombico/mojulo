// A MISSION ON A FIGHTING MAP (mission-level.js with `mission.map`, arena-map/): the firing range decides the rules, the
// map is grown under the arena laws and the phases placed on it. One world a procedure (a feel template that shoots), one
// map (the smallest template, chosen in code), and the kit's own pick once. The concepts: the level is a controllable
// page whose ground is the map's blocks, carried as grown so the page is rebuilt from them and never regrown; its tasks
// are proved on the bus; a gunner that walks the map's own graph wins it and one that gives no input does not; a level's
// own form takes it as the practice room does; the greybox mission is untouched by it.
import { describe, expect, it } from 'vitest';
import { missionLevel, missionPlan, missionMapOf } from './mission-level.js';
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
    expect(() => readMission({ map: 'maze' })).toThrow(/is true \(the map the kit picks\) or a template/);
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
    const G = mapGround(carried.blocks);
    expect(G.faces).toEqual(m.faces);
    expect(G.colliders).toEqual(m.colliders);
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
