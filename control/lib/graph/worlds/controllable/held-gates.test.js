import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';

// HELD GATES (held-gates.js): a gate holds the body out until what opens it is held, then opens as the body comes to it;
// a relic is picked up where the body comes near and gives its token and its rule; a boss struck down gives what it
// gives; what is gone is no ground; a page without held gates carries none of it.

const E = composeLive();
const GATE = { id: 'gate-a', min: [3, -2, 0], max: [3.6, 2, 2.6] };
const LID = { id: 'gate-lid', min: [-1, -1, -0.6], max: [1, 1, 0] };
const world = (held, breakables = [GATE], pos = [1, 0, 0]) => E.createWorld({
  breakables, heldGates: held,
  entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [...pos], heading: 0 } }],
});
const run = (w, input, n, ground = () => 0) => { for (let k = 0; k < n; k++) E.stepWorld(w, input, 1 / 60, { ground }); return w; };

describe('held gates', () => {
  it('hold the body out until what opens them is held, then open as it comes to them', () => {
    const shut = run(world({ target: 'hero', gates: [{ id: 'gate-a', kind: 'key', opens: 'key:0' }] }), { forward: 1 }, 120);
    expect(shut.byId.hero.transform.pos[0]).toBeLessThan(GATE.min[0]);
    expect(shut.breakables[0].broken).toBeFalsy();
    const w = world({ target: 'hero', gates: [{ id: 'gate-a', kind: 'key', opens: 'key:0' }], relics: [{ id: 'relic-key', at: [2, 0, 1], gives: 'key:0', name: 'the key' }] });
    run(w, { forward: 1 }, 120);
    expect(w.heldGates.held['key:0']).toBeDefined();
    expect(w.breakables[0].broken).toBeTruthy();
    expect(w.byId.hero.transform.pos[0]).toBeGreaterThan(GATE.max[0]);
    // (the relic taken and the gate opened go on the break list, the page hiding each by its group)
    expect(w.breaks.map((b) => b.id)).toEqual(['relic-key', 'gate-a']);
    expect(w.heldGates.got.map((g) => g.name)).toEqual(['the key']);
  });

  it('give a relic\'s rule to the body that takes it: a power\'s move', () => {
    const w = world({ target: 'hero', relics: [{ id: 'leap', at: [2, 0, 1], gives: 'gate:double-jump', rule: { airJumps: 1 } }] }, []);
    expect(w.byId.hero.rule.airJumps ?? 0).toBe(0);
    run(w, { forward: 1 }, 30);
    expect(w.byId.hero.rule.airJumps).toBe(1);
  });

  it('keep a cracked wall standing every blow until its power is held, and a boss stand-in gives as it falls', () => {
    const w = world({ target: 'hero', gates: [{ id: 'gate-a', kind: 'wall-break', opens: 'gate:wall-break', hp: 2 }], bosses: [{ id: 'boss-x', gives: ['boss:x', 'gate:wall-break'], name: 'the warden falls' }] }, [GATE, { id: 'boss-x', min: [-4, -1, 0], max: [-3, 1, 3], hp: 2 }]);
    for (let k = 0; k < 4; k++) E.breakBlock(w, 'gate-a', 1);
    run(w, {}, 2);
    expect(w.breakables[0].broken).toBeFalsy();
    E.breakBlock(w, 'boss-x', 2);
    run(w, {}, 2);
    expect(w.heldGates.held['gate:wall-break']).toBeDefined();
    for (let k = 0; k < 2; k++) E.breakBlock(w, 'gate-a', 1);
    expect(w.breakables[0].broken).toBeTruthy();
  });

  it('take what is gone off the ground: a hatch opened is fallen through', () => {
    // (the ground: the lid's top where it stands, the floor under it 3 m down)
    const ground = (q) => (q[2] >= 0 && Math.abs(q[0]) <= 1 && Math.abs(q[1]) <= 1 ? 0 : -3);
    const w = world({ target: 'hero', gates: [{ id: 'gate-lid', kind: 'boss', opens: 'boss:x' }] }, [LID], [0, 0, 0]);
    run(w, {}, 30, ground);
    expect(w.byId.hero.transform.pos[2]).toBeCloseTo(0, 1);
    w.heldGates.held['boss:x'] = w.time;
    run(w, {}, 90, ground);
    expect(w.breakables[0].broken).toBeTruthy();
    expect(w.byId.hero.transform.pos[2]).toBeLessThan(-2.5);
  });

  it('a page without held gates carries none of it', () => {
    expect(emissionSource({})).not.toContain('stepWithHeldGates');
    expect(emissionSource({ heldGates: true })).toContain('stepWithHeldGates');
  });
});
