process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * design_game's `localize`: a game's languages declared on its gameworld (carried whole onto the game) or on a game made
 * on its own; a language briefed (its conventions, the gamer's words, each word owed with what it is); a localizer's
 * lines folded in with their slots held, stored, and the brief's next batch; the coverage and a link that plays each
 * language. Small stage levels: the words read where the World route reads them.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { readGameworld } from '@/lib/graph/gameworld/world.js';
import { GAMEWORLD_KIND } from '@/lib/graph/gameworld/gameworld-kind.js';

const STAGE = { kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 6, d: 6, h: 4 }] };
const LEVEL = { ...STAGE, signage: [{ id: 'gate', text: 'North gate', anchor: { at: [2, 2, 2] } }], game: { levelRef: 'level', mechanics: [{ kind: 'reach-exit', at: [3, 3, 0], radius: 2 }] } };
const GAME = { kind: 'game', title: 'Gate Run', shell: 'play', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'level', title: 'The Gate' }] };
const W = { id: 'keep', seed: 8, levels: { a: { walk: { nodes: { t: { trail: true } } } } } };

beforeEach(() => {
  closeDb(); getDb();
  SketchRepository.create({ ref: 'level', title: 'a level', manifest: LEVEL });
  SketchRepository.create({ ref: 'g', title: 'Gate Run', manifest: GAME });
  SketchRepository.create({ ref: 'gw', title: 'keep', manifest: { kind: GAMEWORLD_KIND, ...W } });
});
const L = (localize, ref = 'g') => designGameHandler({ ref, localize });

describe('a game made on its own', () => {
  it('declared: the source added first, stored on the game, each language\'s coverage and the link that plays it', async () => {
    const out = await L({ languages: ['ja', 'ar'] });
    expect(out.languages).toEqual({ source: 'en', locales: ['en', 'ja', 'ar'] });
    expect(SketchRepository.getByRef('g').manifest.languages).toEqual({ source: 'en', locales: ['en', 'ja', 'ar'] });
    expect(out.coverage.ja).toMatchObject({ done: 0, play: '/api/sketches/g/game?lang=ja' });
    expect(out.coverage.ja.total).toBeGreaterThan(50);   // the shell's own words, the game's, the level's and its page's
    expect(out.next).toMatch(/localize: \{ lang/);
  });

  it('briefed: the conventions, the gamer\'s words, each word owed with what it is and where; a batch at a time', async () => {
    await L({ languages: ['ja'] });
    const { brief } = await L({ lang: 'ja', limit: 400 });
    expect(brief.conventions).toMatchObject({ script: 'Jpan', quotes: ['「', '」'] });
    expect(brief.words.find((w) => w.text === 'North gate')).toMatchObject({ where: ['level: signs[0]', 'level: signs[0].body[0]'] });
    expect(brief.words.find((w) => w.text === 'The Gate').is[0]).toMatch(/level's name/);
    expect(brief.words.find((w) => w.text === 'paused').is[0]).toMatch(/shell/);
    expect(brief.glossary.map((g) => g.term)).toContain('Paused');
    expect((await L({ lang: 'ja', limit: 5 })).brief).toMatchObject({ owed: brief.owed, words: expect.any(Array) });
    expect((await L({ lang: 'ja', limit: 5 })).brief.words).toHaveLength(5);
  });

  it('folded in: kept, a dropped slot refused, the next batch without them; a language dropped takes its words', async () => {
    await L({ languages: ['ja', 'ar'] });
    const out = await L({ lang: 'ja', lines: [{ source: 'North gate', translation: '北門' }, { source: 'clear {level} first', translation: 'クリアしよう' }] });
    expect(out.refused).toHaveLength(1);
    expect(out.refused[0]).toMatch(/placeholders differ/);
    expect(out.coverage.ja.done).toBe(1);
    expect(SketchRepository.getByRef('g').manifest.languages.strings).toEqual({ ja: { 'North gate': '北門' } });
    expect(out.brief.words.map((w) => w.text)).not.toContain('North gate');
    const dropped = await L({ languages: ['ar'] });
    expect(dropped.languages.locales).toEqual(['en', 'ar']);
    expect(SketchRepository.getByRef('g').manifest.languages.strings).toBeUndefined();
  });

  it('says what is wrong', async () => {
    await expect(L({ lang: 'ja' })).rejects.toThrow(/no languages yet/);
    await L({ languages: ['ja'] });
    await expect(L({ lang: 'fr' })).rejects.toThrow(/one of the game's languages other than its source \(ja\)/);
    await expect(L({ lines: [] })).rejects.toThrow(/give localize.lang/);
    await expect(L({ tongue: 'ja' })).rejects.toThrow(/not a setting/);
    await expect(designGameHandler({ ref: 'g', run: true, localize: {} })).rejects.toThrow(/given alone/);
    await expect(L({ languages: ['ja'] }, 'level')).rejects.toThrow(/a gameworld or a game/);
  });
});

describe('a gameworld', () => {
  it('declared on the recipe (carried whole onto the game its run makes); nothing to brief before the run', async () => {
    const out = await L({ languages: ['es-419'] }, 'gw');
    expect(SketchRepository.getByRef('gw').manifest.languages).toEqual({ source: 'en', locales: ['en', 'es-419'] });
    expect(out.next).toMatch(/run the world/);
    expect(out.coverage).toBeUndefined();
  });

  it('is read on the world and carried whole; a bad one teaches', () => {
    const languages = { source: 'en', locales: ['en', 'ja'], strings: { ja: { Play: 'プレイ' } } };
    expect(readGameworld({ ...W, languages }).languages).toEqual(languages);
    expect('languages' in readGameworld(W)).toBe(false);
    expect(() => readGameworld({ ...W, languages: { source: 'en', locales: ['en'] } })).toThrow(/gameworld: languages.locales/);
  });
});
