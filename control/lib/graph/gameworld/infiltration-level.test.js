import { describe, it, expect } from 'vitest';
import { readInfiltration, infiltrationStage, infiltrationEnds, infiltrationMechanics, infiltrationCast, INFILTRATION } from './infiltration-level.js';

// THE INFILTRATION LEVEL: a stealth level's words read, its ground, its tasks and its cast laid
const G = { id: 'steel-serpents', name: 'Steel Serpents', feel: 'steel-serpents' };
const SPEC = {
  ground: { half: 16 }, start: [0, -13], exit: { at: [0, 14], text: 'Up the stair, unseen' },
  cover: [{ id: 'crates', at: [3, -4], size: [2, 1.2, 1] }],
  guards: [{ id: 'dock-1', kind: 'patrol', at: [-8, 2], to: [8, 2], look: { secs: 2 } }, { id: 'dock-2', kind: 'post', at: [6, 10], facing: [0, 10], range: 12 }],
  alarm: { found: 20 }, backup: { count: 2, from: [0, 15] },
  tasks: [{ take: [10, -2], text: 'The control room\'s terminal' }, { act: 'scene-end:terminal-1' }],
};

describe('the infiltration level', () => {
  it('reads its words, and teaches what is wrong', () => {
    const P = readInfiltration(SPEC);
    expect(P.half).toBe(16);
    expect(P.guards.map((g) => g.kind)).toEqual(['patrol', 'post']);
    expect(P.tasks.map((t) => t.kind)).toEqual(['take', 'act']);
    expect(() => readInfiltration({ ...SPEC, start: [0, 30] })).toThrow(/off the floor/);
    expect(() => readInfiltration({ ...SPEC, guards: [{ id: 'g', kind: 'wander', at: [0, 0] }] })).toThrow(/patrol/);
    expect(() => readInfiltration({ ...SPEC, extra: 1 })).toThrow(/not part of an infiltration level/);
  });

  it('lays its floor and cover, and ends at the way on after its tasks', () => {
    const P = readInfiltration(SPEC);
    const S = infiltrationStage(G, P);
    expect(S.colliders.some((c) => c.min[0] === 2 && c.max[2] === 1)).toBe(true);   // (the crates: a box a crouch hides behind)
    const E = infiltrationEnds(P);
    expect(E.spawn).toEqual([0, -13, 0]);
    expect(E.exit).toEqual([0, 14, 0]);
    const [O] = infiltrationMechanics(P);
    expect(O.kind).toBe('objectives');
    expect(O.tasks.map((t) => t.kind)).toEqual(['take', 'act', 'reach']);
    expect(O.tasks.at(-1).text).toBe('Up the stair, unseen');
  });

  it('stands the operative at its start and each guard on its round, the garrison alarmed, the backup asleep', () => {
    const P = readInfiltration(SPEC);
    const C = infiltrationCast(G, P);
    const hero = C.entities.find((e) => e.id === 'hero');
    expect(hero.transform.pos.slice(0, 2)).toEqual([0, -13]);
    for (const k of ['stance', 'takedown', 'knockout', 'ledge', 'dive']) expect(hero.rule[k]).toBeTruthy();
    const d1 = C.entities.find((e) => e.id === 'dock-1'), d2 = C.entities.find((e) => e.id === 'dock-2');
    expect(d1.rule.speed).toBe(INFILTRATION.speed);
    expect(d1.rule.foe.ends.map((p) => p.slice(0, 2))).toEqual([[-8, 2], [8, 2]]);
    expect(d2.rule.speed).toBe(0);
    expect(d2.rule.sightRange).toBe(12);
    expect(d1.rule.alarm).toMatchObject({ found: 20, backup: ['backup-1', 'backup-2'] });
    expect(C.entities.filter((e) => e.dormant).map((e) => e.id)).toEqual(['backup-1', 'backup-2']);
    // (the yard's targets and its own guard left out)
    expect(C.entities.some((e) => /^target|^guard-1$/.test(e.id))).toBe(false);
  });
});

// A LEVEL'S OWN FORM (world.js `levels.<id>.infiltration`, levels.js): read with the world, laid as one stage, its pilot
// the operative and its goal its tasks, the game's contract on it as on every designed level
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';

const WORLD = { id: 'jericho', name: 'Hidden Jericho', seed: 3, style: { kit: 'trail-valley' }, feel: 'steel-serpents', start: 'dock', levels: { dock: { name: 'The hangar dock', opening: { title: 'Hidden Jericho', chapter: { label: 'Prologue' } }, infiltration: SPEC } } };
const order = (W) => { const G = readGameworld(W), st = gameStages(W)[0]; return { G, st, L: stageLevelOrder(G, st, { ref: 'jericho-level-dock-0' }) }; };

describe('an infiltration level in a designed game', () => {
  it('is read with the world, and refused beside another form', () => {
    expect(readGameworld(WORLD).levels.dock.infiltration).toBeTruthy();
    expect(() => readGameworld({ ...WORLD, levels: { dock: { infiltration: SPEC, walk: { nodes: { a: { trail: true } } } } } })).toThrow(/an infiltration level is its ground/);
    expect(() => readGameworld({ ...WORLD, levels: { dock: { infiltration: { ...SPEC, start: [0, 99] } } } })).toThrow(/levels\.dock.*off the floor/);
  });

  it('is one stage, its operative piloted, its guards on their rounds, its tasks the game\'s objectives, its opening on the page', () => {
    const { st, L } = order(WORLD), m = L.args.manifest;
    expect(st.section).toBe('infiltration');
    const hero = m.entities.find((e) => e.id === 'hero');
    expect(hero.pilotable ?? true).toBeTruthy();
    expect(hero.rule.stance).toBeTruthy();
    expect(m.entities.filter((e) => /^dock-/.test(e.id)).length).toBe(2);
    expect(m.game.levelRef).toBe('jericho-level-dock-0');
    const O = m.game.mechanics.find((x) => x.kind === 'objectives');
    expect(O.tasks.map((t) => t.kind)).toEqual(['take', 'act', 'reach']);
    expect(m.game.opening).toMatchObject({ title: 'Hidden Jericho', chapter: { label: 'Prologue', name: 'The hangar dock' } });
  });
});

describe('an infiltration level\'s radio', () => {
  it('lays its script\'s calls for the call screen and raises each at its moment on the bus', () => {
    const script = { speakers: { coral: { name: 'Coral' }, chandler: { name: 'Chandler' } }, calls: [
      { id: 'signal', on: 'start', from: 'chandler', lines: [{ id: 'sg-1', who: 'coral', text: '... This is Coral.' }, { id: 'sg-2', who: 'chandler', text: 'Just testing the signal.' }] },
      { id: 'spotted', on: { event: 'alarm:found' }, lines: [{ id: 'sp-1', who: 'chandler', text: 'Hide.' }] }] };
    const { L } = order({ ...WORLD, levels: { dock: { ...WORLD.levels.dock, script } } }), m = L.args.manifest;
    expect(Object.keys(m.calls.calls)).toEqual(['signal', 'spotted']);
    expect(m.events.sequences.filter((q) => q.id.startsWith('call:')).map((q) => q.trigger)).toEqual([{ on: 'objective:begin', task: 't1' }, { on: 'alarm:found' }]);
    // (a script's moment past the level's tasks is refused with the world)
    expect(() => readGameworld({ ...WORLD, levels: { dock: { ...WORLD.levels.dock, script: { calls: [{ ...script.calls[0], on: { begin: 9 } }] } } } })).toThrow(/levels\.dock\.script.*task, 1 to 3/);
  });
});
