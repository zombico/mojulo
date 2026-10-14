// sheets — every page mojulo draws for a person to look at. The laws: the repertoire's kits are the ones each builder
// reads (derived from the kits, not listed); a sheet refuses a kit it does not draw in; a recipe draws exactly the
// sheets that apply to it, a gameworld its own atlas in its own kit, seed and finish; a drawn sheet is the builder's
// page, byte for byte.

import { describe, it, expect } from 'vitest';
import { STAGE_KITS } from '../era/stage.js';
import { outLandHtml } from '../era/out-land-html.js';
import { techIndexHtml } from '../gameworld/tech-html.js';
import { MEADOWMARK } from '../gameworld/index.js';
import { REPERTOIRE, ISEKAI_KITS, ALL_KITS, repertoireList, drawsIn, drawRepertoire, recipeSheets, drawRecipeSheet } from './registry.js';
import { cachedPage, clearPageCache } from '../../sheet-cache.js';

describe('the repertoire', () => {
  it('names each sheet once, with the kits its builder reads', () => {
    expect(REPERTOIRE.map((s) => s.id)).toEqual(['index', 'land', 'flora', 'blocks', 'structures', 'fortified-town', 'castle', 'tech']);
    expect(ISEKAI_KITS.length).toBeGreaterThan(0);
    for (const k of ISEKAI_KITS) expect(STAGE_KITS[k].shell).toBe('isekai');
    expect(ALL_KITS).toEqual(Object.keys(STAGE_KITS));
    expect(repertoireList().find((s) => s.id === 'index').kits).toEqual([]);
    expect(repertoireList().find((s) => s.id === 'land').kits).toEqual(ALL_KITS);
  });

  it('draws a sheet as its builder does, and refuses a kit the sheet does not draw in', async () => {
    const indoor = ALL_KITS.find((k) => !ISEKAI_KITS.includes(k));
    expect(await drawRepertoire('land', { kit: indoor, seed: 3 })).toBe(outLandHtml({ seed: 3, kitId: indoor }));
    expect(drawsIn(REPERTOIRE.find((s) => s.id === 'flora'), indoor)).toBe(false);
    await expect(drawRepertoire('flora', { kit: indoor })).rejects.toThrow(/is drawn in/);
    await expect(drawRepertoire('nowhere')).rejects.toThrow(/not a sheet/);
  });
});

describe('a recipe\'s sheets', () => {
  it('a gameworld draws its own atlas: the repertoire in its kit, its seed, its civilization\'s finish', async () => {
    const m = { kind: 'gameworld', ...MEADOWMARK };
    const kit = MEADOWMARK.style.kit;
    const ids = recipeSheets(m).map((s) => s.id);
    expect(ids).toEqual(REPERTOIRE.filter((s) => s.kits && s.kits.includes(kit)).map((s) => s.id));
    expect(ids).not.toContain('index');
    const finish = Object.values(MEADOWMARK.civilizations)[0]?.technology?.finish;
    const seed = MEADOWMARK.seed;
    expect(await drawRecipeSheet(m, 'tech')).toBe(techIndexHtml({ seed, kitId: kit, ...(finish ? { finish } : {}) }));
    expect(await drawRecipeSheet(m, 'nope')).toBeNull();
  });

  it('a stage draws its boards, a floormap its board, a world with a UI direction its UI board; others none', () => {
    expect(recipeSheets({ kind: 'stage', art: {} }).map((s) => s.id)).toEqual(['art-board']);
    expect(recipeSheets({ kind: 'stage', kit: 'isekai-meadow', trail: true }).map((s) => s.id)).toEqual(['trail-board']);
    expect(recipeSheets({ kind: 'floormap' }).map((s) => s.id)).toEqual(['floormap-board']);
    expect(recipeSheets({ kind: 'controllable', play: { ui: { guide: {} } } }).map((s) => s.id)).toEqual(['ui-board']);
    expect(recipeSheets({ kind: 'terrain', seed: 1 })).toEqual([]);
    expect(recipeSheets(null)).toEqual([]);
  });
});

describe('the page cache', () => {
  it('draws a key once, shares a draw in flight, and forgets a failed one', async () => {
    clearPageCache();
    let n = 0;
    const draw = async () => { n += 1; return `page ${n}`; };
    const [a, b] = await Promise.all([cachedPage('k', draw), cachedPage('k', draw)]);
    expect([a, b, n]).toEqual(['page 1', 'page 1', 1]);
    await expect(cachedPage('bad', async () => { throw new Error('no'); })).rejects.toThrow('no');
    expect(await cachedPage('bad', async () => 'drawn')).toBe('drawn');
  });
});
