// Isolate to in-memory SQLite before any import that pulls db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { designGameHandler } from './design-game.js';
import { quickWorld } from '@/lib/graph/gameworld/quick.js';

// A game with a `music`, made through design_game: the score's cues the game names by ref (gameworld/cue-sheet.js,
// runner.js gameCues) are minted as steps, the game carries them, and a changed answer remakes its cue in place.
// A whole run (a level and a game are made): the e2e tier's.

describe('design_game: a game scored from its cue sheet', () => {
  it('mints the outcomes\' stingers, names them on the game, scores its level; a changed answer remakes that cue alone', async () => {
    const world = { ...quickWorld({ id: 'sc', quick: { goal: 'reach' } }), music: {} };
    let r = await designGameHandler({ world, ref: 'sc', run: true });
    for (let i = 0; i < 6 && r.pending?.length; i++) r = await designGameHandler({ ref: 'sc', run: true });
    const game = SketchRepository.getByRef('sc-game');
    expect(game.manifest.music).toEqual({ victory: 'sc-cue-victory', defeat: 'sc-cue-defeat' });
    const cue = SketchRepository.getByRef('sc-cue-victory');
    expect(cue.manifest).toMatchObject({ kind: 'beats-composition', score: { mood: 'victory' } });
    // one identity: the stinger's and the level's
    const level = SketchRepository.getByRef(game.manifest.levels[0].ref);
    expect(level.manifest.audio.soundtrack.score.game).toBe(cue.manifest.score.game);
    const again = await designGameHandler({ ref: 'sc', patch: [{ op: 'set', path: '/music/cues', value: { victory: 'triumph' } }], run: true });
    const did = Object.fromEntries(again.ran.map((x) => [x.key, x.action]));
    expect(did).toMatchObject({ 'cue-victory': 'remake', 'cue-defeat': 'keep', game: 'keep' });
    expect(SketchRepository.getByRef('sc-cue-victory').manifest.score.mood).toBe('triumph');
  }, 600000);
});
