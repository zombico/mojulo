import { describe, it, expect } from 'vitest';
import { readGameworld, heroLooks, composeHero, heroOrders, underlayerFor, UNDERLAYERS, ELEMENT_TINT, MEADOWMARK_HERO } from './index.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { applyManifestPatch } from '../../mcp/tools/manifest-patch.js';
import { validateOutfitBuild } from '../outfit/expand.js';

const world = (characters, style) => readGameworld({ id: 'w', seed: 8, ...(style ? { style } : {}), levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters });
const anime = (hero, d = {}) => world({ direction: { tradition: 'anime', ...d }, hero });

describe('the hero\'s looks', () => {
  it('a world without characters has no looks, no hero, no orders', () => {
    const G = world(undefined);
    expect(heroLooks(G)).toBeNull();
    expect(composeHero(G)).toBeNull();
    expect(heroOrders(G)).toBeNull();
  });

  it('each element is its own page, with its own review part, and reads the tradition alone', () => {
    const L = heroLooks(anime({ looks: { body: { cast: 'female' }, hair: 'twin-tails' } }));
    expect(Object.keys(L.elements)).toEqual(['body', 'head', 'hair', 'colour']);
    expect(Object.values(L.elements).map((e) => e.part)).toEqual(['hero:body', 'hero:head', 'hero:hair', 'hero:colour']);
    expect(L.elements.body.spec).toEqual({ cast: 'female', proportions: 'anime' });
    expect(L.elements.head.spec).toEqual({ head: 'anime' });
    expect(L.elements.hair.spec).toEqual({ hair: 'twin-tails' });
    const W = heroLooks(world({ direction: { tradition: 'western' } }));
    expect(W.elements.body.spec).toEqual({ proportions: 'hero' });
    expect(W.elements.head.spec).toEqual({ head: 'landmark' });
  });

  it('a bridge crosses one thing, and the page follows it', () => {
    const L = heroLooks(anime(undefined, { bridge: { proportions: 'hero' } }));
    expect(L.elements.body.spec.proportions).toBe('hero');
    expect(L.elements.head.spec.head).toBe('anime');
  });

  it('the primary element tints a palette accent, the creator\'s palette over it; a word with no tint is returned unread', () => {
    const L = heroLooks(anime({ looks: { colour: { palette: { Trim: '#112233' } } } }, { primary: 'flame', secondary: 'brass' }));
    expect(L.elements.colour.spec.palette).toEqual({ Trim: '#112233', HairHighlight: ELEMENT_TINT.brass });
    const own = heroLooks(anime(undefined, { primary: 'flame' }));
    expect(own.elements.colour.spec.palette).toEqual({ Trim: ELEMENT_TINT.flame });
    const unread = heroLooks(anime(undefined, { primary: 'plasma' }));
    expect(unread.unread).toEqual([{ key: 'primary', word: 'plasma', why: expect.stringMatching(/no tint for 'plasma'/) }]);
    expect(unread.elements.colour.spec).toEqual({});
  });

  it('the motif reaches the hair page as data it read, not a field the door does not have', () => {
    const L = heroLooks(anime(undefined, { motif: ['crescent'] }));
    expect(L.elements.hair.reads.motif).toEqual(['crescent']);
    expect(L.elements.hair.spec).toEqual({});
  });
});

describe('the underlayer', () => {
  it('is chosen by the world\'s setting, at ornament 0, and every build it names is a real outfit', () => {
    for (const [kit, row] of Object.entries(UNDERLAYERS)) {
      const G = world({ direction: { tradition: 'anime' } }, { kit });
      const U = underlayerFor(G);
      expect(U.build.dials).toEqual({ ornament: 0 });
      expect(U.build.style).toBe(row.style);
      expect(validateOutfitBuild(U.build), kit).toEqual([]);
    }
  });

  it('takes its tones off the kit\'s ramps; a custom direction stands alone with the plain fallback', () => {
    const U = underlayerFor(world({ direction: { tradition: 'anime' } }));
    expect(Object.keys(U.tones)).toEqual(expect.arrayContaining(['Top', 'Bottom']));
    const C = underlayerFor(world({ direction: { tradition: 'anime', from: 'custom' } }));
    expect(C.build).toEqual({ type: 'outfit', style: 'casual', dials: { ornament: 0 } });
    expect(C.tones).toEqual({});
  });

  it('the clothes wear the direction: the leading element on the top, the supporting on the bottom, the ramps behind', () => {
    const ramps = underlayerFor(world({ direction: { tradition: 'anime' } }));
    const both = underlayerFor(world({ direction: { tradition: 'anime', primary: 'wind', secondary: 'brass' } }));
    expect(both.tones).toEqual({ Top: ELEMENT_TINT.wind, Bottom: ELEMENT_TINT.brass });
    expect(both.toneFrom).toEqual({ Top: 'the leading element, wind', Bottom: 'the supporting element, brass' });
    // a word with no tint leaves its group to the kit's ramps
    const one = underlayerFor(world({ direction: { tradition: 'anime', primary: 'wind', secondary: 'velvet' } }));
    expect(one.tones).toEqual({ Top: ELEMENT_TINT.wind, Bottom: ramps.tones.Bottom });
    expect(one.toneFrom.Bottom).toBe('the kit\'s ramps');
    // a custom direction has no ramps, but its elements still dress it
    expect(underlayerFor(world({ direction: { tradition: 'anime', from: 'custom', primary: 'fire' } })).tones).toEqual({ Top: ELEMENT_TINT.fire });
  });

  it('the creator\'s own underlayer wins, stays at ornament 0 and is ledgered', () => {
    const G = anime({ looks: { underlayer: { type: 'outfit', style: 'office', dials: { ornament: 3 } } } });
    const U = underlayerFor(G);
    expect(U.build).toEqual({ type: 'outfit', style: 'office', dials: { ornament: 0 } });
    expect(U.ledger).toEqual([expect.objectContaining({ scope: 'looks', key: 'underlayer', local: 'office' }),
      expect.objectContaining({ key: 'underlayer ornament', world: 0, local: 3 })]);   // told, not quietly changed
    // the cut is the creator's, the colours still the direction's
    const D = underlayerFor(anime({ looks: { underlayer: { type: 'outfit', style: 'adventurer' } } }, { primary: 'wind', secondary: 'brass' }));
    expect(D.tones).toMatchObject({ Top: ELEMENT_TINT.wind, Bottom: ELEMENT_TINT.brass });
    expect(D.read).toBe('the creator\'s own underlayer');
    // an inline card that names its own tones (an Egocube's designed cut) keeps them, ledgered by its id
    const E = underlayerFor(anime({ looks: { underlayer: { type: 'outfit', style: { id: 'designed', tones: { Top: '#5a2b1d' } } } } }, { primary: 'wind', secondary: 'brass' }));
    expect(E.tones.Top).toBeUndefined();
    expect(E.toneFrom.Top).toBe('the creator\'s underlayer, its own');
    expect(E.tones.Bottom).toBe(ELEMENT_TINT.brass);
    expect(E.ledger[0].local).toBe('designed');
  });
});

describe('the composed hero', () => {
  const G = anime({ looks: { body: { cast: 'female', tune: { legs: 1.04 } }, head: { look: ['heroine'] }, hair: { length: 1.5, fringe: 0.85 } } }, { primary: 'flame' });

  it('is one bare hero-door spec: the elements merged, the underlayer worn, no adornment, and it validates', () => {
    const C = composeHero(G);
    expect(C.spec).toMatchObject({ cast: 'female', tune: { legs: 1.04 }, proportions: 'anime', head: 'anime', look: ['heroine'], hair: { length: 1.5, fringe: 0.85 } });
    expect(C.spec.outfit.type).toBe('outfit');
    for (const k of ['adorn', 'paint', 'gear', 'detail', 'clips', 'gesture']) expect(C.spec, k).not.toHaveProperty(k);
    expect(C.spec.palette.Trim).toBe(ELEMENT_TINT.flame);
    expect(validateHeroSpec(C.spec)).toEqual([]);
    expect(C.toon).toBe(true);
  });

  it('an element left out leaves the door\'s own default: no keys are invented', () => {
    const C = composeHero(world({ direction: { tradition: 'western', from: 'custom' } }));
    expect(Object.keys(C.spec).sort()).toEqual(['head', 'outfit', 'proportions']);
    expect(C.toon).toBe(false);
    expect(validateHeroSpec(C.spec)).toEqual([]);
  });

  it('pure: the same world composes the same bytes', () => {
    expect(JSON.stringify(composeHero(G))).toBe(JSON.stringify(composeHero(G)));
  });

  it('orders: a mint with the composed spec and the character light, then a patch per element that set something', () => {
    const O = heroOrders(G, { title: 'Hero' });
    expect(O.mint).toEqual({ tool: 'mint_solid', args: { kind: 'layered', via: 'hero', title: 'Hero', spec: composeHero(G).spec, toon: { light: true } } });
    expect(O.patches.map((p) => p.part)).toEqual(['hero:body', 'hero:head', 'hero:hair', 'hero:colour']);
    expect(O.patches[0].args.patch).toEqual([{ op: 'set', path: '/hero/cast', value: 'female' }, { op: 'set', path: '/hero/tune', value: { legs: 1.04 } }, { op: 'set', path: '/hero/proportions', value: 'anime' }]);
    expect(heroOrders(world({ direction: { tradition: 'western' } })).mint.args).not.toHaveProperty('toon');
  });

  it('re-applying any page over the minted hero leaves it as composed: the colour page keeps the underlayer\'s tones', () => {
    const H = readGameworld(MEADOWMARK_HERO), C = composeHero(H), O = heroOrders(H);
    expect(Object.keys(C.spec.palette)).toEqual(expect.arrayContaining(['Top', 'Bottom', 'Trim', 'Hair']));
    for (const p of O.patches) expect(applyManifestPatch({ hero: O.mint.args.spec }, p.args.patch).manifest.hero, p.part).toEqual(C.spec);
  });
});
