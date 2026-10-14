process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/projects: the projects on a rail, by what they are, last touched first; what a project made for itself is
 * its page's, not the shelf's. GET /api/arcade says where each game came from, so Play can group them.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET } from './route.js';
import { GET as arcade } from '../arcade/route.js';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'gw', title: 'A world', manifest: { kind: 'gameworld', id: 'w', made: { game: { ref: 'gw-game', order: '00000000', stored: '00000000' } } } });
  SketchRepository.create({ ref: 'quick', title: 'A quick game', manifest: { kind: 'gameworld', id: 'q', quick: { goal: 'reach' }, made: { game: { ref: 'quick-game', order: '00000000', stored: '00000000' } } } });
  SketchRepository.create({ ref: 'house', title: 'A house', manifest: { kind: 'floorplan', seed: 3 } });
  SketchRepository.create({ ref: 'city', title: 'A city', manifest: { kind: 'city', seed: 3 } });
  SketchRepository.create({ ref: 'city-r1c1', title: 'a segment', manifest: { kind: 'city', city: 'city', level: { segment: 'r1c1' } } });
  SketchRepository.create({ ref: 'city-in-b1', title: 'an inside', manifest: { kind: 'store', level: { door: 'out' } } });
  SketchRepository.create({ ref: 'terrain', title: 'ground', manifest: { kind: 'terrain', seed: 1 } });
  for (const [ref, m] of [['gw-game', {}], ['quick-game', {}], ['brick', { engine: 'pixelizer', reducer: 'brickster' }], ['plain', {}]]) {
    SketchRepository.create({ ref, title: ref, manifest: { kind: 'game', levels: [], ...m } });
  }
});

const projects = async (q = '') => (await (await GET(new NextRequest(`http://localhost/api/projects${q}`))).json());

describe('GET /api/projects', () => {
  it('lists the projects of a group, and leaves out what a project made for itself', async () => {
    expect((await projects('?group=worlds')).projects.map((p) => p.ref).sort()).toEqual(['gw', 'quick']);
    const places = (await projects('?group=places')).projects;
    expect(places.map((p) => p.ref).sort()).toEqual(['city', 'house']);
    expect(places.find((p) => p.ref === 'house')).toMatchObject({ title: 'A house', kind: 'floorplan', group: 'places' });
  });

  it('every group at once, capped; an unknown group is refused', async () => {
    expect((await projects()).projects.map((p) => p.ref).sort()).toEqual(['city', 'gw', 'house', 'quick']);
    expect((await projects('?limit=2')).projects).toHaveLength(2);
    expect((await GET(new NextRequest('http://localhost/api/projects?group=tools'))).status).toBe(400);
  });
});

describe('GET /api/arcade — where each game came from', () => {
  it('a world\'s run, a quick game, a pixelizer game, or create_game alone', async () => {
    const { cabinets } = await (await arcade()).json();
    const by = Object.fromEntries(cabinets.map((c) => [c.ref, c]));
    expect(by['gw-game']).toMatchObject({ source: 'world', world: 'gw' });
    expect(by['quick-game']).toMatchObject({ source: 'quick', world: 'quick' });
    expect(by.brick).toMatchObject({ source: 'pixel', world: null });
    expect(by.plain).toMatchObject({ source: 'game', world: null });
  });
});
