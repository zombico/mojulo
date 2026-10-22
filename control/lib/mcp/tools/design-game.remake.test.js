process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * design_game's game step, made and remade (realize): the game the make stores and the game a remake writes in place
 * are the same game: the screen it is made for, its front, a run, its languages all kept; the mint's own asks
 * (allow_unaudited, auto_audit) never stored. A small stage level, made unaudited, no world run.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { realize } from './design-game.js';

const LEVEL = { kind: 'stage', geocube: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 6, d: 6, h: 4 }], game: { levelRef: 'lv', mechanics: [{ kind: 'reach-exit', at: [3, 3, 0], radius: 2 }] } };
const ORDER = {
  title: 'Gate Run', store: { slices: [{ name: 'campaign', kind: 'progression' }] }, levels: [{ ref: 'lv', title: 'The Gate' }],
  allow_unaudited: true, theme: { accent: '#7a2f8e' }, shell: 'play', screen: 'phone',
  front: { tagline: 'Through the gate' }, languages: { source: 'en', locales: ['en', 'ja'], strings: { ja: { 'The Gate': '門' } } },
};

beforeEach(() => { closeDb(); getDb(); SketchRepository.create({ ref: 'lv', title: 'a level', manifest: LEVEL }); });
const stored = () => SketchRepository.getByRef('g').manifest;

describe('the game step, made and remade', () => {
  it('made: the screen, the front and the languages on the game; the mint\'s asks not', async () => {
    await realize({ key: 'game', ref: 'g', order: ORDER }, 'make');
    expect(stored()).toMatchObject({ kind: 'game', screen: 'phone', front: ORDER.front, languages: ORDER.languages, shell: 'play' });
    expect(stored().allow_unaudited).toBeUndefined();
  });

  it('remade in place: every key the make wrote kept (a moved title, a new word), none of the mint\'s', async () => {
    await realize({ key: 'game', ref: 'g', order: ORDER }, 'make');
    const moved = { ...ORDER, title: 'Gate Run II', run: { length: 1 }, languages: { ...ORDER.languages, strings: { ja: { 'The Gate': '門', 'Gate Run II': 'ゲートラン II' } } }, auto_audit: true };
    await realize({ key: 'game', ref: 'g', order: moved }, 'remake');
    const g = stored();
    expect(g).toMatchObject({ kind: 'game', title: 'Gate Run II', screen: 'phone', front: ORDER.front, run: { length: 1 }, theme: ORDER.theme, languages: moved.languages });
    expect(g.allow_unaudited).toBeUndefined();
    expect(g.auto_audit).toBeUndefined();
  });

  it('a remade order with no theme keeps the one the make gave', async () => {
    await realize({ key: 'game', ref: 'g', order: ORDER }, 'make');
    const { theme: _t, ...bare } = ORDER;
    await realize({ key: 'game', ref: 'g', order: bare }, 'remake');
    expect(stored().theme).toEqual(ORDER.theme);
  });
});
