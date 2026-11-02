import { describe, it, expect } from 'vitest';
import { withProgram } from './programs.js';
import { assembleStageScene } from './stage.js';
import { registerPalette, paletteOf, PALETTES, constructionOf } from './style/bay-axes.js';
import { composeRegister } from './style/bay-kits.js';

// a town's building inside: the vernacular register (a pre-modern construction, no machine age's services), each room
// furnished by its role (stocking.js TOWN_STOCK), in the town's own colours (a made palette)
const V = { construction: 'vernacular', palette: 'vernacular', plot: 'vernacular', dressing: 'vernacular' };
const room = (use) => assembleStageScene(withProgram({ kind: 'stage', kit: 'bay-vernacular', compose: V, program: { use, seed: 1 } }));
// (a room by its role: its id without its number, stocking.js roleOf)
const propsOf = (P) => P.anchors.filter((a) => a.kind === 'prop').map((a) => ({ room: a.id.split('/')[0].replace(/-\d+$/, ''), kind: a.id.split('/').pop().replace(/-\d+(@\d+)?$/, '') }));

describe('a town building\'s inside', () => {
  it('is no crypt and no machine room: no moss, rubble, candles, niches or gutters; no ducts, vents or plenum; no game set pieces', () => {
    const P = room('shop');
    expect(P.faces.filter((f) => /moss|rubble|candle|niche|gutter|vent|plenum|duct/.test(f.group || ''))).toEqual([]);
    expect(propsOf(P).filter((p) => ['prize', 'find', 'sign'].includes(p.kind))).toEqual([]);
  });

  it('is furnished by each room\'s role: the shop floor its counter and shelves, a house\'s kitchen its hearth', () => {
    const shop = propsOf(room('shop')), house = propsOf(room('dwelling'));
    expect(shop.filter((p) => p.room === 'shopfloor').map((p) => p.kind)).toEqual(expect.arrayContaining(['counter', 'shelves']));
    expect(house.some((p) => ['kitchen', 'hearth'].includes(p.room) && p.kind === 'hearth')).toBe(true);
    expect(house.some((p) => p.kind === 'bed')).toBe(true);
  });

  it('takes a made palette (the town\'s own colours) beside the authored ones, never in place of one', () => {
    const spec = { ...PALETTES.vernacular, wall: [{ stone: [200, 180, 150], mortar: [180, 160, 130] }] };
    const id = registerPalette('town-test', spec);
    expect(paletteOf(id).wall[0].stone).toEqual([200, 180, 150]);
    expect(() => composeRegister({ ...V, palette: id })).not.toThrow();
    expect(() => registerPalette('vernacular', spec)).toThrow(/authored/);
  });

  it('is built as the town\'s houses are: its walls in its language\'s materials, its windows its lights, leaded small', () => {
    const T = { kind: 'stage', kit: 'isekai-meadow', trail: true, town: { houses: 3, enter: 2, walk: ['shop'], street: true, inside: true } };
    const timber = assembleStageScene({ ...T, town: { ...T.town, anchor: 'tiered' } }), stone = assembleStageScene({ ...T, town: { ...T.town, anchor: 'timber-hall' } });
    const con = (P) => constructionOf(P.anchors.find((a) => a.kind === 'building').look.construction);
    expect(con(timber).surfaces.wall[0].dressed.cut).toBe('boards');
    expect(con(stone).surfaces.wall.map((w) => w.dressed.cut)).toEqual(expect.arrayContaining(['ashlar', 'render']));
    // (the windows: the language's own sizes, crown glass between lead cames; no float glass, no glints)
    expect(con(timber).glass.clear).toBe('glass:crown-leaded');
    expect(con(timber).shell.glass).toMatchObject({ cames: expect.any(Number), punched: { w: 1, sill: 0.8 } });
    expect(timber.faces.some((f) => f.group === 'stage:glint')).toBe(false);
  });

  it('a street\'s walked-in buildings laid so with `inside`, in a palette made from its exterior paint; absent, as before', () => {
    const T = { kind: 'stage', kit: 'isekai-meadow', trail: true };
    const look = (town) => assembleStageScene({ ...T, town }).anchors.filter((a) => a.kind === 'building').map((a) => a.look ?? null);
    const L = look({ houses: 3, enter: 2, walk: ['shop'], street: true, inside: true });
    expect(L.every((l) => /^vernacular-/.test(l?.construction) && /^town-/.test(l.palette))).toBe(true);
    expect(look({ houses: 3, enter: 2, walk: ['shop'], street: true, inside: true })).toEqual(L);
    expect(look({ houses: 3, enter: 2, walk: ['shop'], street: true }).some((l) => /^vernacular/.test(l?.construction ?? ''))).toBe(false);
  });
});
