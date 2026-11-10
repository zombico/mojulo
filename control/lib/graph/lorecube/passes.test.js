// Two kinds of pass that never do each other's work: raw-new makes the premise and stops, intensify adds rungs and
// changes none below them. Held on a toy part here, and on the polarity (the first real part) below.
import { describe, it, expect } from 'vitest';
import { PASS_KINDS, definePart, depthOf, rungOf, openOf, rawNewCeiling, checkPass } from './passes.js';
import { POLARITY, POLARITY_IDS, POLARITIES, newPolarity, intensifyPolarity, relationsOf, readPolarity } from './polarity.js';

const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));
// a toy part: a name, then a motto, then a number: three rungs, the first two a raw-new pass's
const TOY = definePart({
  id: 'toy',
  rungs: [
    { id: 'named', rawNew: true, holds: (v) => typeof v.name === 'string', view: (v) => v.name },
    { id: 'mottoed', rawNew: true, holds: (v) => typeof v.motto === 'string', open: () => ['motto'], view: (v) => v.motto },
    { id: 'numbered', holds: (v) => Number.isFinite(v.n), open: () => ['n'], view: (v) => v.n },
  ],
});

describe('a part\'s ladder', () => {
  it('is as deep as the rungs it holds from the bottom, each standing on the one before', () => {
    expect(depthOf(TOY, null)).toBe(0);
    expect(depthOf(TOY, { name: 'a' })).toBe(1);
    expect(depthOf(TOY, { name: 'a', motto: 'm', n: 3 })).toBe(3);
    // a number with no motto under it is not the third rung
    expect(depthOf(TOY, { name: 'a', n: 3 })).toBe(1);
    expect(rungOf(TOY, { name: 'a', motto: 'm' })).toBe('mottoed');
    expect(rungOf(TOY, {})).toBeNull();
  });

  it('says what the next rung up is missing, and nothing at the top', () => {
    expect(openOf(TOY, { name: 'a' })).toEqual({ rung: 'mottoed', missing: ['motto'] });
    expect(openOf(TOY, { name: 'a', motto: 'm', n: 3 })).toBeNull();
  });

  it('puts the rungs a raw-new pass may make first; its ceiling is the last of them', () => {
    expect(rawNewCeiling(TOY)).toBe(2);
    const rung = (id, rawNew) => ({ id, rawNew, holds: () => true });
    expect(() => definePart({ id: 'x', rungs: [rung('a', false)] })).toThrow(/first rung is the premise/);
    expect(() => definePart({ id: 'x', rungs: [rung('a', true), rung('b', false), rung('c', true)] })).toThrow(/come first/);
    expect(() => definePart({ id: 'x', rungs: [rung('a', true), rung('a', false)] })).toThrow(/its own id/);
    expect(() => definePart({ id: 'x', rungs: [] })).toThrow(/has rungs/);
  });
});

describe('a raw-new pass', () => {
  it('starts from nothing, makes the premise, and ends at its ceiling', () => {
    for (const l of checkPass(TOY, 'raw-new', null, { name: 'a', motto: 'm' })) expect(l.ok, l.law).toBe(true);
  });

  it('is told when it did everything: past the ceiling is an intensification\'s', () => {
    const L = by(checkPass(TOY, 'raw-new', null, { name: 'a', motto: 'm', n: 3 }));
    expect(L.ceiling.ok).toBe(false);
    expect(L.ceiling.says).toMatch(/ends at the mottoed.*went on to the numbered.*intensification/);
  });

  it('is told when there was already something, or it made nothing', () => {
    expect(by(checkPass(TOY, 'raw-new', { name: 'a' }, { name: 'b' }))['from-nothing'].says).toMatch(/already holds its named: intensify it/);
    expect(by(checkPass(TOY, 'raw-new', null, {})).made.ok).toBe(false);
  });
});

describe('an intensification', () => {
  it('needs something to deepen, goes deeper, and leaves every rung it was handed as it was', () => {
    for (const l of checkPass(TOY, 'intensify', { name: 'a' }, { name: 'a', motto: 'm', n: 3 })) expect(l.ok, l.law).toBe(true);
  });

  it('is told when it changed the premise it was handed, when it added nothing, or when there was nothing', () => {
    const moved = by(checkPass(TOY, 'intensify', { name: 'a', motto: 'm' }, { name: 'b', motto: 'm', n: 3 }));
    expect(moved.locked.ok).toBe(false);
    expect(moved.locked.says).toMatch(/changed the named/);
    expect(by(checkPass(TOY, 'intensify', { name: 'a' }, { name: 'a' })).deeper.ok).toBe(false);
    expect(by(checkPass(TOY, 'intensify', null, { name: 'a' }))['from-something'].says).toMatch(/make one first/);
  });

  it('knows its two kinds', () => {
    expect(PASS_KINDS).toEqual(['raw-new', 'intensify']);
    expect(() => checkPass(TOY, 'polish', null, {})).toThrow(/raw-new \| intensify/);
  });
});

describe('the polarity, made in passes', () => {
  // a named polarity that has stock reasons, picked from the table
  const reasoned = POLARITY_IDS.find((id) => Object.keys(POLARITIES[id].why).length);

  it('raw-new makes the premise alone: a name does no more than writing one out', () => {
    const P = newPolarity(reasoned);
    expect(P).toEqual({ id: reasoned, shape: POLARITIES[reasoned].shape, of: readPolarity(reasoned).of });
    expect(P).not.toHaveProperty('why');
    expect(depthOf(POLARITY, P)).toBe(1);
    expect(rawNewCeiling(POLARITY)).toBe(1);
    for (const l of checkPass(POLARITY, 'raw-new', null, P)) expect(l.ok, l.law).toBe(true);
    expect(() => newPolarity({ shape: 'ring', of: ['fire', 'ice', 'wind'], why: { 'fire>ice': 'melts it' } })).toThrow(/not a raw-new pass's.*next pass/);
  });

  it('a stored polarity that arrives already reasoned would be a raw-new pass doing everything, and is told', () => {
    const all = readPolarity(reasoned);
    expect(depthOf(POLARITY, all)).toBe(2);
    expect(by(checkPass(POLARITY, 'raw-new', null, all)).ceiling.ok).toBe(false);
  });

  it('says which relations are still unreasoned', () => {
    const P = newPolarity({ shape: 'ring', of: ['fire', 'ice', 'wind'] });
    expect(relationsOf(P)).toEqual(['fire>ice', 'ice>wind', 'wind>fire']);
    expect(openOf(POLARITY, P)).toEqual({ rung: 'reasoned', missing: ['fire>ice', 'ice>wind', 'wind>fire'] });
  });

  it('intensify lays the reasons over the premise and never touches it; partly done says what is left', () => {
    const P = newPolarity({ shape: 'ring', of: ['fire', 'ice', 'wind'] });
    const half = intensifyPolarity(P, { why: { 'fire>ice': 'melts it' } });
    expect(half.open).toEqual(['ice>wind', 'wind>fire']);
    expect(depthOf(POLARITY, half.polarity)).toBe(1);
    const done = intensifyPolarity(half.polarity, { why: { 'ice>wind': 'stills it', 'wind>fire': 'blows it out' } });
    expect(done.open).toEqual([]);
    expect(done.polarity.why['fire>ice']).toBe('melts it');
    for (const l of checkPass(POLARITY, 'intensify', P, done.polarity)) expect(l.ok, l.law).toBe(true);
    expect(() => intensifyPolarity(P, { why: { 'fire>wind': 'no' } })).toThrow(/no relation of this polarity/);
    expect(() => intensifyPolarity({ why: {} })).toThrow(/one already made/);
  });

  it('a named polarity\'s stock reasons come at the intensification, under the ones given; or are left out', () => {
    const P = newPolarity(reasoned), key = Object.keys(POLARITIES[reasoned].why)[0];
    expect(intensifyPolarity(P).polarity.why).toEqual(POLARITIES[reasoned].why);
    expect(intensifyPolarity(P, { why: { [key]: 'my own reason' } }).polarity.why[key]).toBe('my own reason');
    expect(intensifyPolarity(P, { stock: false }).polarity.why).toEqual({});
    expect(intensifyPolarity(P, { stock: false }).open).toEqual(relationsOf(P));
  });

  it('a pass that swaps an element while reasoning is told the premise moved', () => {
    const P = newPolarity({ shape: 'ring', of: ['fire', 'ice', 'wind'] });
    const swapped = { shape: 'ring', of: ['fire', 'ice', 'earth'], why: { 'fire>ice': 'a', 'ice>earth': 'b', 'earth>fire': 'c' } };
    expect(by(checkPass(POLARITY, 'intensify', P, swapped)).locked.says).toMatch(/changed the premise/);
  });
});
