process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * The elements as routes: every family listed, one element with the recipes that name it, and its specimen drawn as a
 * live World from a recipe that is never stored.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET as list } from './route.js';
import { GET as one } from './[family]/[id]/route.js';
import { GET as world } from './[family]/[id]/world/route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'st', title: 'A hall', manifest: { kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 6, d: 6, h: 4 }] } });
});

const params = (p) => ({ params: Promise.resolve(p) });

describe('GET /api/elements', () => {
  it('lists every family with its elements', async () => {
    const body = await (await list()).json();
    expect(body.families.map((f) => f.id)).toEqual(['geocubes', 'kits', 'grammars']);
    expect(body.families[0].elements[0]).toHaveProperty('colours');
  });

  it('one element, with the recipes that name it; an unknown one is not found', async () => {
    const body = await (await one(new NextRequest('http://localhost/api/elements/geocubes/gothic-night'), params({ family: 'geocubes', id: 'gothic-night' }))).json();
    expect(body).toMatchObject({ family: 'geocubes', id: 'gothic-night' });
    expect(body.usedBy).toEqual([{ ref: 'st', title: 'A hall', kind: 'stage' }]);
    expect((await one(new NextRequest('http://localhost/api/elements/geocubes/nope'), params({ family: 'geocubes', id: 'nope' }))).status).toBe(404);
  });

  it('draws a specimen as a World page; a view it does not have is not found', async () => {
    const res = await world(new NextRequest('http://localhost/api/elements/geocubes/gothic-night/world?view=room'), params({ family: 'geocubes', id: 'gothic-night' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    expect(await res.text()).toMatch(/three/);
    expect((await world(new NextRequest('http://localhost/api/elements/geocubes/gothic-night/world?view=sky'), params({ family: 'geocubes', id: 'gothic-night' }))).status).toBe(404);
  }, 120_000);
});
