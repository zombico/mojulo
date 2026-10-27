// Disposal's laws (vanish.js): a downed body that vanishes lies where it fell for its linger, then goes (out of the
// world, handed to the page's transit with its kind and colour); a downed body without one stays down; the builder is
// emitted only into a page whose world has a body that vanishes, and a world without one steps as the engine without it.
import { describe, it, expect } from 'vitest';
import { composeLive, composeControllable, EMISSION, emissionSource } from './compose.js';
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';

const E = composeLive();
const DT = 1 / 30;
const body = (id, pos, vanish) => ({ id, team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 20, ...(vanish ? { vanish } : {}) }, transform: { pos, heading: 0 } });
const run = (st, n) => { for (let i = 0; i < n; i++) E.stepWorld(st, {}, DT, { ground: () => 0 }); return st; };

describe('a downed body goes', () => {
  it('it lies for its linger, then goes, its transit out of its kind and colour', () => {
    const st = E.createWorld({ entities: [body('a', [0, 0, 0], { is: 'motes', linger: 0.5, rgb: [0.2, 0.6, 0.5] }), body('b', [4, 0, 0])] });
    run(st, 2);
    st.byId.a.downed = true; st.byId.b.downed = true;
    run(st, 12);   // 0.4 s: still lying
    expect(st.byId.a.gone).toBeFalsy();
    run(st, 4);
    const a = st.byId.a;
    expect(a.gone).toBe(true);
    expect(a.transit).toMatchObject({ is: 'motes', dir: 'out', rgb: [0.2, 0.6, 0.5] });
    expect(a.transit.t0).toBeGreaterThan(0.45);
    // no vanish: a carcass, as before
    expect(st.byId.b.gone).toBeFalsy();
    expect(st.byId.b.transit).toBeUndefined();
  });
  it('it never explodes (the suit\'s death burst is a mecha\'s), where a body without one still does', () => {
    const st = E.createWorld({ entities: [body('a', [0, 0, 0], { is: 'fade', linger: 1 }), body('b', [9, 0, 0])] });
    run(st, 1);
    st.byId.a.downed = true; st.byId.b.downed = true;
    run(st, 2);
    expect((st.bursts || []).map((u) => u.pos[0])).toEqual([9]);
  });
  it('a standing body never goes, and a zero linger goes at once', () => {
    const st = E.createWorld({ entities: [body('a', [0, 0, 0], { is: 'blink', linger: 0 }), body('c', [3, 0, 0], { is: 'fade', linger: 0 })] });
    st.byId.a.downed = true;
    run(st, 1);
    expect(st.byId.a.gone).toBe(true);
    expect(st.byId.c.gone).toBeFalsy();
  });
});

describe('an action game\'s death: the blow is the verb', () => {
  it('it is thrown back along the blow, off the ground, and lies where it lands; its linger counts from there', () => {
    const st = E.createWorld({ entities: [body('hero', [0, 0, 0]), body('a', [1, 0, 0], { is: 'fade', linger: 0.2, die: 'launch' })] });
    run(st, 1);
    st.byId.a.downed = true; st.byId.a.lastHitBy = 'hero';
    let top = 0;
    for (let i = 0; i < 6; i++) { run(st, 1); top = Math.max(top, st.byId.a.transform.pos[2]); }
    expect(top).toBeGreaterThan(0.1);   // off the ground
    run(st, 12);
    const a = st.byId.a;
    expect(a.transform.pos[0]).toBeGreaterThan(2);   // away from the hero, along the blow
    expect(Math.abs(a.transform.pos[1])).toBeLessThan(1e-9);
    expect(a.vanishThrow.landed).toBe(true);
    expect(a.transform.pos[2]).toBe(0);
    run(st, 20);
    expect(a.gone).toBe(true);
  });
});

describe('the opt-in', () => {
  it('a world without a vanishing body steps as the engine without it', () => {
    const plain = composeControllable(EMISSION), spec = { entities: [body('a', [0, 0, 0]), body('b', [3, 0, 0])] };
    const a = E.createWorld(spec), b = plain.createWorld(spec);
    a.byId.a.downed = true; b.byId.a.downed = true;
    for (let i = 0; i < 60; i++) { E.stepWorld(a, {}, DT, { ground: () => 0 }); plain.stepWorld(b, {}, DT, { ground: () => 0 }); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('is emitted only into a page whose world has one', () => {
    expect(emissionSource()).not.toContain('buildVanish');
    expect(controllableChannelScript([body('a', [0, 0, 0])], null, {})).not.toContain('stepWithVanish');
    expect(controllableChannelScript([body('a', [0, 0, 0], { is: 'fade', linger: 1 })], null, {})).toContain('stepWithVanish');
  });
});
