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

  it('fill the body in a save room and wake it there, full and keeping all it holds, when its health is spent', () => {
    const saves = [{ id: 'gate', name: 'the gate', rect: [-2, 2, -1, 5], at: [0, 0] }, { id: 'hall', name: 'the hall', rect: [6, 10, -1, 5], at: [8, 0] }];
    const w = E.createWorld({ heldGates: { target: 'hero', saves, relics: [{ id: 'key', at: [0, 4, 1], gives: 'key:0', name: 'the key' }] },
      // (walking the box's way: along its lane, +y, as a box's hero runs)
      entities: [{ id: 'hero', pilotable: true, hpMax: 50, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7, moveset: { moves: {}, mp: { max: 20, regen: 0 } } }, body: { type: 'mesh', hittable: true, hp: 50 }, transform: { pos: [0, 0, 0], heading: Math.PI / 2 } }] });
    const H = w.byId.hero;
    // (it wakes in the first save room before it has stood in any)
    expect(w.heldGates.save).toBe('gate');
    H.body.hp = 12; H.mp = 3;
    run(w, { forward: 1 }, 150);   // past the key, into the hall
    expect(w.heldGates.held['key:0']).toBeDefined();
    expect(w.heldGates.save).toBe('hall');
    expect(H.body.hp).toBe(50); expect(H.mp).toBe(20);
    expect(w.heldGates.got.some((g) => g.kind === 'save')).toBe(true);
    // (spent: it wakes in the hall, full, the key still held: no life lost, nothing taken back)
    run(w, { forward: 1 }, 60);
    H.body.hp = 0; H.mp = 0;
    run(w, {}, 2);
    expect(H.transform.pos[1]).toBeCloseTo(8, 0);
    expect(H.body.hp).toBe(50); expect(H.mp).toBe(20); expect(H.downed).toBe(false);
    expect(w.heldGates.deaths).toBe(1);
    expect(w.heldGates.held['key:0']).toBeDefined();
  });

  it('shut a boss\'s room behind the body while its boss stands, open it as it falls, and put a lost fight back whole', () => {
    const saves = [{ id: 'gate', name: 'the gate', rect: [-2, 2, -1, 5], at: [0, 0] }];
    const shut = [{ min: [-1.5, 6, 0], max: [1.5, 6.5, 3], is: 'bar' }, { min: [-1.5, 15.5, 0], max: [1.5, 16, 3], is: 'bar' }];
    const w = E.createWorld({ heldGates: { target: 'hero', saves, bosses: [{ id: 'boss-r', entity: 'boss-r', gives: ['boss:r'], name: 'the warden falls', title: 'The warden', room: [6, 16, -1, 5], shut }] },
      entities: [{ id: 'hero', pilotable: true, hpMax: 50, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 50 }, transform: { pos: [0, 3, 0], heading: Math.PI / 2 } },
        { id: 'boss-r', team: 'foes', body: { type: 'mesh', hittable: true, hp: 40 }, transform: { pos: [0, 14, 0], heading: -Math.PI / 2 } }] });
    const H = w.byId.hero, boss = w.byId['boss-r'], G = w.heldGates, walls = () => w.colliders.filter((c) => c.of === 'boss-shut:boss-r').length;
    run(w, { forward: 1 }, 20);
    expect(G.fight).toBe(null);   // (in its doorway, not yet in)
    run(w, { forward: 1 }, 40);
    expect(G.fight).toBe('boss-r');
    expect(walls()).toBe(2);
    // (shut in: on along the lane she is held at the far bar)
    run(w, { forward: 1 }, 180);
    expect(H.transform.pos[1]).toBeLessThan(15.5);
    // (a fight lost: the room opens, she wakes at the save, and the boss is back where it stood, whole)
    boss.body.hp = 7; boss.transform.pos = [0, 9, 0];
    H.body.hp = 0;
    run(w, {}, 2);
    expect(G.fight).toBe(null);
    expect(walls()).toBe(0);
    expect(boss.body.hp).toBe(40);
    expect(boss.transform.pos[1]).toBe(14);
    // (back in, and the boss felled: the bars lifted, what it gives given)
    run(w, { forward: 1 }, 100);
    expect(G.fight).toBe('boss-r');
    boss.downed = true;
    run(w, {}, 2);
    expect(G.fight).toBe(null);
    expect(walls()).toBe(0);
    expect(G.held['boss:r']).toBeDefined();
    // (felled, it never shuts its room again)
    run(w, { forward: 1 }, 60);
    expect(G.fight).toBe(null);
  });

  it('a fight lost against a boss of two forms puts it back into its first, whole', () => {
    const saves = [{ id: 'gate', name: 'the gate', rect: [-2, 2, -1, 5], at: [0, 0] }];
    const w = E.createWorld({ heldGates: { target: 'hero', saves, bosses: [{ id: 'boss-r', entity: 'boss-r', gives: ['boss:r'], room: [6, 16, -1, 5], shut: [{ min: [-1.5, 6, 0], max: [1.5, 6.5, 3], is: 'bar' }] }] },
      entities: [{ id: 'hero', pilotable: true, hpMax: 50, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 50 }, transform: { pos: [0, 3, 0], heading: Math.PI / 2 } },
        { id: 'boss-r', team: 'foes', rule: { type: 'static', collideHeight: 2.6 }, body: { type: 'figure-rig', figure: 'woman', hittable: true, hp: 40, egg: { a: 0.6, c: 1.3, cz: 1.3 }, radius: 0.5,
          modes: [{ figure: 'woman', hp: 40 }, { figure: 'beast', hp: 60, body: { egg: { a: 0.9, c: 1.8, cz: 1.8 }, radius: 0.7 }, rule: { collideHeight: 3.6 } }] }, transform: { pos: [0, 14, 0], heading: -Math.PI / 2 } }] });
    const H = w.byId.hero, boss = w.byId['boss-r'], G = w.heldGates;
    run(w, { forward: 1 }, 60);
    expect(G.fight).toBe('boss-r');
    // (cut down into its second form)
    boss.downed = true; boss.body.hp = 0;
    run(w, {}, 2);
    expect(boss.body.figure).toBe('beast'); expect(boss.rule.collideHeight).toBe(3.6);
    expect(G.held['boss:r']).toBeUndefined();   // (its first form cut down is not its fall)
    // (the fight lost: back in its first, its rule, its size, its health)
    H.body.hp = 0;
    run(w, {}, 2);
    expect(G.fight).toBe(null);
    expect(boss.body.figure).toBe('woman'); expect(boss.modeIdx).toBe(0);
    expect(boss.rule.collideHeight).toBe(2.6); expect(boss.body.egg).toEqual({ a: 0.6, c: 1.3, cz: 1.3 });
    expect(boss.body.hp).toBe(40); expect(boss.hpMax).toBe(40);
  });

  it('raises what she gains as the journey, and puts it back in the next segment as it stood, without a toast', () => {
    const H = (more) => ({ target: 'hero', gates: [{ id: 'gate-a', kind: 'key', opens: 'key:0' }], relics: [{ id: 'leap', at: [2, 0, 1], gives: 'key:0', rule: { airJumps: 1 }, name: 'the leap' }], ...more });
    const w = world(H());
    let c = E.castFacts(w, null);
    const seen = [];
    for (let k = 0; k < 120; k++) { E.stepWorld(w, { forward: 1 }, 1 / 60, { ground: () => 0 }); c = E.castFacts(w, c.prev); seen.push(...c.events.map((e) => e.type).filter((t) => t.startsWith('journey:'))); }
    expect(seen).toEqual(['journey:taken:leap', 'journey:open:gate-a']);
    // (the next segment: the relic was found beyond it, `elsewhere`; its gate is this one, carried open)
    const v = world(H({ relics: [], elsewhere: [{ id: 'leap', gives: ['key:0'], rule: { airJumps: 1 } }] }), [GATE], [1, 0, 0]);
    expect(E.carryIn(v, seen)).toBe(2);
    expect(v.heldGates.held['key:0']).toBeDefined();
    expect(v.byId.hero.rule.airJumps).toBe(1);
    expect(v.breakables[0].broken).toBeTruthy();
    expect(v.heldGates.got).toEqual([]);
    // (carried once: neither carried again nor raised again as a gain of this segment's)
    expect(E.carryIn(v, seen)).toBe(0);
    let d = E.castFacts(v, null);
    E.stepWorld(v, {}, 1 / 60, { ground: () => 0 }); d = E.castFacts(v, d.prev);
    expect(d.events.filter((e) => e.type.startsWith('journey:'))).toEqual([]);
  });

  it('carries a boss felled in another visit as gone, its seal open and its gifts held', () => {
    const w = E.createWorld({ breakables: [], heldGates: { target: 'hero', bosses: [{ id: 'boss-x', entity: 'warden', gives: ['boss:x'], rule: { dash: true } }] },
      entities: [{ id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5.8, eye: 0, collideRadius: 0.3, collideHeight: 1.7 }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: [0, 0, 0] } },
        { id: 'warden', team: 'foes', rule: { type: 'walk' }, body: { type: 'mesh', hittable: true, hp: 40 }, transform: { pos: [0, 6, 0] } }] });
    expect(E.carryIn(w, ['journey:felled:boss-x', 'journey:nonsense:x'])).toBe(1);
    expect(w.byId.warden.gone).toBe(true);
    expect(w.heldGates.felled['boss-x']).toBeDefined();
    expect(w.heldGates.held['boss:x']).toBeDefined();
    expect(w.byId.hero.rule.dash).toBe(true);
  });

  it('a page without held gates carries none of it', () => {
    expect(emissionSource({})).not.toContain('stepWithHeldGates');
    expect(emissionSource({ heldGates: true })).toContain('stepWithHeldGates');
  });
});
