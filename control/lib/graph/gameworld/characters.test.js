import { describe, it, expect } from 'vitest';
import { readGameworld, resolveDirection, gameworldBibleHtml, MEADOWMARK, TRADITIONS } from './index.js';

const W = (characters, more = {}) => ({ id: 'w', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters, ...more });
const direction = (d) => resolveDirection(readGameworld(W({ direction: d })));

describe('the character book', () => {
  it('a world without characters keeps none, and its bible still names them open', () => {
    expect(readGameworld(W(undefined)).characters).toBeUndefined();
    expect(readGameworld(W(null)).characters).toBeUndefined();
    expect(resolveDirection(readGameworld(W(undefined)))).toBeNull();
    expect(gameworldBibleHtml(MEADOWMARK)).toMatch(/<h3>Characters<\/h3>/);
  });

  it('the tradition is chosen explicitly, never defaulted', () => {
    const bad = (c, re) => expect(() => readGameworld(W(c))).toThrow(re);
    bad({}, /tradition is chosen explicitly: 'anime'.*or 'western'/);
    bad({ direction: {} }, /tradition is chosen explicitly/);
    bad({ direction: { tradition: 'manga' } }, /tradition is chosen explicitly/);
    for (const t of Object.keys(TRADITIONS)) expect(direction({ tradition: t }).tradition).toBe(t);
  });

  it('says what is wrong', () => {
    const bad = (c, re) => expect(() => readGameworld(W(c))).toThrow(re);
    const d = { tradition: 'anime' };
    bad({ direction: d, villain: {} }, /'villain' is not part of the character book/);
    bad({ direction: d, cast: [{}] }, /the other characters are left open/);
    bad({ direction: { ...d, mood: 'grim' } }, /direction.mood is not part of the direction/);
    bad({ direction: { ...d, from: 'film' } }, /direction.from 'film'/);
    bad({ direction: { ...d, palette: ['red'] } }, /palette is a list of colours/);
    bad({ direction: { ...d, motif: { words: [] } } }, /motif's shape language/);
    bad({ direction: { ...d, bridge: { register: 'round' } } }, /bridge.register is not something a tradition decides/);
    bad({ direction: { ...d, bridge: { head: 'anime' } } }, /the anime tradition's own/);
    bad({ direction: { ...d, bridge: { proportions: 'giant' } } }, /bridge.proportions is/);
    bad({ direction: d, hero: { face: {} } }, /hero.face is not part of the hero's page/);
    bad({ direction: d, hero: { looks: { body: { face: { jaw: 1 } } } } }, /body.face is not the body page's.*face is the head page's/);
    bad({ direction: d, hero: { looks: { head: { head: 'landmark' } } } }, /the head is the tradition's; cross it with direction.bridge.head/);
    bad({ direction: d, hero: { looks: { body: { proportions: 'herobot' } } } }, /bridge.proportions/);
    bad({ direction: d, hero: { looks: { outfit: { type: 'outfit' } } } }, /the base wears its underlayer/);
    bad({ direction: d, hero: { looks: { body: { gear: { right: 'sword' } } } } }, /equipment is a later page/);
    bad({ direction: d, hero: { looks: { shoes: {} } } }, /not a looks page/);
    bad({ direction: d, hero: { looks: { base: { ref: 'x', rev: 0, print: 'zz' } } } }, /pinned base version/);
  });

  it('reads each looks element as its own page; the hair page may be the hair itself', () => {
    const G = readGameworld(W({ direction: { tradition: 'anime' }, hero: { looks: { body: { cast: 'female', tune: 'lithe' }, head: { look: ['heroine'], genki: 0.4 }, hair: 'twin-tails', colour: { palette: { Hair: '#d04a3a' } }, underlayer: null } } }));
    expect(G.characters.hero.looks).toEqual({ body: { cast: 'female', tune: 'lithe' }, head: { look: ['heroine'], genki: 0.4 }, hair: { hair: 'twin-tails' }, colour: { palette: { Hair: '#d04a3a' } }, underlayer: null });
    expect(readGameworld(W({ direction: { tradition: 'anime' }, hero: { looks: { hair: { hair: { style: 'bob' } } } } })).characters.hero.looks.hair).toEqual({ hair: { style: 'bob' } });
  });

  it('the tradition decides the hero\'s head, proportions and light; a bridge crosses one, ledgered', () => {
    expect(direction({ tradition: 'anime' }).hero).toEqual({ head: 'anime', proportions: 'anime', toon: true });
    expect(direction({ tradition: 'western' }).hero).toEqual({ head: 'landmark', proportions: 'hero', toon: false });
    const D = direction({ tradition: 'anime', bridge: { proportions: 'hero' } });
    expect(D.hero).toEqual({ head: 'anime', proportions: 'hero', toon: true });
    expect(D.ledger).toContainEqual({ scope: 'tradition', at: 'direction', key: 'proportions', world: 'anime', local: 'hero' });
  });

  it('from the world: the kit, its pole and ramps, its building ornament as the motif; a tradition against the pole is ledgered', () => {
    const D = direction({ tradition: 'anime', primary: 'flame', secondary: 'brass' });
    expect(D).toMatchObject({ from: 'world', kit: 'isekai-meadow', pole: 'banded', primary: 'flame', secondary: 'brass' });
    expect(D.ramps.length).toBeGreaterThan(0);
    expect(D.ledger).toEqual([]);
    const western = direction({ tradition: 'western' });
    expect(western.ledger).toContainEqual({ scope: 'world', at: 'direction', key: 'tradition', world: 'anime', local: 'western' });
    const own = direction({ tradition: 'anime', palette: ['#112233'], motif: 'crescent' });
    expect(own.palette).toEqual(['#112233']);
    expect(own.motif).toEqual({ words: ['crescent'] });
    expect(own.ledger.map((e) => e.key)).toContain('palette');
  });

  it('custom stands alone: no kit, no ramps, nothing ledgered against the world', () => {
    const D = direction({ tradition: 'western', from: 'custom', motif: { words: ['chevron'], on: ['hem'] }, palette: ['#AABBCC'] });
    expect(D).toEqual({ tradition: 'western', from: 'custom', hero: { head: 'landmark', proportions: 'hero', toon: false }, motif: { words: ['chevron'], on: ['hem'] }, palette: ['#aabbcc'], ledger: [] });
  });

  it('pure: the same world hands down the same direction', () => {
    const w = W({ direction: { tradition: 'anime', motif: ['spiral'] } });
    expect(JSON.stringify(resolveDirection(readGameworld(w)))).toBe(JSON.stringify(resolveDirection(readGameworld(w))));
  });
});
