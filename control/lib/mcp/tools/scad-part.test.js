// The part lane: a recipe-book part minted by name through mint_solid kind 'scad', its params checked, its program
// stamped beside them, rewritten by an /params edit and detached by a hand edit under /source.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
// vitest.setup.js turns the bundled book off for the suite; the parts live in it.
delete process.env.MOJULO_BUNDLED_BOOK;
process.env.MOJULO_COOKBOOK = '/nonexistent-cookbook';

import { beforeAll, describe, expect, it } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { loadOpenscad } from '@/lib/graph/scad/scad-render';
import { _resetSolidVocabCache } from '@/lib/graph/solid-vocab/loader';
import { _resetBookLoader } from '@/lib/graph/views/recipe-book/loader';
import { getSolidVocabHandler } from './mint-solid.js';
import { createScadHandler } from './scad.js';
import { partDef, resolvePartParams } from './scad-part.js';
import { updateSketchHandler } from './sketches.js';

const hasWasm = (await loadOpenscad()) != null;
const PARTS = ['wall-hook', 'phone-stand', 'lidded-box'];

// imports run before the env lines above take effect, so the caches they warmed are cleared once here
beforeAll(() => { _resetBookLoader(); _resetSolidVocabCache(); });

describe('the book parts', () => {
  it('load from the bundled book, each with a card in the solid vocab', async () => {
    for (const id of PARTS) {
      const def = await partDef(id);
      expect(def.id).toBe(id);
      const card = await getSolidVocabHandler({ id });
      expect(JSON.stringify(card)).toMatch(/params/i);
    }
    await expect(partDef('spaceship')).rejects.toThrow(/Parts in the recipe book: .*wall-hook/);
  });

  it('resolve params over the defaults and refuse a stranger, a wrong type or a value out of range', async () => {
    const def = await partDef('wall-hook');
    expect(resolvePartParams(def, {}).reach).toBe(40);
    expect(resolvePartParams(def, { reach: 60 }).reach).toBe(60);
    expect(() => resolvePartParams(def, { colour: 'red' })).toThrow(/'colour' is not a wall-hook param/);
    expect(() => resolvePartParams(def, { reach: '40' })).toThrow(/reach is a number/);
    expect(() => resolvePartParams(def, { reach: 500 })).toThrow(/reach is 15–120 mm/);
    expect(() => resolvePartParams(def, { screw: 'M8' })).toThrow(/screw is one of M3 \| M4 \| M5 \| none/);
  });
});

describe.skipIf(!hasWasm)('minting a part', () => {
  it.each(PARTS)('%s mints closed at its defaults, the program stamped beside its name', async (id) => {
    const out = await createScadHandler({ part: id });
    expect(out.stats.warnings ?? []).toEqual([]);
    const m = SketchRepository.getByRef(out.ref).manifest;
    expect(m.part).toBe(id);
    expect(m).not.toHaveProperty('params');   // a look names none
    expect(m.source).toMatch(/recipe-book part/);
  });

  it('a box with a lid is two parts, the lid beside the base', async () => {
    const out = await createScadHandler({ part: 'lidded-box', params: { inside_w: 60 } });
    expect(out.stats.parts.map((p) => p.name).sort()).toEqual(['base', 'lid']);
  });

  it('the fit the ask names reaches the geometry: a deeper hook is a longer part', async () => {
    const a = await createScadHandler({ part: 'wall-hook' });
    const b = await createScadHandler({ part: 'wall-hook', params: { reach: 80 } });
    expect(b.stats.parts[0].size.w - a.stats.parts[0].size.w).toBeCloseTo(40, 0);
  });

  it('refuses `source` with `part`, and `params` without one', async () => {
    await expect(createScadHandler({ part: 'wall-hook', source: 'cube(1);' })).rejects.toThrow(/not both/);
    await expect(createScadHandler({ source: 'cube(1);', params: { reach: 1 } })).rejects.toThrow(/belongs to a recipe-book `part`/);
  });

  it('an /params edit rewrites the program; a hand edit under /source detaches the row', async () => {
    const { ref } = await createScadHandler({ part: 'phone-stand', ask: 'fit' });
    await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/params', value: { device: 14, cable: false } }] });
    let m = SketchRepository.getByRef(ref).manifest;
    expect(m.source).toMatch(/device = 14;/);
    expect(m.source).toMatch(/cable = false;/);
    await expect(updateSketchHandler({ ref, patch: [{ op: 'set', path: '/params', value: { angle: 10 } }] })).rejects.toThrow(/angle is 45–80/);

    const edited = `${m.source}\ntranslate([0, 0, -2]) cube([5, 5, 2]);\n`;
    await updateSketchHandler({ ref, patch: [{ op: 'set', path: '/source', value: edited }] });
    m = SketchRepository.getByRef(ref).manifest;
    expect(m).not.toHaveProperty('part');
    expect(m).not.toHaveProperty('params');
    expect(m.source).toBe(edited);
    expect(m.ask).toBe('fit');
  });
});
