process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * GET /api/sketches/[ref]/world?lang=<tag>&game=<game ref>: a level as its game localizes it (game/game-languages.js
 * pageLocale, game/level-words.js localizePayload): its words from the game's table, its page in the language. A game
 * or a language it does not declare, or no ask at all: the page as ever. A word localized since is never answered with
 * the old page (the table joins the cache key).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { GET } from './route.js';

const STAGE = { kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 6, d: 6, h: 4 }] };
const LEVEL = { ...STAGE, signage: [{ id: 'gate', text: 'North gate', anchor: { at: [2, 2, 2] } }], game: { levelRef: 'level', mechanics: [{ kind: 'reach-exit', at: [3, 3, 0], radius: 2 }] } };
const GAME = (strings) => ({ kind: 'game', title: 'G', store: { slices: [{ name: 'p', kind: 'progression' }] }, levels: [{ ref: 'level' }], languages: { source: 'en', locales: ['en', 'ja', 'ar'], strings } });

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'level', title: 'a level', manifest: LEVEL });
  SketchRepository.create({ ref: 'g', title: 'G', manifest: GAME({ ja: { 'North gate': '北門' } }) });
  SketchRepository.create({ ref: 'mono', title: 'M', manifest: { ...GAME(), languages: undefined } });
});

const page = async (q = '') => (await GET(new NextRequest(`http://localhost/api/sketches/level/world${q}`), { params: Promise.resolve({ ref: 'level' }) })).text();

describe('GET /world: a level in its game\'s language', () => {
  it('a declared language: its words and its tag; the source: as ever', async () => {
    const plain = await page();
    expect(plain).toContain('North gate');
    const ja = await page('?lang=ja&game=g');
    expect(ja).toContain('北門');
    expect(ja).not.toContain('North gate');
    expect(ja).toContain('<html lang="ja"');
    expect(await page('?lang=ar&game=g')).toContain('dir="rtl"');   // no words yet: the source words, in an Arabic page
    expect(await page('?lang=en&game=g')).toBe(plain);
  });

  it('a language the game does not declare, a game with none, half an ask: the page as ever', async () => {
    const plain = await page();
    expect(await page('?lang=fr&game=g')).toBe(plain);
    expect(await page('?lang=ja&game=mono')).toBe(plain);
    expect(await page('?lang=ja&game=nope')).toBe(plain);
    expect(await page('?lang=ja')).toBe(plain);
  });

  it('a word localized since is served at once, not the cached page', async () => {
    expect(await page('?lang=ja&game=g')).toContain('北門');
    SketchRepository.update({ ref: 'g', manifest: GAME({ ja: { 'North gate': '北の門' } }) });
    expect(await page('?lang=ja&game=g')).toContain('北の門');
  });
});
