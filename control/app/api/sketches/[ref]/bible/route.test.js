process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/bible: a stored gameworld read as its bible, resolved from the recipe on every read (the
 * character bible when it has a character book, else the world bible); any other kind is told this route is not its.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { MEADOWMARK, MEADOWMARK_HERO, characterBibleHtml, gameworldBibleHtml } from '@/lib/graph/gameworld/index';
import { GET } from './route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'gw_hero', title: 'Meadowmark', manifest: { kind: 'gameworld', ...MEADOWMARK_HERO } });
  SketchRepository.create({ ref: 'gw_ground', title: 'Meadowmark', manifest: { kind: 'gameworld', ...MEADOWMARK } });
  SketchRepository.create({ ref: 'sk_other', title: 'other', manifest: { kind: 'terrain', seed: 1 } });
});

const bible = (ref, q = '') => GET(new NextRequest(`http://localhost/api/sketches/${ref}/bible${q}`), { params: Promise.resolve({ ref }) });

describe('GET /bible', () => {
  it('the character bible of a world with a character book, the world bible otherwise, the same bytes the sheets make', async () => {
    const hero = await bible('gw_hero');
    expect(hero.status).toBe(200);
    expect(hero.headers.get('content-type')).toMatch(/text\/html/);
    expect(await hero.text()).toBe(characterBibleHtml(MEADOWMARK_HERO));
    expect(await (await bible('gw_ground')).text()).toBe(gameworldBibleHtml(MEADOWMARK));
    expect((await bible('gw_hero', '?download=1')).headers.get('content-disposition')).toMatch(/attachment; filename="Meadowmark\.html"/);
  }, 60_000);

  it('another kind is not its: 422; a missing ref 404', async () => {
    expect((await bible('sk_other')).status).toBe(422);
    expect((await bible('nope')).status).toBe(404);
  });
});
