import { describe, it, expect } from 'vitest';
import { rollArt, resolveArt, compileArt, ART_ITEMS, ART_KITS } from './art-direction.js';
import { planStage } from './stage.js';
import { artBoardSvg, artBoardPng } from './art-board.js';
import { artBoardHtml } from './art-board-html.js';
import { normalizeTileSpec, tileFamilyOf } from './tile-specs.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { starter } from './entries.js';

const ROOM = (kit = 'gothic-stone') => ({ ...starter(kit), reference: 'gothic-night' });
let n = 0; const fresh = () => 1000 + n++;

describe('art direction: rolled at authoring time, stored as numbers', () => {
  it("'propose' rolls every item and marks it proposed; 'auto' marks it auto; { seed } is repeatable", () => {
    const p = resolveArt({ ...ROOM(), art: 'propose' }, fresh);
    for (const k of ['palette', 'materials', 'architecture', 'motifs']) expect(typeof p.art[k]).toBe('object');
    expect(ART_ITEMS.every((k) => p.art.status[k] === 'proposed')).toBe(true);
    expect(Object.values(resolveArt({ ...ROOM(), art: 'auto' }, fresh).art.status).every((s) => s === 'auto')).toBe(true);
    expect(JSON.stringify(resolveArt({ ...ROOM(), art: { seed: 7 } }).art)).toBe(JSON.stringify(resolveArt({ ...ROOM(), art: { seed: 7 } }).art));
  });

  it('a reroll redraws only the item sent back; the others keep their numbers and their approval', () => {
    const a = resolveArt({ ...ROOM(), art: { seed: 7 } }).art;
    const b = resolveArt({ ...ROOM(), art: { ...a, palette: 'reroll', status: { ...a.status, materials: 'approved' } } }, () => 4242).art;
    expect(b.palette).not.toEqual(a.palette);
    expect(b.materials).toEqual(a.materials);
    expect(b.status.palette).toBe('proposed'); expect(b.status.materials).toBe('approved');
  });

  it('leaves a recipe without art, or not a stage, exactly as it was; refuses a word it does not know', () => {
    const m = ROOM(); expect(resolveArt(m)).toBe(m);
    const w = { kind: 'terrain', art: 'propose' }; expect(resolveArt(w)).toBe(w);
    expect(() => resolveArt({ ...ROOM(), art: 'surprise' })).toThrow(/'propose', 'auto'/);
    expect(() => resolveArt({ ...ROOM(), kit: 'island-plaza', art: 'propose' })).toThrow(/room kits gothic-stone, catacomb/);
  });

  it('materials hold texture numbers only: edit the palette and the tiles re-colour', () => {
    const art = rollArt('gothic-stone', 3), redder = { ...art, palette: { ...art.palette, stone: art.palette.stone.map(([r, g, b]) => [Math.min(255, r + 40), g, b]) } };
    expect(planStage({ ...ROOM(), art: redder }).kit.tiles.wall.family).not.toBe(planStage({ ...ROOM(), art }).kit.tiles.wall.family);
    expect(planStage({ ...ROOM(), art: redder }).kit.tiles.floor.family).toBe(planStage({ ...ROOM(), art }).kit.tiles.floor.family);
  });

  it('every number is on its rail: a direction outside them is refused with the range', () => {
    const art = rollArt('gothic-stone', 3);
    expect(() => compileArt({ ...art, materials: { ...art.materials, wall: { ...art.materials.wall, rows: 40 } } }, 'gothic-stone')).toThrow(/rows: an integer from 3 to 12/);
    expect(() => planStage({ ...ROOM(), art: { ...art, architecture: { ...art.architecture, proportions: { plinth: { h: 5 } } } } })).toThrow(/plinth\.h: a number from/);
  });

  it('the recipe\'s own tiles still win over the direction, surface by surface', () => {
    const wall = { gen: 'stone-brick', stone: [200, 180, 150], mortar: [90, 80, 70] };
    const p = planStage({ ...ROOM(), art: rollArt('gothic-stone', 3), tiles: { wall } });
    expect(p.kit.tiles.wall.family).toBe(tileFamilyOf(wall));
  });

  it('each kit rolls inside its own rails: the catacomb draws rock and an ossuary, the dungeon brick and ashlar', () => {
    for (const kit of ART_KITS) {
      const a = rollArt(kit, 11);
      expect(a.doodads.accent).toBe(kit === 'catacomb' ? 'ossuary' : 'ashlar');
      expect(kit === 'catacomb' ? ['rock', 'stone-brick'] : ['stone-brick']).toContain(a.materials.wall.gen);
      expect(a.doodads.props.length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('the art board', () => {
  it('draws the seven items in plain SVG, with the real tiles inside, and rasterizes', async () => {
    const m = resolveArt({ ...ROOM('catacomb'), title: 'tomb', art: { seed: 99 } }), svg = artBoardSvg(m);
    for (const t of ['PALETTE', 'MATERIALS', 'ARCHITECTURE', 'MOTIFS', 'DOODADS', 'ATMOSPHERE', 'PLAN']) expect(svg).toContain(t);
    expect((svg.match(/<image /g) || []).length).toBeGreaterThanOrEqual(7);   // six materials and the motif
    expect(svg).toContain('ossuary');
    const png = await artBoardPng(m);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  }, 60000);
});

describe('the art board as a page', () => {
  it('is one self-contained document: seven cards, one per item, each with its status, the tiles as images', () => {
    const m = resolveArt({ ...ROOM('gothic-stone'), title: 'tomb', art: { seed: 5 } }), html = artBoardHtml(m);
    expect([...html.matchAll(/data-item="([a-z]+)"/g)].map((x) => x[1]).sort()).toEqual(ART_ITEMS.slice().sort());   // laid out by the page, numbered by the gate
    expect((html.match(/<img [^>]*src="data:image\/png;base64,/g) || []).length).toBe(7);   // six tiles and the motif's band
    expect(html).not.toMatch(/<(script|link)\b/);
    expect((html.match(/>proposed</g) || []).length).toBe(7);
  });
});

describe('stone-brick: radius and shadow', () => {
  const B = { gen: 'stone-brick', stone: [118, 128, 140], mortar: [70, 78, 88], rows: 6, cols: 4 };
  it('round the corners and cast a shadow into the joint, each its own tile; refused off the rail', () => {
    const tile = (x) => surfaceTexture(`${tileFamilyOf({ ...B, ...x })}-a`);
    expect(tile({ radius: 0.3 })).not.toBe(tile({}));
    expect(tile({ radius: 0.3, shadow: 0.7 })).not.toBe(tile({ radius: 0.3 }));
    expect(() => normalizeTileSpec({ ...B, radius: 2 })).toThrow(/radius: a number from 0 to 1/);
  });
});
