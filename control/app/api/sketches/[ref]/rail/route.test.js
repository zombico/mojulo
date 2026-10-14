process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/rail: a stored recipe's rail as JSON, read from the recipe and the store on every call; a part
 * is found through the store; a recipe on no rail is told so.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readRail } from '@/lib/graph/rail/index';
import { GET } from './route.js';

const HOUSE = { kind: 'floorplan', seed: 3, windows: true, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L', items: [{ ref: 'sk_chair', at: [0.5, 0.6], size: [2, 2] }] }] };

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'sk_house', title: 'A house', manifest: HOUSE });
  SketchRepository.create({ ref: 'sk_other', title: 'other', manifest: { kind: 'terrain', seed: 1 } });
});

const rail = (ref) => GET(new NextRequest(`http://localhost/api/sketches/${ref}/rail`), { params: Promise.resolve({ ref }) });

describe('GET /rail', () => {
  it('a building is its rail, the same the read gives, its pieces found in the store', async () => {
    const res = await rail('sk_house');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ref: 'sk_house', title: 'A house', rail: 'structure' });
    expect(body.outcomes).toEqual(readRail(HOUSE, { ref: 'sk_house' }).outcomes);
    expect(body.parts).toEqual([{ ref: 'sk_chair', role: 'piece', state: 'missing' }]);
    expect(body.files).toEqual([]);
    SketchRepository.create({ ref: 'sk_chair', title: 'chair', manifest: { kind: 'scad', source: 'cube(10);' } });
    expect((await (await rail('sk_house')).json()).parts[0]).toMatchObject({ ref: 'sk_chair', state: 'fresh', kind: 'scad' });
  });

  it('a recipe on no rail is told so; a ref with no sketch is not found', async () => {
    const off = await rail('sk_other');
    expect(off.status).toBe(422);
    expect(await off.json()).toMatchObject({ eligible: false });
    expect((await rail('sk_none')).status).toBe(404);
  });
});
