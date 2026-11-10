process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/bible: a stored gameworld read as its bible, resolved from the recipe on every read (the
 * character bible when it has a character book, else the world bible); a house read as its structure book; any other
 * kind is told this route is not its.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { MEADOWMARK, MEADOWMARK_HERO, characterBibleHtml, gameworldBibleHtml } from '@/lib/graph/gameworld/index';
import { structureBookHtml } from '@/lib/graph/structure/book-html';
import { gameworldAtlasHtml } from '@/lib/graph/gameworld/atlas-html';
import { GET } from './route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'gw_hero', title: 'Meadowmark', manifest: { kind: 'gameworld', ...MEADOWMARK_HERO } });
  SketchRepository.create({ ref: 'gw_ground', title: 'Meadowmark', manifest: { kind: 'gameworld', ...MEADOWMARK } });
  SketchRepository.create({ ref: 'sk_other', title: 'other', manifest: { kind: 'terrain', seed: 1 } });
  SketchRepository.create({ ref: 'sk_house', title: 'A house', manifest: HOUSE });
});

const HOUSE = { kind: 'floorplan', seed: 5, storeys: 2, roof: 'hip', windows: true };
const bible = (ref, q = '') => GET(new NextRequest(`http://localhost/api/sketches/${ref}/bible${q}`), { params: Promise.resolve({ ref }) });

describe('GET /bible', () => {
  it('the world bible of every world, its character bible on asking, the same bytes the sheets make', async () => {
    const world = await bible('gw_hero');
    expect(world.status).toBe(200);
    expect(world.headers.get('content-type')).toMatch(/text\/html/);
    // a world with a hero keeps its world bible: the map, the land, the civilizations, each level
    expect(await world.text()).toBe(gameworldBibleHtml(MEADOWMARK_HERO));
    expect(await (await bible('gw_hero', '?book=characters')).text()).toBe(characterBibleHtml(MEADOWMARK_HERO));
    expect(await (await bible('gw_ground')).text()).toBe(gameworldBibleHtml(MEADOWMARK));
    expect((await bible('gw_ground', '?book=characters')).status).toBe(422);
    expect((await bible('gw_hero', '?book=elsewhere')).status).toBe(400);
    // the atlas: the world's levels drawn as a map, in a look; a look it does not have refused
    expect(await (await bible('gw_hero', '?book=atlas&look=ink')).text()).toBe(gameworldAtlasHtml(MEADOWMARK_HERO, { look: 'ink' }));
    expect((await bible('gw_hero', '?book=atlas&look=sepia')).status).toBe(400);
    // the practice room: a world whose feel does not fight hand to hand (or that writes none) has none, and says why; a
    // cast it does not stand in refused (the room itself: gameworld/practice-room.live.test.js)
    const none = await bible('gw_ground', '?book=practice');
    expect(none.status).toBe(422);
    expect((await none.json()).reason).toMatch(/writes no feel/);
    SketchRepository.create({ ref: 'gw_fight', title: 'Fight', manifest: { kind: 'gameworld', ...MEADOWMARK_HERO, feel: 'fable-of-artesia' } });
    expect((await bible('gw_fight', '?book=practice&cast=robot')).status).toBe(400);
    // (a room it has not: 422, saying which it has; one that does not exist: 400)
    const lane = await bible('gw_fight', '?book=practice&room=mount');
    expect(lane.status).toBe(422);
    expect((await lane.json()).reason).toMatch(/no mount lane \(it has practice\)/);
    expect((await bible('gw_fight', '?book=practice&room=yard')).status).toBe(400);
    expect((await bible('gw_hero', '?download=1')).headers.get('content-disposition')).toMatch(/attachment; filename="Meadowmark\.html"/);
    expect((await bible('gw_hero', '?book=characters&download=1')).headers.get('content-disposition')).toMatch(/attachment; filename="Meadowmark-characters\.html"/);
  }, 120_000);

  it('a house is its structure book, its World framed; a downloaded book leaves the World out', async () => {
    const res = await bible('sk_house');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toBe(structureBookHtml({ ...HOUSE, title: 'A house' }, { ref: 'sk_house', lookup: () => null, world: { src: '/api/sketches/sk_house/world' } }));
    expect(html).toContain('src="/api/sketches/sk_house/world"');
    const dl = await bible('sk_house', '?download=1');
    expect(dl.headers.get('content-disposition')).toMatch(/attachment; filename="A-house\.html"/);
    expect(await dl.text()).not.toContain('/api/sketches/sk_house/world');
  }, 60_000);

  it('another kind is not its: 422; a missing ref 404', async () => {
    expect((await bible('sk_other')).status).toBe(422);
    expect((await bible('nope')).status).toBe(404);
  });
});
