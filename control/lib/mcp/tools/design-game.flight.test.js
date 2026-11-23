// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { flyTasks } from '@/lib/graph/skyscape/lesson-pilot.js';

// DESIGNED FLIGHT LEVELS (the e2e tier: it makes a whole game through the real doors). An airspace level of a designed
// game is flown for its flight goal (gameworld/flight-goal.js), the one a quick flight reads: a lesson's tasks (the
// course's gates, a band held, the landing) with a crash ending the attempt; a sortie's wings, each asleep until its
// task wakes it, the craft armed; and an airspace with a course and no goal flown as a course (its gates and the
// landing, against the clock), never walked to an exit. Each flown as its class's airframe off the craft shelf.

const RUNWAY = { pads: [{ kind: 'runway', at: [0.5, 0.25] }] };
const world = (levels) => ({ id: 'wings', name: 'Wings', seed: 3, mode: 'autonomous', style: { kit: 'trail-valley' }, start: Object.keys(levels)[0], levels });
const LEVELS = {
  lesson: { name: 'First lesson', airspace: { map: { craft: 'trainer' }, ground: RUNWAY, course: true },
    goal: { flight: { tasks: [{ gates: [1, 2] }, { band: { alt: [250, 350], speed: [80, null] }, seconds: 10 }, { land: true }] } } },
  sortie: { name: 'Sortie', airspace: { map: { craft: 'jet' } }, goal: { flight: { tasks: [{ down: 2, text: 'Break up the scouts' }, { down: 3 }] } } },
  circuit: { name: 'Circuit', airspace: { map: { craft: 'trainer' }, ground: RUNWAY, course: true } },
};

beforeEach(() => { closeDb(); process.env.MOJULO_RUN_BUDGET_MS = '0'; });

describe('design_game: designed flight levels', () => {
  it('each airspace level is flown for its flight goal: a lesson\'s tasks, a sortie\'s wings, a course by default', async () => {
    await designGameHandler({ ref: 'wings', title: 'Wings', world: world(LEVELS) });
    const out = await designGameHandler({ ref: 'wings', run: true });
    expect(out.ran.filter((r) => r.action === 'make').map((r) => r.key)).toEqual(expect.arrayContaining(['level-lesson-0', 'level-sortie-0', 'level-circuit-0', 'game']));
    const level = (id) => SketchRepository.getByRef(`wings-level-${id}-0`).manifest;

    // the lesson: its tasks in order on the bus, a crash ending the attempt on every runway's box; nobody to fight
    const L = level('lesson'), kinds = L.game.mechanics.map((m) => m.kind);
    expect(kinds).toEqual(expect.arrayContaining(['objectives', 'crash']));
    expect(kinds).not.toContain('reach-exit');
    const O = L.game.mechanics.find((m) => m.kind === 'objectives'), C = L.game.mechanics.find((m) => m.kind === 'crash');
    expect(O.tasks.map((t) => t.kind)).toEqual(['gates', 'band', 'land']);
    expect(O.tasks[0].gates).toHaveLength(2);
    expect(O.tasks[0].text).toBe('Fly gates 1 to 2');
    expect(O.tasks[1].text).toBe('Hold 250 to 350 m, over 80 kt for 10 s');
    expect(O.tasks[2].pads.length).toBeGreaterThan(0);
    expect(C).toMatchObject({ then: 'fail' });
    expect(C.pads).toEqual(O.tasks[2].pads);
    expect((L.entities ?? []).filter((e) => e.team === 'foes')).toEqual([]);
    // flown as its airframe off the craft shelf: the trainer's light single, on its gear on the runway
    expect(L.entities.find((e) => e.pilotable).body).toMatchObject({ type: 'figure-rig', figure: 'craft' });
    expect(L.figures.craft).toEqual({ craft: { archetype: 'lightSingle', flying: true, gear: 'down' } });

    // the sortie: two wings, each asleep until its task wakes it; the craft armed; a crash comes back, costing hp
    const S = level('sortie'), SO = S.game.mechanics.find((m) => m.kind === 'objectives');
    expect(SO.tasks.map((t) => [t.kind, t.foes.length, t.text])).toEqual([['clear', 2, 'Break up the scouts'], ['clear', 3, 'Shoot down the 3 fighters']]);
    const foes = S.entities.filter((e) => e.team === 'foes');
    expect(foes.map((e) => e.id)).toEqual(['foe-1', 'foe-2', 'foe-3', 'foe-4', 'foe-5']);
    expect(foes.every((e) => e.dormant === true)).toBe(true);
    expect(S.game.mechanics.find((m) => m.kind === 'crash')).toMatchObject({ then: 'respawn', hurt: 25 });
    expect(S.game.mechanics.map((m) => m.kind)).toContain('fail-on-death');
    const pilot = S.entities.find((e) => e.pilotable);
    expect(pilot.weapon).toBeTruthy();
    // (armed, and still its airframe: the goal's hit volume merged over the figure, not in place of it)
    expect(pilot.body).toMatchObject({ type: 'figure-rig', figure: 'craft', hittable: true });
    expect(S.figures.craft.craft.archetype).toBe('jetFighter');

    // the circuit: no goal written, a course on it: its gates and the landing, against the clock
    const K = level('circuit');
    expect(K.game.mechanics.map((m) => m.kind)).toEqual(['laps']);
    expect(K.game.mechanics[0].land.pads.length).toBeGreaterThan(0);
  }, 400000);

  it('Pilot School: a locked pitch lays its first lessons; built, each is graded and said against its airfield', async () => {
    const out = await designGameHandler({ title: 'School', world: { id: 'school', name: 'School', rail: { from: 'pilot-school', locked: true } } });
    expect(out.pitch).toMatchObject({ stored: true, by: 'pilot-school', levels: ['lesson-1', 'lesson-2', 'lesson-3'] });
    const ref = out.ref;
    const run = await designGameHandler({ ref, run: true });
    expect(run.ran.filter((r) => r.action === 'make').map((r) => r.key)).toEqual(expect.arrayContaining(['level-lesson-1-0', 'level-lesson-2-0', 'level-lesson-3-0', 'game']));
    const M = (id) => SketchRepository.getByRef(`${ref}-level-${id}-0`).manifest;
    const L1 = M('lesson-1'), O1 = L1.game.mechanics.find((m) => m.kind === 'objectives');
    expect(O1.tasks.map((t) => t.kind)).toEqual(['band', 'gates', 'band']);
    expect(L1.game.mechanics.map((m) => m.kind)).toEqual(expect.arrayContaining(['grade', 'crash']));
    expect(L1.entities.find((e) => e.pilotable).rule.assist).toBe('sim');
    expect(L1.figures.craft.craft).toMatchObject({ archetype: 'lightSingle', gear: 'down' });
    // a height over the runway laid as the altitude over its datum; a turn from its heading laid as a compass heading
    const datum = L1.meta?.pads?.[0]?.datum ?? null, O2 = M('lesson-2').game.mechanics.find((m) => m.kind === 'objectives');
    const hold = O2.tasks[1].band, right = O2.tasks[2].band;
    expect(hold.alt[1] - hold.alt[0]).toBeCloseTo(60, 6);
    if (datum !== null) expect(hold.alt[0]).toBeCloseTo(datum + 200, 1);
    const across = ((right.heading[0] - hold.heading[0]) % 360 + 360) % 360;
    expect(across).toBeCloseTo(90, 1);
    // the grade reads the objectives' time and their bands' slip
    const G = M('lesson-3').game.mechanics.find((m) => m.kind === 'grade');
    expect(G.criteria.map((c) => c.var)).toEqual(['__obj_time', '__obj_slip']);
    // the run's readout says each lesson flown (the machine gate), with its medal
    expect(run.flight_proof.gate).toBe('machine');
    expect(run.flight_proof.levels.map((l) => [l.level, l.won, l.grade])).toEqual([['lesson-1', true, 'gold'], ['lesson-2', true, 'gold'], ['lesson-3', true, 'gold']]);
    // each lesson passed by the student on the fly rule, judged on the bus by its own mechanics, with a medal
    const flown = ['lesson-1', 'lesson-2', 'lesson-3'].map((id) => ({ id, ...flyTasks(M(id)) }));
    expect(flown.map((f) => [f.id, f.result, f.reason, f.time, f.grade, f.kept])).toEqual(flown.map((f) => [f.id, 'success', null, f.time, f.grade, f.kept]));
    expect(flown.map((f) => f.grade), JSON.stringify(flown.map((x) => [x.id, x.time, x.grade, x.kept]))).toEqual(['gold', 'gold', 'gold']);
    // and a careless flight (its height and heading drifting) is told apart: a lesser medal, or none
    const sloppy = flyTasks(M('lesson-2'), { wobble: 1 });
    expect(['silver', 'bronze', 'no medal', undefined], JSON.stringify([sloppy.result, sloppy.grade, sloppy.kept])).toContain(sloppy.grade);
  }, 400000);

  it('Wolf Squadron: a locked pitch lays a planet stage and a space stage; built, each flown down its rail to a boss', async () => {
    const out = await designGameHandler({ title: 'Wolves', world: { id: 'wolves', name: 'Wolves', rail: { from: 'wolf-squadron', locked: true } } });
    expect(out.pitch).toMatchObject({ stored: true, by: 'wolf-squadron', levels: ['stage-1', 'stage-2'] });
    const ref = out.ref, run = await designGameHandler({ ref, run: true });
    expect(run.ran.filter((r) => r.action === 'make').map((r) => r.key)).toEqual(expect.arrayContaining(['level-stage-1-0', 'level-stage-2-0', 'game']));
    for (const [id, ground] of [['stage-1', true], ['stage-2', false]]) {
      const M = SketchRepository.getByRef(`${ref}-level-${id}-0`).manifest, kinds = M.game.mechanics.map((m) => m.kind);
      // flown down its path on the rail rule: the ground a floor on the planet, none in space; the starfighter its body
      const P = M.entities.find((e) => e.pilotable);
      expect(P.rule.type).toBe('rail');
      expect(P.rule.path.length).toBeGreaterThan(10);
      expect(Number.isFinite(P.rule.floor)).toBe(ground);
      expect(P.weapon).toBeTruthy();
      expect(M.figures.craft.craft.archetype).toBe('strikeFoil');
      // its shield, its waves woken by the way's marks, its hazards met where they stand, its boss to shoot down
      expect(kinds).toEqual(expect.arrayContaining(['fail-on-death', 'wake', 'hazard-damage', 'defeat-all']));
      expect(kinds).not.toContain('reach-exit');
      const wake = M.game.mechanics.find((m) => m.kind === 'wake');
      expect(wake.marks).toHaveLength(3);
      expect(wake.marks.every((k) => k.fact === 'along' && k.foes.length === 3)).toBe(true);
      const foes = M.entities.filter((e) => /^foe-/.test(e.id));
      expect(foes.length).toBe(9);
      expect(foes.every((e) => e.dormant)).toBe(true);
      expect(M.entities.filter((e) => /^boss-/.test(e.id)).map((e) => e.id)).toEqual(['boss-core', 'boss-gun-1', 'boss-gun-2']);
      expect(M.game.mechanics.find((m) => m.kind === 'defeat-all')).toMatchObject({ who: 'boss-*', count: 3 });
      expect(M.game.mechanics.find((m) => m.kind === 'hazard-damage').hazards.every((h) => h.planar === false)).toBe(true);
      // its fighters on station ahead of the craft once woken, firing rounds that travel (dodged, rolled through)
      expect(foes.every((e) => e.rule.station?.of === 'player' && e.rule.station.lead >= 250 && !e.rule.missiles)).toBe(true);
      expect(foes.every((e) => e.weapon.fireClass === 'lob' && e.weapon.projectileGravity === 0)).toBe(true);
    }
    // the run's readout: each stage won by an attentive player on the page's runtime, and lost by a still one
    expect(run.flight_proof.gate).toBe('machine');
    expect(run.flight_proof.levels.map((l) => [l.level, l.won, l.result, l.still]), JSON.stringify(run.flight_proof.levels)).toEqual([['stage-1', true, 'success', 'lost'], ['stage-2', true, 'success', 'lost']]);
  }, 400000);

  it('Rebel Storm: a locked pitch lays the opening tour; built, each mission a sortie flown from the cockpit', async () => {
    const out = await designGameHandler({ title: 'Storm', world: { id: 'storm', name: 'Storm', rail: { from: 'rebel-storm', locked: true } } });
    expect(out.pitch).toMatchObject({ stored: true, by: 'rebel-storm', levels: ['mission-1', 'mission-2', 'mission-3'] });
    const ref = out.ref, run = await designGameHandler({ ref, run: true });
    for (const id of ['mission-1', 'mission-2', 'mission-3']) {
      const M = SketchRepository.getByRef(`${ref}-level-${id}-0`).manifest, kinds = M.game.mechanics.map((m) => m.kind);
      // the pilot on the starfighter rule, its ship's systems, its cannons' bolts; the camera in its cockpit, a chase to go out to
      const P = M.entities.find((e) => e.pilotable);
      expect(P.rule).toMatchObject({ type: 'starfighter' });
      expect(P.body.ship.shields.max).toBeGreaterThan(0);
      expect(P.weapon).toMatchObject({ fireClass: 'lob', projectileGravity: 0 });
      expect(M.camera).toMatchObject({ rule: 'cockpit', target: 'player', hideTarget: true, chase: { rule: 'follow' } });
      expect(M.figures.craft.craft.archetype).toBe('strikeFoil');
      // its mission: the sortie over its flight groups, the hull its body's; no gates
      expect(kinds).toEqual(['fail-on-death', 'sortie']);
      expect(M.game.mechanics[0]).toEqual({ kind: 'fail-on-death', of: 'body' });
      const crafts = M.entities.filter((e) => !e.pilotable && e.body?.figure?.startsWith('craft-'));
      expect(crafts.length).toBeGreaterThan(3);
      expect(crafts.every((e) => M.figures[e.body.figure]?.craft?.flying)).toBe(true);
    }
    // the convoy holds, unarmed, and is the mission's to protect
    const M2 = SketchRepository.getByRef(`${ref}-level-mission-2-0`).manifest;
    expect(M2.entities.find((e) => e.id === 'convoy-1').rule).toEqual({ type: 'static' });
    expect(M2.game.mechanics[1].goals.find((g) => g.protect)).toEqual({ protect: ['convoy-1', 'convoy-2'], say: 'The convoy is lost' });
    // the run's readout: each mission won by a steady pilot on the page's runtime, and lost by a still one
    expect(run.flight_proof.levels.map((l) => [l.level, l.won, l.result, l.still]), JSON.stringify(run.flight_proof.levels)).toEqual([['mission-1', true, 'success', 'lost'], ['mission-2', true, 'success', 'lost'], ['mission-3', true, 'success', 'lost']]);
  }, 400000);

  it('beacons: the pilot sent to places, a group brought in by one, the next lit by a group down; proved', async () => {
    const level = { name: 'Beacons', airspace: { map: { craft: 'fighter', field: 6000 }, space: { asteroids: 'sparse' }, airframe: 'strikeFoil', cockpit: true },
      goal: { flight: { sortie: {
        beacons: [{ id: 'nav1', name: 'Nav 1', at: { ahead: 1500 } }, { id: 'jump', name: 'Jump point', at: { ahead: 1800, side: 600, up: 100 }, lit: { down: 'raider' } }],
        groups: [{ id: 'red', side: 'friend', count: 1 }, { id: 'raider', side: 'foe', count: 2, arrive: { reach: 'nav1', after: 2 }, at: { ahead: 2600 } }],
        goals: [{ destroy: 'raider' }, { reach: 'jump' }] } } } };
    const out = await designGameHandler({ ref: 'beacons', title: 'Beacons', world: world({ m: level }) });
    const run = await designGameHandler({ ref: out.ref, run: true });
    const M = SketchRepository.getByRef(`${out.ref}-level-m-0`).manifest;
    // a marker each, the mission's (U), the one not yet lit asleep
    expect(M.entities.filter((e) => e.body?.beacon).map((e) => [e.id, !!e.dormant, e.body.goal])).toEqual([['beacon-nav1', false, true], ['beacon-jump', true, true]]);
    // flown to Nav 1, the raiders in and down, the jump point lit and reached by a steady pilot; never by a still one
    expect(run.flight_proof.levels.map((l) => [l.level, l.won, l.result, l.still]), JSON.stringify(run.flight_proof.levels)).toEqual([['m', true, 'success', 'lost']]);
  }, 400000);

  it('refuses a flight goal it cannot lay, teaching', async () => {
    const bad = async (lv, msg) => { await expect(designGameHandler({ ref: 'bad', title: 'Bad', world: world({ x: lv }) })).rejects.toThrow(msg); };
    await bad({ airspace: { map: { craft: 'jet' } }, goal: { flight: 'course' } }, /a course is flown on a course/);
    await bad({ airspace: { map: { craft: 'jet' } }, goal: { flight: { tasks: [{ gates: true }] } } }, /gates are a course's/);
    await bad({ airspace: { map: { craft: 'jet' } }, goal: { flight: { tasks: [{ gates: true, land: true }] } } }, /one of gates, land, band, reach, down/);
    await bad({ airspace: { map: { craft: 'jet' } }, goal: { flight: { tasks: [{ band: { altitude: [1, 2] }, seconds: 3 }] } } }, /not a gauge/);
    await bad({ airspace: { map: { craft: 'jet' } }, goal: { boss: true } }, /goal on an airspace is \{ flight \}/);
    await bad({ walk: { nodes: { path: { trail: true } } }, goal: { flight: 'course' } }, /goal\.flight is an airspace level's goal/);
  }, 120000);
});
