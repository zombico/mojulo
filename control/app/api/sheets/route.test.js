process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * The sheets as routes: the repertoire listed and drawn in a kit, a recipe's own sheets drawn from it, and the project
 * page's reading of a recipe that draws sheets but is on no rail.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { MEADOWMARK } from '@/lib/graph/gameworld/index';
import { outLandHtml } from '@/lib/graph/era/out-land-html';
import { ALL_KITS, ISEKAI_KITS } from '@/lib/graph/sheets/registry';
import { GET as list } from './route.js';
import { GET as repertoire } from './[id]/route.js';
import { GET as recipeSheet } from '../sketches/[ref]/sheet/[id]/route.js';
import { GET as rail } from '../sketches/[ref]/rail/route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'gw', title: 'Meadowmark', manifest: { kind: 'gameworld', ...MEADOWMARK } });
  SketchRepository.create({ ref: 'fm', title: 'Manor', manifest: { kind: 'floormap', seed: 3 } });
});

const req = (url) => new NextRequest(`http://localhost${url}`);

describe('the repertoire', () => {
  it('lists every sheet with its kits, and draws one in a kit', async () => {
    const body = await (await list()).json();
    expect(body.kits).toEqual(ALL_KITS);
    expect(body.sheets.map((s) => s.id)).toContain('castle');
    const res = await repertoire(req('/api/sheets/land?kit=gothic-stone&seed=3'), { params: Promise.resolve({ id: 'land' }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(outLandHtml({ seed: 3, kitId: 'gothic-stone' }));
  });

  it('refuses a kit the sheet does not draw in, names the ones it does; an unknown sheet is not found', async () => {
    const indoor = ALL_KITS.find((k) => !ISEKAI_KITS.includes(k));
    const res = await repertoire(req(`/api/sheets/castle?kit=${indoor}`), { params: Promise.resolve({ id: 'castle' }) });
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toContain(ISEKAI_KITS[0]);
    expect((await repertoire(req('/api/sheets/nope'), { params: Promise.resolve({ id: 'nope' }) })).status).toBe(404);
  });
});

describe('a recipe\'s sheets', () => {
  it('a gameworld\'s own land, in its kit and seed; a sheet it does not draw is not found', async () => {
    const res = await recipeSheet(req('/api/sketches/gw/sheet/land'), { params: Promise.resolve({ ref: 'gw', id: 'land' }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(outLandHtml({ seed: MEADOWMARK.seed, kitId: MEADOWMARK.style.kit }));
    const dl = await recipeSheet(req('/api/sketches/gw/sheet/land?download=1'), { params: Promise.resolve({ ref: 'gw', id: 'land' }) });
    expect(dl.headers.get('content-disposition')).toMatch(/attachment; filename="Meadowmark-land\.html"/);
    expect((await recipeSheet(req('/api/sketches/gw/sheet/art-board'), { params: Promise.resolve({ ref: 'gw', id: 'art-board' }) })).status).toBe(404);
  }, 120_000);

  it('the rail lists a gameworld\'s sheets; a floormap, on no rail, is a page of its board', async () => {
    const world = await (await rail(req('/api/sketches/gw/rail'), { params: Promise.resolve({ ref: 'gw' }) })).json();
    expect(world.sheets.map((s) => s.id)).toContain('land');
    expect(world.sheets[0].href).toBe(`/api/sketches/gw/sheet/${world.sheets[0].id}`);
    const fm = await (await rail(req('/api/sketches/fm/rail'), { params: Promise.resolve({ ref: 'fm' }) })).json();
    expect(fm).toMatchObject({ rail: null, kind: 'floormap', outcomes: [], parts: [] });
    expect(fm.sheets.map((s) => s.id)).toEqual(['floormap-board']);
  }, 120_000);
});
