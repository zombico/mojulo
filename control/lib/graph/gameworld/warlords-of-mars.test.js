import { describe, it, expect } from 'vitest';
import { warlordsOfMarsStart, OPERATIONS, WARLORDS_OF_MARS } from './warlords-of-mars.js';
import { readOperation, operationMechanics } from './frame-goal.js';
import { readGameworld } from './world.js';
import { runSteps } from './runner.js';
import { composeGameworld } from './compose.js';
import { pitchStart } from './pitch-start.js';
import { nearestRails } from './rails.js';

// WARLORDS OF MARS (warlords-of-mars.js): an assault frame's operations on Mars, on the level path Wolf Squadron and Rebel
// Storm laid. One case per concept: the starter reads, a level is a frame's (its pilot, its groups, its tasks), words reach
// it from both doors, and an operation's tasks lower onto the objectives.
const W = () => ({ id: 'wom', name: 'Warlords of Mars', ...warlordsOfMarsStart({}).world });
const first = OPERATIONS[0].id;

describe('Warlords of Mars', () => {
  it('starts as its operations, each a field on Mars with the pilot\'s frame and an operation goal', () => {
    const G = readGameworld(W());
    expect(G.ids).toEqual(OPERATIONS.map((o) => o.id));
    for (const id of G.ids) {
      expect(G.levels[id].airspace.frame.build).toBe(WARLORDS_OF_MARS.frame);
      expect(G.levels[id].airspace.ground.geocube).toBe('mars');
      expect(G.levels[id].goal.operation).toBeTruthy();
    }
  });

  it('lays a level whose pilot is a frame and whose foes are its groups, a later task\'s asleep', () => {
    const steps = runSteps({ ...W(), levels: { [first]: W().levels[first] }, start: first }, { ref: 'wom' });
    const m = steps.find((s) => s.key.startsWith('level-')).order.manifest;
    const P = m.entities.find((e) => e.pilotable);
    expect(P.rule.type).toBe('frame');
    expect(Object.keys(P.rule.slots)).toEqual(['armR', 'armL', 'backR', 'backL']);
    expect(m.figures[P.body.figure].assault.build).toBe(WARLORDS_OF_MARS.frame);
    const foes = m.entities.filter((e) => e.team === 'foes');
    const op = readOperation(OPERATIONS[0].groups && { groups: OPERATIONS[0].groups, tasks: OPERATIONS[0].tasks });
    expect(foes.length).toBe(op.groups.reduce((a, g) => a + g.count, 0));
    expect(foes.filter((e) => e.dormant).length).toBe(op.groups.filter((g) => op.tasks.slice(1).some((t) => t.down?.includes(g.id))).reduce((a, g) => a + g.count, 0));
    expect(m.game.mechanics.map((x) => x.kind)).toEqual(expect.arrayContaining(['objectives', 'fail-on-death']));
  });

  it('an operation\'s tasks lower onto the objectives: its downs as clears of their groups, a reach on the ground', () => {
    const op = readOperation({ groups: [{ id: 'a', kind: 'turret', count: 2, at: [0, 0.2] }, { id: 'b', kind: 'frame', at: [0, 0.6] }], tasks: [{ down: 'a' }, { down: 'b' }, { reach: [0.3, 0.5] }] });
    const ends = { spawn: [0, -300, 0], ground: () => 12, frame: { half: 600 } };
    const [O] = operationMechanics(op, ends);
    expect(O.tasks.map((t) => t.kind)).toEqual(['clear', 'clear', 'reach']);
    expect(O.tasks[0].foes).toEqual(['a-1', 'a-2']);
    expect(O.tasks[1].foes).toEqual(['b']);
    expect(O.tasks[2].at).toEqual([180, 300, 12]);
    expect(() => readOperation({ groups: [{ id: 'a', kind: 'dragon', at: [0, 0] }], tasks: [{ down: 'a' }] })).toThrow(/turret, tank, walker, frame/);
  });

  it('is reached from words by both doors: the producer\'s rail and the sentence door\'s starter', () => {
    expect(nearestRails('an armored core style mech game')[0].id).toBe('warlords-of-mars');
    const C = composeGameworld({ prompt: 'an armored core style mech game', seed: 1 });
    expect(C.rail).toEqual({ from: 'warlords-of-mars', size: 'designed' });
    expect(C.intent).toEqual({ from: 'mech-action' });
    const L = pitchStart({ id: 'w', rail: { from: 'warlords-of-mars', size: 'designed', locked: true } });
    expect(L.laid.by).toBe('warlords-of-mars');
    expect(L.laid.levels).toEqual(OPERATIONS.map((o) => o.id));
  });
});
