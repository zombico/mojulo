// A foe's base states (foes/states.js): born under a status its look draws on whatever body it wears, its element only
// when it says so; a body born alight burns in the fire channel (playscape/elements/body-fire.js) and chars only where a
// source asks it to; no foe is listed for a state.
import { describe, it, expect } from 'vitest';
import { FOE_STATES, FLAME_COLORS, readStates, stateBirth } from './states.js';
import { readBestiary } from '../gameworld/foes.js';
import { bodyFires } from '../playscape/elements/body-fire.js';
import { LOOKS } from '../playscape/elements/elements.js';
import { fireChannelScript } from '../scene/channels/fire.js';

const name = Object.keys(FOE_STATES)[0], S = FOE_STATES[name];

describe('a foe born in a state', () => {
  it('carries its state\'s status from the world clock\'s start, its element only when the state is elemental', () => {
    expect(LOOKS[S.status]).toBeDefined();
    const plain = stateBirth(readStates({ [name]: true }, 's'));
    expect(plain.statuses[S.status]).toMatchObject({ t0: 0, until: null, char: S.char });
    expect(plain.element).toBeUndefined();
    const el = stateBirth(readStates({ [name]: { elemental: true, color: 'blue', char: 0.5 } }, 's'));
    expect(el.element).toBe(S.element);
    expect(el.statuses[S.status]).toMatchObject({ color: FLAME_COLORS.blue, char: 0.5 });
  });
  it('the runtime gives a body what it is born with at its first step', async () => {
    const { composeLive } = await import('../worlds/controllable/compose.js');
    const E = composeLive(), born = stateBirth(readStates({ [name]: { elemental: true } }, 's'));
    const st = E.createWorld({ entities: [{ id: 'f', team: 'foes', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 5, vanish: { is: 'fade', linger: 1 }, born }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    E.stepWorld(st, {}, 1 / 30, { ground: () => 0 });
    expect(st.byId.f.statuses[S.status]).toMatchObject({ t0: 0 });
    expect(st.byId.f.element).toBe(S.element);
  });
  it('the words are refused by name, and a bestiary entry takes them', () => {
    expect(() => readStates({ glowing: true }, 's')).toThrow(/not a state/);
    expect(() => readStates({ [name]: { color: 'mauve' } }, 's')).toThrow(/a flame's colour/);
    expect(() => readStates({ [name]: { elemental: 'yes' } }, 's')).toThrow(/elemental is true/);
    expect(readBestiary({ a: { class: 'walker', states: { [name]: true } } }).a.states).toEqual({ [name]: {} });
  });
  it('a body born under a burning look is one fire it carries, charring where it asks to; none, no char', () => {
    const born = { id: 'f', body: { type: 'mesh', born: stateBirth(readStates({ [name]: { color: 'green' } }, 's')) } };
    const [F] = bodyFires(undefined, [born]);
    expect(F).toMatchObject({ follow: 'f', el: S.status, color: FLAME_COLORS.green, char: S.char });
    expect(bodyFires(undefined, [{ id: 'g' }])).toEqual([]);
    const src = { kind: 'campfire', at: [0, 0, 0], D: 1, L: 1, n: 1, lam: 1, light: 1, embers: 1, smoke: 1, soot: 1, phi: 1, baked: false, seed: 1, follow: 'f', el: S.status, key: '', rise: 0 };
    expect(fireChannelScript({ sources: [src] })).not.toMatch(/__fireChar/);
    expect(fireChannelScript({ sources: [{ ...src, char: S.char }] })).toMatch(/__fireChar\(s\.follow, s\.char\)/);
    // its fire stands where the state says up a body of a given height (flaming: at the chest), and only a page with such
    // a fire carries the reading of it
    const tall = stateBirth(readStates({ [name]: true }, 's'), { height: 2 }).statuses[S.status];
    expect(tall.fires.map((f) => f.lift)).toEqual(S.fires.map(([at]) => Math.round(at * 2 * 1000) / 1000));
    // a column: one fire each, up the body, the widest in the middle
    const C = bodyFires(undefined, [{ id: 'f', body: { type: 'mesh', born: { statuses: { [S.status]: tall } } } }]);
    expect(C.map((x) => x.lift)).toEqual(tall.fires.map((f) => f.lift));
    expect(C.every((x) => x.follow === 'f' && x.el === S.status)).toBe(true);
    const widest = C.reduce((b, x, i) => (x.size > C[b].size ? i : b), 0);
    expect(widest).toBeGreaterThan(0); expect(widest).toBeLessThan(C.length - 1);
    expect(fireChannelScript({ sources: [src] })).not.toMatch(/s\.lift/);
    expect(fireChannelScript({ sources: [{ ...src, lift: 1.3 }] })).toMatch(/s\.lift != null \? s\.lift/);
  });
});
