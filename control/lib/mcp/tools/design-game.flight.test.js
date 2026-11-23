// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';

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
