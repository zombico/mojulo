import { describe, it, expect } from 'vitest';
import { readGameworld, composeGameworld } from './index.js';
import { colourOfGame, colourOptions, figuresOfGame, castPatch, paintedCast, GENRE_COLOUR } from './colour.js';
import { colourBookHtml } from './colour-book.js';
import { groundOf } from './world-palette.js';
import { GENRES } from './intent.js';
import { PACK_STYLES } from '../foes/packs.js';
import { kinCoat } from '../beast/cards.js';
import { COLOUR_DIRECTIONS } from '../color-theorist/directions.js';
import { FIGURE_MIN, HUE_KEEP } from '../color-theorist/figures.js';
import { hexToRgb, lchOf, hueGap } from '../color-theorist/oklab.js';
import { applyManifestPatch } from '../../mcp/tools/manifest-patch.js';

// a pack and the kin it is cut for, from the table; a land whose ground IS that kin's coat, so the kin sinks in it
const [STYLE, S] = Object.entries(PACK_STYLES)[0], KIN = S.peoples[0], COAT = kinCoat(KIN);
// (its accent a colour clear of that land, and the hero in it)
const ACCENT = '#d0603a';
const PALETTE = { seed: 5, key: 'high', scheme: 'complementary', lock: { ground: COAT }, hues: { accent: ACCENT } };
const blade = { items: [{ id: 'blade', slot: 'right', build: { item: 'sword' }, serves: ['strike'] }] };
const world = ({ palette = PALETTE, levels = 1, foes, hero = { adornment: blade, looks: { colour: { palette: { Top: ACCENT } } } } } = {}) => ({
  id: 'w', seed: 4, style: { kit: 'isekai-meadow', ...(palette ? { palette } : {}) },
  levels: Object.fromEntries(Array.from({ length: levels }, (_, i) => [`l${i}`, { walk: { nodes: { t: { trail: true } } } }])),
  ...(levels > 1 ? { links: Array.from({ length: levels - 1 }, (_, i) => ({ from: `l${i}`, to: `l${i + 1}` })) } : {}),
  characters: { direction: { tradition: 'anime' }, hero },
  foes: foes ?? { grunt: { class: 'guard', skin: { people: KIN, pack: { style: STYLE } } }, chief: { class: 'guard', rank: 'elite', skin: { people: KIN, pack: { style: STYLE } } }, wolf: { class: 'guard' } },
});
const hue = (h) => lchOf(hexToRgb(h))[2];

describe('the game\'s colour', () => {
  it('reads a game into figures: the hero first, one figure for all that share a coat, a pack\'s mark; the rest said unread', () => {
    const { figures, unread } = figuresOfGame(readGameworld(world()));
    expect(figures[0]).toMatchObject({ id: 'hero', hex: ACCENT, keep: 'colour', protagonist: true });
    const kin = figures.find((f) => f.id === KIN), mark = figures.find((f) => f.id === `mark-${STYLE}`);
    expect(kin).toMatchObject({ hex: COAT.toLowerCase(), keep: 'hue', at: ['/foes/grunt/skin/body', '/foes/chief/skin/body'], field: 'coat' });
    // (the mark measured in the colour its colourway wears, solved into the world's)
    expect(mark).toMatchObject({ hex: Object.values(S.colourways)[0].roles.accent.toLowerCase(), wear: 'accent2', field: 'accent' });
    expect(unread).toEqual([{ id: 'wolf', why: expect.stringMatching(/a beast/) }]);
  });

  it('measures the cast as it is: a kin in the land\'s own colour sinks, and the game says where', () => {
    const N = colourOfGame(readGameworld(world()));
    expect(N.ground.from).toBe('palette');
    expect(N.sinks).toEqual([expect.objectContaining({ id: KIN, from: 'ground' })]);
    expect(N.sinks[0].clear).toBeLessThan(FIGURE_MIN);
    expect(N.figures.find((f) => f.id === KIN).name).toMatch(/grunt, chief/);
  });

  it('the cast option moves it clear inside its hue family, and its patch, taken, leaves no figure sunk', () => {
    const W = world(), R = colourOptions(W), cast = R.options.find((o) => o.id === 'cast'), kin = cast.figures.find((f) => f.id === KIN);
    expect(kin.was).toBe(COAT.toLowerCase());
    expect(kin.clear).toBeGreaterThanOrEqual(FIGURE_MIN);
    expect(hueGap(hue(kin.hex), hue(COAT))).toBeLessThanOrEqual(HUE_KEEP + 2);
    expect(cast.patch.filter((o) => o.path.startsWith('/style'))).toEqual([]);
    expect(cast.patch.find((o) => o.path === '/foes/grunt/skin/body').value.coat).toBe(kin.hex);
    expect(cast.patch.find((o) => o.path === '/foes/chief/skin/pack').value).toMatchObject({ style: STYLE, accent: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    const taken = applyManifestPatch(W, cast.patch).manifest, after = colourOptions(taken);
    expect(after.now.sinks).toEqual([]);
    // (and solved once it is solved: it is not offered its own colours again)
    expect(after.options.find((o) => o.id === 'cast')).toBeUndefined();
  });

  it('offers each direction the world can take, its land moved and the cast solved against the land it makes', () => {
    const one = colourOptions(world()), many = colourOptions(world({ levels: 2 }));
    const ids = (R) => R.options.map((o) => o.id);
    expect(ids(one)).toEqual(['cast', ...Object.keys(COLOUR_DIRECTIONS).filter((id) => !COLOUR_DIRECTIONS[id].levels)]);
    expect(ids(many)).toEqual(['cast', ...Object.keys(COLOUR_DIRECTIONS)]);
    for (const o of many.options.filter((x) => x.id !== 'cast')) {
      expect(o.patch[0]).toMatchObject({ op: 'set', path: '/style/palette' });
      expect(o.patch[0].value.seed).toBe(PALETTE.seed);
      expect(o.figures.every((f) => f.clear >= FIGURE_MIN), o.id).toBe(true);
      expect(() => readGameworld(applyManifestPatch(world({ levels: 2 }), o.patch).manifest), o.id).not.toThrow();
    }
    // a script is solved against every level's land: one landscape a level
    const scripted = many.options.find((o) => o.palette.spec.script);
    expect(scripted.zones).toHaveLength(2);
    expect(many.recommend).toBeTruthy();
    expect(many.options.find((o) => o.id === many.recommend).laws.every((l) => l.ok)).toBe(true);
  });

  it('a world with no palette is read on its kit\'s own ramps: the cast option alone, a role it would wear left as it is', () => {
    const W = world({ palette: null }), G = readGameworld(W);
    expect(groundOf(G).from).toBe('kit');
    const R = colourOptions(W);
    expect(R.options.map((o) => o.id)).toEqual(['cast']);
    // (a mark worn against the hero needs no palette: the hero's complement is its own)
    expect(R.options[0].figures.every((f) => f.clear >= FIGURE_MIN)).toBe(true);
    // a world that writes no bestiary fields the stock stand-ins: nobody's design, so none is read
    expect(colourOptions({ id: 'w', levels: { a: { walk: { nodes: { t: { trail: true } } } } } }).now).toMatchObject({ figures: [], unread: [] });
  });

  it('a bare hero the door can design is designed with the cast: its pages in the option\'s patch, its garment the accent', () => {
    const R = colourOptions(world({ hero: { adornment: blade } })), cast = R.options[0];
    expect(cast.patch.filter((o) => o.path.startsWith('/characters/hero/looks/')).map((o) => o.path)).toEqual(expect.arrayContaining(['/characters/hero/looks/underlayer', '/characters/hero/looks/hair']));
    expect(cast.figures[0]).toMatchObject({ id: 'hero', hex: ACCENT, protagonist: true });
  });

  it('a garment nobody chose is the game\'s to colour: the kit\'s ramp now, the world\'s accent once painted, on the colour page', () => {
    const bare = world({ hero: { adornment: blade, looks: { hair: 'twin-tails' } } }), G = readGameworld(bare);
    const hero = figuresOfGame(G).figures[0];
    expect(hero).toMatchObject({ id: 'hero', wear: ACCENT, keep: 'hue', at: ['/characters/hero/looks/colour'], field: 'palette.Top' });
    expect(colourOfGame(G).figures[0].hex).toBe(hero.hex);
    const cast = colourOptions(bare).options.find((o) => o.id === 'cast'), op = cast.patch.find((o) => o.path === '/characters/hero/looks/colour');
    expect(cast.figures[0].was).toBe(hero.hex);
    expect(op.value.palette.Top).toBe(cast.figures[0].hex);
    // taken, the hero wears it, its other pages kept; a top the creator chose is never moved
    const taken = readGameworld(applyManifestPatch(bare, cast.patch).manifest);
    expect(taken.characters.hero.looks).toMatchObject({ hair: { hair: 'twin-tails' }, colour: { palette: { Top: op.value.palette.Top } } });
    expect(figuresOfGame(taken).figures[0]).toMatchObject({ keep: 'colour', hex: op.value.palette.Top });
  });

  it('paints a composed world\'s cast once: the coats written, what moved said; a world with none is the same world', () => {
    const W = world(), P = paintedCast(W);
    expect(P.painted.map((p) => p.id)).toEqual(expect.arrayContaining([KIN, `mark-${STYLE}`]));
    expect(P.world.foes.grunt.skin.body.coat).toBe(P.painted.find((p) => p.id === KIN).hex);
    expect(W.foes.grunt.skin.body).toBeUndefined();
    expect(colourOfGame(readGameworld(P.world)).sinks).toEqual([]);
    expect(paintedCast(P.world)).toEqual({ world: P.world, painted: [] });
    const none = world({ foes: { wolf: { class: 'guard' } } });
    expect(paintedCast(none).world).toBe(none);
    castPatch(readGameworld(W), { figures: [] });
  });

  it('the colour book lays it out: the game as it is, each option, the machine\'s pick and each patch', () => {
    const W = world({ levels: 2 }), R = colourOptions(W), html = colourBookHtml({ name: 'Greenfall', ...W });
    expect(colourBookHtml({ name: 'Greenfall', ...W })).toBe(html);
    expect(html).toContain('Greenfall: colour');
    expect(html).toContain('As it is');
    for (const o of R.options) expect(html).toContain(o.name.replace(/'/g, '&#39;'));
    expect(html.match(/the machine's pick<\/small>/g)).toHaveLength(1);
    expect(html).toContain('design_game({ ref, patch })');
    expect(html).toMatch(/Not read yet: <b>wolf<\/b>/);
    expect(html).toMatch(/class="no">0\.\d\d</);
  });

  it('a genre with a direction chosen for it is laid in it from a sentence; the rows name real genres and directions', () => {
    for (const [g, d] of Object.entries(GENRE_COLOUR)) { expect(GENRES[g], g).toBeTruthy(); expect(COLOUR_DIRECTIONS[d], d).toBeTruthy(); }
    const [genre, dir] = Object.entries(GENRE_COLOUR)[0], w = composeGameworld({ prompt: `a ${GENRES[genre].words[0]}`, seed: 2 });
    expect(w.brief.colour).toEqual({ direction: dir });
    expect(w.style.geocube.palette).toMatchObject(COLOUR_DIRECTIONS[dir].move({}).values ? { values: COLOUR_DIRECTIONS[dir].move({}).values } : {});
    const other = Object.keys(GENRES).find((g) => !GENRE_COLOUR[g] && (() => { try { return composeGameworld({ prompt: `a ${GENRES[g].words[0]}`, seed: 2 }).brief.hero?.genre === g; } catch { return false; } })());
    expect(composeGameworld({ prompt: `a ${GENRES[other].words[0]}`, seed: 2 }).brief.colour).toBeUndefined();
  });
});
