import { describe, it, expect } from 'vitest';
import { suggestKit, RAILS, ELEMENT_GEM } from './adornment-kit.js';
import { readAdornment, resolveAdornment, resolveActions, resolveDirection, readGameworld, buildAt, MEADOWMARK_HERO } from './index.js';
import { CRYSTAL_GEMS } from '../polygonizer/crystal-optics.js';
import { LOOKS } from '../playscape/elements/elements.js';

const look = Object.keys(LOOKS)[0];
const power = (id, verb, more = {}) => ({ id, verb, ...more });
const page = (powers, progression) => resolveActions({ system: { kind: 'unlock' }, powers, progression: progression ?? [{ stage: 'early', gains: powers.map((p) => p.id) }, { stage: 'mid' }] });
const G = readGameworld(MEADOWMARK_HERO);
const D = resolveDirection(G);
const loop = resolveActions(G.characters.hero.actions, D);

describe('from the loop to the kit', () => {
  it('reads the example hero\'s loop: the body carries the dash and the rise; a thrown ball of wind is a staff with the wind\'s stone', () => {
    const { adornment, reasons, unread } = suggestKit(loop, D);
    expect(adornment.bodily).toEqual(['gust-step', 'cyclone']);
    expect(adornment.items).toHaveLength(1);
    expect(adornment.items[0]).toMatchObject({ id: 'staff', slot: 'right', serves: ['wind-orb'], build: { item: 'staff', gem: 'quartz', parts: { head: 'claw' }, dials: { focus: 'head', ornament: 1, mass: 1 } } });
    expect(unread).toEqual([]);
    expect(reasons).toContain('gust-step: dash through the air → bodily: it moves the body, so the body carries it');
    expect(reasons.join('\n')).toMatch(/staff: the leading element wind → a quartz/);
  });

  it('proposes no loadouts: the items are templates for the equipment table', () => {
    expect(suggestKit(loop, D).adornment).not.toHaveProperty('variations');
  });

  it('reads whole words with their forms, and the verb\'s first word a rail knows decides', () => {
    const S = suggestKit(page([power('a', 'rise and slash'), power('b', 'slashes twice'), power('c', 'stabbing'), power('d', 'cast a castle'), power('e', 'calm the runes'), power('f', 'flies')]));
    expect(S.adornment.bodily).toEqual(['a', 'f']);
    expect(S.adornment.items.map((i) => [i.build.item, i.serves])).toEqual([['sword', ['b']], ['dagger', ['c']], ['staff', ['d']]]);
    expect(S.unread).toEqual([{ id: 'e', verb: 'calm the runes' }]);
  });

  it('what it proposes is a page the reader accepts, and the loop leaves nothing open', () => {
    const { adornment } = suggestKit(loop, D);
    expect(() => readAdornment(adornment)).not.toThrow();
    const R = resolveAdornment(adornment, loop);
    expect(R.open).toEqual([]);
    // the tiers grow the staff by stage: its ornament and mass rise
    expect(buildAt(R.items[0], 'mid').dials).toMatchObject({ ornament: 2, mass: 1.1 });
    expect(buildAt(R.items[0], 'late').dials).toMatchObject({ ornament: 3, mass: 1.25 });
  });

  it('every rail word reads as its own rail, and every stone is a real one', () => {
    for (const r of RAILS) for (const stem of r.stems) {
      const { adornment, unread } = suggestKit(page([power('p', stem)]));
      expect(unread, stem).toEqual([]);
      if (r.bodily) expect(adornment.bodily, stem).toEqual(['p']);
      else expect(adornment.items[0].build.item, stem).toBe(r.item);
    }
    for (const g of Object.values(ELEMENT_GEM)) expect(CRYSTAL_GEMS, g).toContain(g);
  });

  it('a power the verb does not read falls to its attack (a focus), then its look (the body); else it is unread', () => {
    const S = suggestKit(page([power('a', 'sing', { attack: 'orb' }), power('b', 'shimmer', { look }), power('c', 'sing')]));
    expect(S.adornment.items.map((i) => i.build.item)).toEqual(['staff']);
    expect(S.adornment.items[0].serves).toEqual(['a']);
    expect(S.adornment.bodily).toEqual(['b']);
    expect(S.unread).toEqual([{ id: 'c', verb: 'sing' }]);
  });

  it('one item serves every power that calls for it, and a second item takes the next free hand', () => {
    const S = suggestKit(page([power('a', 'cut'), power('b', 'slash'), power('c', 'throw'), power('d', 'stab')]));
    expect(S.adornment.items.map((i) => [i.id, i.slot, i.serves])).toEqual([['sword', 'right', ['a', 'b']], ['staff', 'back', ['c']], ['dagger', 'hip', ['d']]]);
    expect(() => readAdornment(S.adornment)).not.toThrow();
  });

  it('a leading element with no stone, or none at all, leaves the staff head plain; the motif raises every item\'s ornament', () => {
    const plain = (d) => suggestKit(page([power('a', 'throw')]), d).adornment.items[0];
    expect(plain(null).build).toEqual({ item: 'staff', parts: { head: 'plain' }, dials: { ornament: 0, mass: 1 } });
    expect(plain({ primary: 'brass' }).build.parts.head).toBe('plain');
    expect(plain({ primary: 'brass', motif: { words: ['spiral'] } }).build.dials.ornament).toBe(1);
    expect(plain({ primary: 'Flame' }).build.gem).toBe('ruby');
    for (const d of [null, { primary: 'brass' }, { primary: 'flame' }]) expect(() => readAdornment({ items: [plain(d)] })).not.toThrow();
  });

  it('no item at all: only the body carries the loop, or nothing was read', () => {
    const body = suggestKit(page([power('a', 'dash')]));
    expect(body.adornment).toEqual({ items: [], bodily: ['a'] });
    expect(() => readAdornment(body.adornment)).not.toThrow();
    const none = suggestKit(page([power('a', 'sing')]));
    expect(none.adornment.items).toEqual([]);
    expect(() => readAdornment(none.adornment)).toThrow(/items is a list/);
  });

  it('pure: the same loop proposes the same bytes', () => {
    expect(JSON.stringify(suggestKit(loop, D))).toBe(JSON.stringify(suggestKit(loop, D)));
  });
});
