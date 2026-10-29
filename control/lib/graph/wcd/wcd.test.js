// The walled-core dungeon's recipe and its principles (wcd.js). One fixture per shape the laws read: a stack (a stealth
// base: an outer, an inner, the core, each deeper), a lattice (two inners off one outer, a one-way shortcut back out),
// and a stack with an unbuilt layer. Malformed recipes are refused by name; the principles advise and never refuse.
import { describe, expect, it } from 'vitest';
import { readWcd, WCD_PRINCIPLES } from './wcd.js';

const lawOf = (W, id) => W.laws.find((l) => l.law === id);
const looks = { hangar: { construction: 'military', palette: 'military' }, barracks: { construction: 'everyday', palette: 'military' }, plant: { construction: 'utility', palette: 'science' } };
// the stack: a hangar bay (outer) → a lift down to the barracks (inner) → a teleporter to the core's plant
const STACK = {
  core: 'plant',
  spaces: {
    hangar: { kind: 'outer', depth: 0, level: 'base', look: looks.hangar },
    barracks: { kind: 'inner', depth: 1, level: 'base', look: looks.barracks },
    plant: { kind: 'inner', depth: 2, level: 'base', look: looks.plant },
  },
  doors: [
    { from: 'hangar', to: 'barracks', via: 'lift', gate: { clearance: 1 } },
    { from: 'barracks', to: 'plant', via: 'teleporter', gate: { clearance: 2 } },
  ],
};

describe('a walled-core dungeon read', () => {
  it('a stack: its critical path runs outer to core, and every principle holds', () => {
    const W = readWcd(STACK, { levels: ['base'] });
    expect(W.path).toEqual(['hangar', 'barracks', 'plant']);
    expect(W.unbuilt).toEqual([]);
    for (const l of W.laws) expect(l.holds, `${l.law}: ${l.says}`).toBe(true);
    // every principle is a law the read reports
    expect(W.laws.map((l) => l.law).sort()).toEqual(Object.keys(WCD_PRINCIPLES).sort());
  });

  it('a lattice: a one-way shortcut back out is no way in', () => {
    const W = readWcd({
      core: 'east',
      spaces: { yard: { kind: 'outer', depth: 0 }, west: { kind: 'inner', depth: 1 }, east: { kind: 'inner', depth: 2 } },
      doors: [
        { from: 'yard', to: 'west', via: 'door', gate: { power: 'grapple' } },
        { from: 'yard', to: 'east', via: 'door', gate: { clearance: 3 }, oneWay: true },
        { from: 'east', to: 'yard', via: 'stair', oneWay: true },
      ],
    });
    expect(W.path).toEqual(['yard', 'east']);
    expect(lawOf(W, 'gated').holds).toBe(true);
    // (no space names a look: the distinction is unread, not failed)
    expect(lawOf(W, 'distinct')).toMatchObject({ holds: true, says: expect.stringMatching(/name a look/) });
  });

  it('an unbuilt layer is on the path and named', () => {
    const W = readWcd({ ...STACK, spaces: { ...STACK.spaces, barracks: { ...STACK.spaces.barracks, built: false } } });
    expect(W.path).toEqual(['hangar', 'barracks', 'plant']);
    expect(W.unbuilt).toEqual(['barracks']);
  });
});

describe('the principles advise', () => {
  it('each law says what breaks it', () => {
    const W = readWcd({
      core: 'yard',
      spaces: { gate: { kind: 'outer', depth: 0, look: looks.hangar, level: 'a' }, yard: { kind: 'outer', depth: 0, look: looks.hangar, level: 'b' } },
      doors: [{ from: 'gate', to: 'yard', via: 'teleporter' }],
    });
    expect(lawOf(W, 'core-inner').holds).toBe(false);
    expect(lawOf(W, 'deeper')).toMatchObject({ holds: false, says: "the core 'yard' is an outermost space: nothing lies before it" });
    const flat = readWcd({ ...STACK, spaces: { ...STACK.spaces, plant: { ...STACK.spaces.plant, depth: 1 } } });
    expect(lawOf(flat, 'deeper')).toMatchObject({ holds: false, says: 'barracks → plant does not go deeper' });
    // (an outer past the outermost that joins one space binds nothing)
    const spur = readWcd({ ...STACK, spaces: { ...STACK.spaces, depot: { kind: 'outer', depth: 1 } }, doors: [...STACK.doors, { from: 'hangar', to: 'depot', via: 'door', gate: { clearance: 1 } }] });
    expect(lawOf(spur, 'outers-bind')).toMatchObject({ holds: false, says: 'depot joins fewer than two spaces' });
    expect(lawOf(W, 'distinct')).toMatchObject({ holds: false, says: expect.stringMatching(/same construction and palette/) });
    expect(lawOf(W, 'same-level')).toMatchObject({ holds: false, says: expect.stringMatching(/teleporter gate \(a\) → yard \(b\)/) });
    const open = readWcd({ ...STACK, doors: [{ ...STACK.doors[0], gate: undefined }, STACK.doors[1]] });
    expect(lawOf(open, 'gated')).toMatchObject({ holds: false, says: 'hangar → barracks names no gate' });
    const cut = readWcd({ ...STACK, doors: [STACK.doors[0]] });
    expect(cut.path).toBeNull();
    expect(lawOf(cut, 'deeper')).toMatchObject({ holds: false, says: "no way in reaches the core 'plant'" });
  });
});

describe('a malformed recipe is refused by name', () => {
  it('names the word and its list', () => {
    expect(() => readWcd({ ...STACK, rings: 3 })).toThrow(/wcd: 'rings' is not a setting/);
    expect(() => readWcd({ ...STACK, core: 'vault' })).toThrow(/core is one of the spaces/);
    expect(() => readWcd({ ...STACK, spaces: { ...STACK.spaces, hangar: { ...STACK.spaces.hangar, kind: 'ring' } } })).toThrow(/kind is inner or outer/);
    expect(() => readWcd({ ...STACK, doors: [{ from: 'hangar', to: 'barracks', via: 'zipline' }] })).toThrow(/via is lift, teleporter, door, stair/);
    expect(() => readWcd({ ...STACK, doors: [{ from: 'hangar', to: 'vault', via: 'door' }] })).toThrow(/to 'vault' is not a space/);
    expect(() => readWcd({ ...STACK, doors: [{ ...STACK.doors[0], gate: { clearance: 12 } }] })).toThrow(/gate.clearance is a whole number, 1 to 9/);
    expect(() => readWcd(STACK, { levels: ['other'] })).toThrow(/level 'base' is not a level of the world/);
    expect(() => readWcd({ ...STACK, spaces: { ...STACK.spaces, hangar: { ...STACK.spaces.hangar, use: 'casino' } } })).toThrow(/use 'casino' is not a building use/);
  });
});

describe('on a design_game world', () => {
  it("read with the world's levels; refused there by name; absent, the world is as it was", async () => {
    const { readGameworld, MEADOWMARK } = await import('../gameworld/index.js');
    const level = Object.keys(MEADOWMARK.levels)[0];
    const at = (S) => Object.fromEntries(Object.entries(S).map(([id, s]) => [id, { ...s, level }]));
    const G = readGameworld({ ...MEADOWMARK, wcd: { ...STACK, spaces: at(STACK.spaces) } });
    expect(G.wcd.path).toEqual(['hangar', 'barracks', 'plant']);
    expect(() => readGameworld({ ...MEADOWMARK, wcd: STACK })).toThrow(/gameworld: wcd: spaces.hangar.level 'base' is not a level of the world/);
    expect('wcd' in readGameworld(MEADOWMARK)).toBe(false);
  });
});
