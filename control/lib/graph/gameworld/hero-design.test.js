import { describe, it, expect } from 'vitest';
import { readGameworld, composeHero, heroDesign, accentOf, PROTAGONIST, ROLE_OF_VERB, composeGameworld } from './index.js';
import { GAME_BODIES, railOfGame } from './game-bodies.js';
import { GENRES } from './intent.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { GEOCUBE_PALETTES } from '../era/geocube.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';

// a world on a cube (its accent the cube's), its hero armed for its own blow; `over` lays the rest
const CUBE = Object.keys(GEOCUBE_PALETTES).find((id) => typeof GEOCUBE_PALETTES[id].hues?.accent === 'string');
const blade = { items: [{ id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] }] };
const world = ({ seed = 4, style = { kit: 'isekai-meadow', geocube: CUBE }, hero = { adornment: blade }, direction = {}, ...over } = {}) => readGameworld({
  id: 'w', seed, style, levels: { a: { walk: { nodes: { t: { trail: true } } } } }, characters: { direction: { tradition: 'anime', ...direction }, hero }, ...over });
// a genre no body rail is for, and one a rail designs, both chosen from the tables
const RAILED = new Set(Object.values(GAME_BODIES).flatMap((r) => r.genres));
const FREE = Object.keys(GENRES).find((g) => !railOfGame({ genre: g })), RAIL = [...RAILED][0];

describe('the hero\'s design', () => {
  it('fills the looks pages in the pages\' own words, and the world reads them', () => {
    const G = world(), D = heroDesign(G);
    expect(Object.keys(D.looks)).toEqual(expect.arrayContaining(['hair', 'colour', 'underlayer']));
    expect(D.sheet).toEqual({ facets: { ...PROTAGONIST, role: ROLE_OF_VERB.strike }, seed: 4, path: 'hero' });
    // (the pages laid, the book reads its hero and the hero door takes it)
    const laid = world({ hero: { adornment: blade, looks: D.looks } }), C = composeHero(laid);
    expect(validateHeroSpec(C.spec)).toEqual([]);
    expect(C.spec.hair).toEqual(D.looks.hair.hair);
    expect(C.spec.outfit.style.id).toBe('designed');
    expect(C.spec.outfit.dials.ornament).toBe(0);
    for (const line of D.read) expect(line).toBeTruthy();
  });

  it('the protagonist reads against its ground: the garment is the world\'s accent, the rest follows it', () => {
    const G = world(), D = heroDesign(G), accent = accentOf(G);
    expect(accent).toBe(GEOCUBE_PALETTES[CUBE].hues.accent);
    expect(D.garment).toBe(accent);
    const P = D.looks.underlayer.intent.palette, tones = D.looks.underlayer.style.tones;
    // (the accent's hue, its value a step from the skin it is worn on: outfit.js outfitPalette; the cloth wears it)
    expect(Math.abs(hexLch(P.base)[2] - hexLch(accent)[2])).toBeLessThan(8);
    expect(Object.values(tones)).toContain(P.base);
    // (every other role its own colour, a clear step from the garment: the palette's own rules, not the accent again)
    for (const k of ['secondary', 'trim']) expect(Math.abs(hexLch(P[k])[0] - hexLch(P.base)[0])).toBeGreaterThanOrEqual(15);
    expect(D.laws.filter((l) => !l.ok)).toEqual([]);
    // a world with no palette: the archetype's own colour, said
    const bare = heroDesign(world({ style: { kit: 'isekai-meadow' } }));
    expect(accentOf(world({ style: { kit: 'isekai-meadow' } }))).toBeNull();
    expect(bare.garment).toBeNull();
    expect(Math.abs(hexLch(bare.looks.underlayer.intent.palette.base)[2] - hexLch(accent)[2])).toBeGreaterThan(30);
  });

  it('the accent is the one the palette names, a hue at a cloth\'s value, else the solved one; a stamped palette wins', () => {
    const at = (palette) => accentOf(world({ style: { kit: 'isekai-meadow', palette } }));
    expect(at({ seed: 3, hues: { accent: '#AA3311' } })).toBe('#aa3311');
    expect(at({ seed: 3, lock: { accent: '#112233' } })).toBe('#112233');
    expect(Math.abs(hexLch(at({ seed: 3, hues: { accent: 200 } }))[2] - 200)).toBeLessThan(6);
    expect(at({ seed: 3 })).toMatch(/^#[0-9a-f]{6}$/);
    expect(accentOf(world({ style: { kit: 'isekai-meadow', geocube: CUBE, palette: { seed: 3, hues: { accent: '#aa3311' } } } }))).toBe('#aa3311');
  });

  it('wears the belt its cut closes on as a piece, since the base wears its cloth plain', () => {
    const D = heroDesign(world());
    const closes = D.looks.underlayer.style.language.focal === 'belt';
    expect(D.looks.underlayer.pieces.some((p) => p.kind === 'belt')).toBe(closes);
    expect(D.pieces.every((p) => p.why)).toBe(true);
    expect(D.pieces.filter((p) => p.role === 'focal')).toHaveLength(1);
  });

  it('its role is what it fights with, its roll the world\'s seed: the same world the same hero, another seed another', () => {
    const gun = { items: [{ id: 'gun', slot: 'right', build: { item: 'carbine' }, serves: ['shoot'] }] };
    expect(heroDesign(world({ hero: { adornment: gun } })).sheet.facets.role).toBe(ROLE_OF_VERB.shoot);
    expect(heroDesign(world({ hero: {} })).sheet.facets.role).toBe('non-combatant');
    expect(heroDesign(world())).toEqual(heroDesign(world()));
    const looks = new Set([4, 5, 6, 7, 8, 9].map((seed) => JSON.stringify(heroDesign(world({ seed })).looks)));
    expect(looks.size).toBeGreaterThan(1);
  });

  it('designs nothing where the game designs its hero another way: a body rail, pages written, a hero adopted', () => {
    expect(heroDesign(world({ direction: { body: 'game' }, intent: { from: RAIL } }))).toBeNull();
    expect(heroDesign(world({ direction: { body: 'game' }, intent: { from: FREE } }))).not.toBeNull();
    expect(heroDesign(world({ hero: { adornment: blade, looks: { hair: 'twin-tails' } } }))).toBeNull();
    expect(heroDesign(world({ hero: { ref: 'sk_made' } }))).toBeNull();
    expect(heroDesign(readGameworld({ id: 'w', levels: { a: { walk: { nodes: { t: { trail: true } } } } } }))).toBeNull();
  });

  it('the sentence door lays it: a genre no rail designs gets its pages and its brief says how; a railed one is as it was', () => {
    // (a genre of each kind the door lays with a hero, found by composing its own first word)
    const laid = (g) => { try { const w = composeGameworld({ prompt: `a ${GENRES[g].words[0]}`, seed: 2 }); return w.brief.hero?.genre === g ? w : null; } catch { return null; } };
    const first = (ids) => { for (const g of ids) { const w = laid(g); if (w) return w; } return null; };
    const w = first(Object.keys(GENRES).filter((g) => !railOfGame({ genre: g }))), r = first([...RAILED]);
    expect(w.characters.hero.looks.underlayer.type).toBe('outfit');
    expect(w.brief.hero.design.read.length).toBeGreaterThan(1);
    expect(w.brief.hero.design.pieces).toEqual(w.characters.hero.looks.underlayer.pieces.map((p) => p.kind));
    expect(() => readGameworld(w)).not.toThrow();
    expect(validateHeroSpec(composeHero(readGameworld(w)).spec)).toEqual([]);
    expect(r.brief.hero.design).toBeUndefined();
    expect(r.characters.hero.looks).toBeUndefined();
  });

  it('a game with a casting page: the hero is the cast\'s anchor, not a second roll beside it', () => {
    const D = heroDesign(world());
    const C = readGameworld({ id: 'w', seed: 4, style: { kit: 'isekai-meadow', geocube: CUBE }, levels: { a: { walk: { nodes: { t: { trail: true } } } } },
      characters: { direction: { tradition: 'anime' }, hero: { adornment: blade }, casting: { scale: 'party', anchor: { facets: { pole: 'female', archetype: 'sage' } } } } });
    const A = heroDesign(C);
    expect(A.sheet).toEqual({ casting: 'anchor' });
    expect(A.looks.body.cast).toBe('female');
    expect(A.read[0]).toMatch(/the cast's anchor/);
    expect(A.read[0]).toMatch(/sage/);
    expect(D.sheet.path).toBe('hero');
  });
});
