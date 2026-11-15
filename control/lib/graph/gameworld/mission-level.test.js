// THE MISSION (mission-level.js, mission-proof.js): the firing range stretched into a first level, on the runtime. One
// world a procedure, chosen from the tables: a feel template that shoots (the range's own person), a carried kit with a
// long gun. The concepts: every world with a firing range has a mission and none without; the level is the range's
// guns and bands with the tasks on the bus; its structure is proved on the bus; a player that only gives input wins it
// and one that gives none does not; the same run twice is the same run.
import { describe, expect, it } from 'vitest';

import { missionCube, missionFor, missionPlan, missionLevel, missionMechanics, missionTasks, missionEnds, MISSION_HP } from './mission-level.js';
import { proveMission, playMission, missionPlaySummary, MISSION_PLAYERS } from './mission-proof.js';
import { practiceFor, practiceRoomOf } from './practice.js';
import { TEMPLATE_LOADOUTS, loadoutOf } from './loadout.js';
import { POLES } from './feel/cards.js';
import { ARMS_KIT } from './arms-kit.js';
import { ARCHETYPE_BAND } from '../mission/index.js';
import { composeMechanics } from '../game/mechanics.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const UNARMED = Object.keys(POLES).find((id) => !loadoutOf({ feel: id }));
const LONG = Object.keys(ARMS_KIT).find((w) => ARCHETYPE_BAND[ARMS_KIT[w].as] === 'long' && !ARMS_KIT[w].bow);
const WORLD = { id: 'mission-test', name: 'Mission test', feel: SHOOTER };

describe('the door', () => {
  it('gives every world with a firing range a mission, and a world with none neither', () => {
    expect(practiceFor(WORLD).rooms).toEqual(expect.arrayContaining(['range', 'mission']));
    expect(missionFor(WORLD)).toEqual({});
    expect(practiceFor({ feel: UNARMED }).rooms).not.toContain('mission');
    expect(missionFor({ feel: UNARMED })).toBeNull();
    expect(missionPlan({ feel: UNARMED })).toBeNull();
    expect(() => practiceRoomOf({ feel: UNARMED }, 'mission')).toThrow(/has no first mission/);
  });
});

describe('the level', () => {
  const L = missionLevel(WORLD, { quiet: true }), m = L.manifest;
  it('is the range\'s body and guns on the mission\'s ground, its foes asleep on their spots', () => {
    const me = m.entities.find((e) => e.pilotable), foes = m.entities.filter((e) => e.team === 'foes');
    expect(me.rule.loadout.map((s) => s.name)).toEqual(TEMPLATE_LOADOUTS[SHOOTER].weapons.filter((w) => typeof w === 'string'));
    // (each gun asks to be drawn as the arms library builds it; the recipe carries the ask, never the mesh)
    expect(me.rule.loadout.every((s) => s.gunplay.view.detail === 'arm' && s.gunplay.view.mesh === undefined)).toBe(true);
    expect(me.transform.pos.slice(0, 2)).toEqual(L.mission.anchors.spawn.slice(0, 2));
    expect(foes.length).toBe(L.mission.sections.reduce((n, s) => n + s.foes.length, 0));
    expect(foes.every((e) => e.dormant === true && e.body.hp === MISSION_HP.foe)).toBe(true);
    expect(m.colliders.length).toBeGreaterThan(L.mission.primitives.length);
  });
  it('carries its recipe: the tasks, the level\'s hp, what lies on the floor; and they compose', () => {
    const kinds = m.game.mechanics.map((x) => x.kind);
    expect(kinds).toEqual(['objectives', 'fail-on-death', 'supplies']);
    expect(missionTasks(L.mission).map((t) => t.id)).toEqual(L.mission.sections.map((s) => s.id));
    const c = composeMechanics(missionMechanics(L.mission), { player: 'player', spawn: [0, 0, 0], fall: 'none' });
    expect(Object.values(c.on).map((o) => o.end).sort()).toEqual(['fail', 'success']);
  });
  it('says its laws and its plan, and its ends are read off the plan', () => {
    expect(L.laws.filter((l) => !l.holds)).toEqual([]);
    const E = missionEnds(m);
    expect(E.spawn).toEqual(L.mission.anchors.spawn);
    expect(E.exit).toEqual(L.mission.anchors.exit);
    expect(E.beats.map((b) => b.beat)).toEqual(L.mission.sections.map((s) => s.id));
  });
  it('is proved on the bus: every task in the order written, every way on sealed until its task is met', () => {
    const P = proveMission(m);
    expect(P.proved).toBe(true);
    expect(P.done).toEqual(L.mission.sections.map((s) => s.id));
    expect(P.sealed).toBe(L.mission.sections.filter((s) => s.door).length);
    expect(P.assumed.length).toBeGreaterThan(0);
  });
  it('is won by a player that walks and shoots, not by one that does nothing; twice the same', () => {
    const run = () => playMission(m, L.mission, { player: 'gunner', seconds: 240 });
    const R = run();
    expect(R.won).toBe(true);
    expect(R.tasks).toEqual(L.mission.sections.map((s) => s.id));
    expect(R.hp.left).toBeGreaterThan(0);
    expect(missionPlaySummary(R)).toMatch(/^gunner: won/);
    expect(JSON.stringify(run())).toBe(JSON.stringify(R));
    const still = playMission(m, L.mission, { player: 'still', seconds: 15 });
    expect(still.won).toBe(false);
    expect(still.tasks).toEqual([]);
    expect(MISSION_PLAYERS).toEqual(['gunner', 'still']);
  }, 60000);
});

describe('a kit with a long gun', () => {
  it('lays the long line and is won the same way', () => {
    const G = { id: 'long-test', quick: { goal: 'shoot', arms: [LONG, 'handgun'] } };
    const L = missionLevel(G, { quiet: true });
    expect(L.mission.sections.map((s) => s.kind)).toContain('overwatch');
    expect(proveMission(L.manifest).proved).toBe(true);
    expect(playMission(L.manifest, L.mission, { seconds: 300 }).won).toBe(true);
  }, 60000);
});

// A LEVEL'S OWN FORM (world.js `levels.<id>.mission`, levels.js): read, laid as one stage, its pilot the level's own (no
// hero: the eye; a hero: over its shoulder), its cast and its tasks the mission's; and a quick shooter's level in place
// of its trail. One pilot a procedure.
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder, stageTitle } from './levels.js';
import { runSteps } from './runner.js';
import { quickWorld } from './quick.js';
import { proveMissions, missionStageManifests } from './mission-proof.js';
import { MISSION_LOOK } from './mission-mana.js';

const LEVELLED = { id: 'm', name: 'M', seed: 3, style: { kit: 'trail-valley' }, feel: SHOOTER, start: 'one', levels: { one: { name: 'First contact', mission: true } } };
const order = (W, heroRef = null) => { const G = readGameworld(W), st = gameStages(W)[0]; return { st, L: stageLevelOrder(G, st, { ref: 'm-level-one-0', heroRef }) }; };

describe('a mission as a level', () => {
  it('is read with the world, and refused beside another form or in a world with no gun', () => {
    expect(readGameworld(LEVELLED).levels.one.mission).toBe(true);
    expect(() => readGameworld({ ...LEVELLED, levels: { one: { mission: true, walk: { nodes: { a: { trail: true } } } } } })).toThrow(/a mission level is the mission alone/);
    expect(() => readGameworld({ ...LEVELLED, levels: { one: { mission: { pace: 1 } } } })).toThrow(/not a mission setting/);
    expect(() => readGameworld({ ...LEVELLED, feel: UNARMED })).toThrow(/this world carries none/);
  });
  it('is one stage, named for its level, its laws on its order; with no hero it is aimed from the eye', () => {
    const { st, L } = order(LEVELLED), m = L.args.manifest, me = m.entities.find((e) => e.pilotable);
    expect(gameStages(LEVELLED).length).toBe(1);
    expect([st.section, stageTitle(st)]).toEqual(['mission', 'First contact']);
    expect(m.camera.rule).toBe('eye');
    expect(me.rule.turnMode).toBe('look');
    expect(me.rule.loadout.length).toBeGreaterThan(0);
    expect(m.game.mechanics.map((x) => x.kind)).toEqual(['objectives', 'fail-on-death', 'supplies']);
    expect(m.game.complete).toBe(false);
    expect(Array.isArray(m.mission.tasks)).toBe(true);
    expect(L.laws.every((l) => l.concern === 'mission' && l.holds)).toBe(true);
    // a sealed way puts the body back where it is carried: at its eye over the floor, as it was set down
    const O = m.game.mechanics[0], S = st.mission.mission.sections.find((x) => x.door), T = O.tasks.find((t) => t.id === S.id);
    expect(T.door.back[2]).toBeCloseTo(S.door.back[2] + me.rule.eye, 2);
    expect(playMission(m, st.mission.mission, { seconds: 240 }).won).toBe(true);
  }, 60000);
  it('with a hero seen from behind it is aimed over the shoulder, its rounds converging on the crosshair, and won', () => {
    const { st, L } = order({ ...LEVELLED, camera: 'third-person' }, 'm-hero'), m = L.args.manifest, me = m.entities.find((e) => e.pilotable);
    expect(m.camera.rule).toBe('follow');
    expect(me.weapon.converge).toBe(true);
    expect(me.body.hittable).toBe(true);
    expect(playMission(m, st.mission.mission, { seconds: 240 }).won).toBe(true);
  }, 60000);
  it('is made by a run: its foes\' figure, the level, the game on mana-ui in the mission\'s look; and proved', () => {
    const steps = runSteps(LEVELLED, { ref: 'm' }), keys = steps.map((s) => s.key);
    expect(keys).toEqual(expect.arrayContaining(['foe-gunner', 'level-one-0', 'game']));
    const level = steps.find((s) => s.key === 'level-one-0'), game = steps.find((s) => s.key === 'game');
    expect(Object.values(level.order.manifest.figures)[0].heroRef).toBe(steps.find((s) => s.key === 'foe-gunner').ref);
    expect(game.order.ui.theme.name).toBe(readGameworld(LEVELLED) && 'Field Brief');
    expect(MISSION_LOOK).toBe('field-brief');
    expect(missionStageManifests(steps)).toEqual({ manifests: { one: level.order.manifest }, keys: { one: 'level-one-0' } });
    const P = proveMissions(LEVELLED, { one: level.order.manifest });
    expect(P.map((x) => [x.level, x.proved, x.won])).toEqual([['one', true, true]]);
    expect(proveMissions({ ...LEVELLED, levels: { one: { walk: { nodes: { a: { trail: true } } } } } }, {})).toBeNull();
  }, 60000);
  it('a quick shooter\'s mission is its level in place of the trail, laid from its carried kit', () => {
    const W = quickWorld({ id: 'q', name: 'Q', seed: 2, quick: { goal: 'shoot', arms: [LONG, 'handgun'], mission: true } });
    expect(W.levels.run.mission).toBe(true);
    const steps = runSteps(W, { ref: 'q' }), level = steps.find((s) => /^level-/.test(s.key));
    expect(level.order.manifest.game.mechanics[0].kind).toBe('objectives');
    expect(proveMission(level.order.manifest).proved).toBe(true);
    expect(() => quickWorld({ id: 'q', quick: { goal: 'shoot', mission: true } })).toThrow(/laid from the guns carried/);
    expect(() => quickWorld({ id: 'q', quick: { goal: 'reach', arms: ['rifle'], mission: true } })).toThrow();
  }, 60000);
});

// THE ERA A MISSION IS READ IN: the seventh generation by default (the form render's live light), the world's own cube
// when it names one, and a cube that names its era keeps it. One world a case.
import { geocubeEraOf } from '../era/geocube.js';

describe('the era a mission is read in', () => {
  it('is the seventh generation unless the world\'s cube names another, on the practice room and on a level', () => {
    expect(geocubeEraOf(missionLevel(WORLD).manifest)).toBe('gen-7');
    expect(geocubeEraOf(order(LEVELLED).L.args.manifest)).toBe('gen-7');
    expect(missionCube({ style: { geocube: 'valley-morning' } })).toEqual({ from: 'valley-morning', era: 'gen-7' });
    const sixth = { from: 'valley-morning', era: 'gen-6' };
    expect(missionCube({ style: { geocube: sixth } })).toEqual(sixth);
  });
});

// A WAVE IS SENT TO THE FIGHT: one mission a case. The concept: the foes a hold wakes know where the body is (no
// perception: they path to it), the foes of a clear keep their class's sight and memory (they are found).
describe('the minds a mission wakes', () => {
  it('sends a hold\'s waves to the fight, and leaves a clear\'s foes to their own sight and memory', () => {
    const { manifest, mission } = missionLevel(WORLD), by = Object.fromEntries(manifest.entities.map((e) => [e.id, e]));
    const hold = mission.sections.find((S) => S.task.kind === 'hold'), clear = mission.sections.find((S) => S.task.kind === 'clear');
    expect(hold.foes.length).toBeGreaterThan(0);
    for (const f of hold.foes) { expect(by[f.id].rule.mind.perception).toBeUndefined(); expect(by[f.id].rule.mind.pathing).toBe('navmesh'); }
    for (const f of clear.foes) expect(by[f.id].rule.mind.perception).toBe('memory');
  });
});
