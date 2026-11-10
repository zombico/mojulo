// What opposes what: one table over the studio's element vocabularies, never a copy of them.
import { describe, it, expect } from 'vitest';
import { ROOTS, ROOT_IDS, rootOf, elementHandles, POLARITIES, POLARITY_IDS, SHAPES, readPolarity, resolvePolarity, relation, affinityOf, polarityLaws } from './polarity.js';
import { ELEMENT_WORDS } from '../gameworld/element-words.js';
import { VAYO_ELEMENTS } from '../rupa/vayo-move.js';
import { ELEMENTS as RPG_ELEMENTS } from '../playscape/rpg/presets.js';
import { ELEMENT_OOZE } from '../gameworld/foe-casting.js';

// one named polarity a shape, picked from the table (the shape is the procedure; a new row runs through its shape's)
const ofShape = (shape) => POLARITY_IDS.find((id) => POLARITIES[id].shape === shape);

describe('the roots stand on the character book\'s words', () => {
  it('every element word the book knows is in exactly one root, and a root names only words the book knows', () => {
    const rooted = Object.values(ROOTS).flatMap((r) => r.words);
    expect([...rooted].sort()).toEqual(Object.keys(ELEMENT_WORDS).sort());
    expect(new Set(rooted).size).toBe(rooted.length);
  });

  it('every other table\'s elements have a root: the vayo moves\', the party RPG\'s, the casting call\'s', () => {
    for (const e of VAYO_ELEMENTS) expect(rootOf(e), `vayo ${e}`).toBe(e);
    for (const e of RPG_ELEMENTS) expect(rootOf(e), `rpg ${e}`).toBeTruthy();
    for (const e of Object.keys(ELEMENT_OOZE)) expect(rootOf(e), `ooze ${e}`).toBeTruthy();
  });

  it('a word is its root\'s; a root is its own; a word the book does not know is none', () => {
    expect(rootOf('ember')).toBe('fire');
    expect(rootOf('fire')).toBe('fire');
    expect(rootOf('metal')).toBe('metal');
    expect(rootOf('plasma')).toBeNull();
    expect(rootOf(7)).toBeNull();
  });
});

describe('elementHandles', () => {
  it('finds the same element in each table that has it, as that table says it', () => {
    // a word that is not its root's own, whose root the vayo moves shape and the RPG says in another word
    const h = elementHandles('thunder');
    expect(h).toEqual({ root: 'lightning', word: 'thunder', tint: ELEMENT_WORDS.thunder.tint, gem: ELEMENT_WORDS.thunder.gem, vayo: 'lightning', rpg: 'thunder', ooze: ELEMENT_OOZE.thunder });
    expect(RPG_ELEMENTS).toContain(h.rpg);
  });

  it('leaves out a table that has none of it; the RPG takes any word, so it always has one', () => {
    const h = elementHandles('metal');
    expect(h.root).toBe('metal');
    expect(h).not.toHaveProperty('vayo');
    expect(h).not.toHaveProperty('gem');
    expect(h).not.toHaveProperty('ooze');
    expect(typeof h.rpg).toBe('string');
    expect(elementHandles('plasma')).toBeNull();
  });
});

describe('readPolarity', () => {
  it('reads a name or a written one, its elements as roots', () => {
    const named = readPolarity(ofShape('ring'));
    expect(named.id).toBe(ofShape('ring'));
    expect(readPolarity({ shape: 'ring', of: ['flame', 'frost', 'thunder'] }).of).toEqual(['fire', 'ice', 'lightning']);
    expect(readPolarity({ shape: 'pairs', of: [['sun', 'shadow']] }).of).toEqual([['light', 'dark']]);
  });

  it('says what is wrong', () => {
    expect(() => readPolarity('yin-yang')).toThrow(/not a named polarity/);
    expect(() => readPolarity({ shape: 'star', of: [] })).toThrow(/shape is one of/);
    expect(() => readPolarity({ shape: 'ring', of: ['fire', 'plasma', 'ice'] })).toThrow(/'plasma' is no element.*a row in gameworld\/element-words/);
    expect(() => readPolarity({ shape: 'ring', of: ['fire', 'ice'] })).toThrow(/three elements or more/);
    expect(() => readPolarity({ shape: 'poles', of: ['light', 'dark', 'moon'] })).toThrow(/two elements/);
    expect(() => readPolarity({ shape: 'wheel', of: ['fire', 'ice', 'wind', 'earth'] })).toThrow(/odd count of five/);
    expect(() => readPolarity({ shape: 'pairs', of: ['fire', 'water'] })).toThrow(/list of two-element pairs/);
    expect(() => readPolarity({ shape: 'ring', of: ['fire', 'flame', 'ice'] })).toThrow(/names an element twice/);
    expect(() => readPolarity({ shape: 'ring', of: ['fire', 'ice', 'wind'], strength: 2 })).toThrow(/strength is not part/);
  });
});

describe('the four shapes', () => {
  it('names one polarity a shape at least, and every named one reads', () => {
    for (const s of SHAPES) expect(ofShape(s), s).toBeTruthy();
    for (const id of POLARITY_IDS) expect(() => resolvePolarity(id), id).not.toThrow();
  });

  it('poles and pairs are mutual: each opposes the other, and neither beats', () => {
    for (const shape of ['poles', 'pairs']) {
      const P = resolvePolarity(ofShape(shape)), [a] = P.elements, b = P.opposes[a][0];
      expect(relation(P, a, b)).toBe('opposes');
      expect(relation(P, b, a)).toBe('opposes');
      expect(P.beats[a]).toEqual([]);
    }
    // the pairs are indifferent to each other
    const four = resolvePolarity({ shape: 'pairs', of: [['fire', 'water'], ['wind', 'earth']] });
    expect(relation(four, 'fire', 'wind')).toBe('neutral');
  });

  it('a ring is one-way: each beats the next, yields to the one before, and the last beats the first', () => {
    const P = resolvePolarity({ shape: 'ring', of: ['fire', 'ice', 'lightning', 'earth'] });
    expect(relation(P, 'fire', 'ice')).toBe('beats');
    expect(relation(P, 'ice', 'fire')).toBe('yields');
    expect(relation(P, 'earth', 'fire')).toBe('beats');
    expect(relation(P, 'fire', 'lightning')).toBe('neutral');
  });

  it('a wheel allies each element to its neighbours and opposes it to the two across', () => {
    const P = resolvePolarity({ shape: 'wheel', of: ['light', 'water', 'dark', 'fire', 'forest'] });
    expect(P.allies.light.sort()).toEqual(['forest', 'water']);
    expect(P.opposes.light.sort()).toEqual(['dark', 'fire']);
    expect(relation(P, 'light', 'water')).toBe('allied');
    expect(relation(P, 'dark', 'light')).toBe('opposes');
    // seven round a wheel: still two neighbours and two across, the other two indifferent
    const seven = resolvePolarity({ shape: 'wheel', of: ['light', 'water', 'ice', 'dark', 'fire', 'earth', 'forest'] });
    expect(seven.opposes.light).toEqual(['dark', 'fire']);
    expect(relation(seven, 'light', 'ice')).toBe('neutral');
  });

  it('reads words by their root, and anything outside the polarity as neutral', () => {
    const P = resolvePolarity(ofShape('ring'));
    const [a, b] = P.elements;
    expect(relation(P, a, a)).toBe('same');
    expect(relation(P, ROOTS[a].words.at(-1), ROOTS[b].words.at(-1))).toBe(relation(P, a, b));
    expect(relation(P, a, 'plasma')).toBe('neutral');
  });
});

describe('affinityOf', () => {
  it('a thing made of an element is weak to what beats it and resists its own and what it beats, in the RPG\'s words', () => {
    const P = resolvePolarity({ shape: 'ring', of: ['fire', 'ice', 'lightning'] });
    expect(affinityOf(P, 'ice')).toEqual({ weak: ['fire'], resist: ['ice', 'thunder'] });
    for (const w of [...affinityOf(P, 'lightning').weak, ...affinityOf(P, 'lightning').resist]) expect(RPG_ELEMENTS).toContain(w);
  });

  it('an opposite is a weakness both ways; an ally is none; an element outside the polarity has none', () => {
    const poles = resolvePolarity(ofShape('poles')), [a, b] = poles.elements;
    expect(affinityOf(poles, a).weak).toEqual([elementHandles(b).rpg]);
    expect(affinityOf(poles, b).weak).toEqual([elementHandles(a).rpg]);
    const wheel = resolvePolarity(ofShape('wheel')), e = wheel.elements[0];
    for (const ally of wheel.allies[e]) expect(affinityOf(wheel, e).weak).not.toContain(elementHandles(ally).rpg);
    expect(affinityOf(poles, 'earth')).toEqual({ weak: [], resist: [] });
  });
});

describe('polarityLaws', () => {
  const by = (laws) => Object.fromEntries(laws.map((l) => [l.law, l]));

  it('every named polarity holds every law: each element has a weakness, none dominates, the count is even', () => {
    for (const id of POLARITY_IDS) for (const l of polarityLaws(id)) expect(l.ok, `${id} ${l.law}`).toBe(true);
  });

  it('a ring comes round, passing every element once', () => {
    const L = by(polarityLaws({ shape: 'ring', of: ['fire', 'ice', 'lightning', 'earth', 'wind'] }));
    expect(L['comes-round']).toEqual({ law: 'comes-round', ok: true, value: 5 });
    expect(by(polarityLaws(ofShape('poles')))).not.toHaveProperty('comes-round');
  });

  it('says a polarity that leaves an element with no weakness, or one over every other', () => {
    // a hand-built resolved polarity, as a solver might propose one: fire beats both, nothing beats fire
    const lopsided = { shape: 'ring', elements: ['fire', 'ice', 'wind'], beats: { fire: ['ice', 'wind'], ice: [], wind: [] }, opposes: { fire: [], ice: [], wind: [] }, allies: { fire: [], ice: [], wind: [] }, why: {} };
    const L = by(polarityLaws(lopsided));
    expect(L['every-weakness'].ok).toBe(false);
    expect(L['none-dominant'].ok).toBe(false);
    expect(L.even.ok).toBe(false);
    expect(L['comes-round'].ok).toBe(false);
  });

  it('is deterministic, and knows every root it names', () => {
    expect(polarityLaws(ofShape('wheel'))).toEqual(polarityLaws(ofShape('wheel')));
    for (const id of POLARITY_IDS) for (const e of resolvePolarity(id).elements) expect(ROOT_IDS, `${id} ${e}`).toContain(e);
  });
});
