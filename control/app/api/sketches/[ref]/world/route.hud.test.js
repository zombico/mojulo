process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/world and the dev-chrome strip (view cams, wireframe, fly / walk, reverse view, AI attack):
 * shown on a plain world, hidden on a game's level (a play screen, wherever it is opened), and either way by ?hud=.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET } from './route.js';

const STAGE = { kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 6, d: 6, h: 4 }] };
const HIDDEN = '.hud,.moj-audio-btn{display:none}';

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'plain', title: 'a hall', manifest: STAGE });
  SketchRepository.create({ ref: 'level', title: 'a level', manifest: { ...STAGE, game: { levelRef: 'level', mechanics: [{ kind: 'reach-exit', at: [3, 3, 0], radius: 2 }] } } });
});

const page = async (ref, q = '') => (await GET(new NextRequest(`http://localhost/api/sketches/${ref}/world${q}`), { params: Promise.resolve({ ref }) })).text();

describe('GET /world: the dev-chrome strip', () => {
  it('shows on a plain world, hides on a game\'s level, and ?hud= says so either way', async () => {
    expect(await page('plain')).not.toContain(HIDDEN);
    expect(await page('level')).toContain(HIDDEN);
    expect(await page('level', '?hud=1')).not.toContain(HIDDEN);
    expect(await page('plain', '?hud=0')).toContain(HIDDEN);
  });
});
