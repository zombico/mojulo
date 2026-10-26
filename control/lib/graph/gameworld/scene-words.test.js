// A scene from words (scene-words.js): the words a place is asked in, read into the geocube kind's keys from the same
// table a game reads (compose.js), so what a word decides for a scene's cube it decides for a game's: the backport.
import { describe, expect, it } from 'vitest';
import { sceneOfWords } from './scene-words.js';
import { composeGameworld, readPrompt } from './compose.js';

describe('a scene from words', () => {
  it('the operator\'s field: every word read, the cube open with wildflowers, the path at noon', () => {
    const S = sceneOfWords('A colorful grassy field in the daytime');
    expect(S).toMatchObject({ show: 'path', hour: 'noon', cube: { from: 'island-noon', outside: { cliff: false }, biocube: { from: 'meadow', flora: { flowers: { share: 0.4 } } } } });
    expect(S.brief.unread).toEqual([]);
    expect(S.trail).toBeUndefined();
    expect(S.clouds).toBeUndefined();
  });

  it('lowers the land the words name onto the path, as a level\'s trail takes it', () => {
    const S = sceneOfWords('a misty rocky meadow, snowy');
    expect(S.cube.snow).toBe(true);
    expect(S.clouds).toMatchObject({ kind: 'overcast' });
    expect(S.trail.rocks.boulders).toBeGreaterThan(1);
  });

  it('a cliff word wins over an open one; a game\'s word gives way; the same words, the same keys', () => {
    const S = sceneOfWords('red plains under basalt cliffs');
    expect(S.cube.outside?.cliff).toBeUndefined();
    expect(S.brief.read.find((r) => r.word === 'plains').decides).toEqual(['outside.cliff (gave way to basalt)']);
    expect(sceneOfWords('a grassy field with a castle and relics').brief.read.filter((r) => r.decides.some((d) => d.includes('gave way'))).map((r) => r.word)).toEqual(['castle', 'relics']);
    expect(sceneOfWords('a night meadow').cube).toMatchObject({ from: 'gothic-night' });
    expect(sceneOfWords('a colorful grassy field')).toEqual(sceneOfWords('a colorful grassy field'));
    expect(() => sceneOfWords('  ')).toThrow(/a few words about the place/);
  });
});

describe('the game reads the same words onto its cube', () => {
  it('a composed world on a field: its cube open, wildflowers in its grass, every level it paints takes them', () => {
    const w = composeGameworld({ prompt: 'a colorful grassy field with a castle at the end', seed: 1 });
    expect(w.style.geocube).toMatchObject({ from: 'island-noon', outside: { cliff: false }, biocube: { flora: { flowers: { share: 0.4 } } } });
    for (const word of ['colorful', 'grassy', 'field']) expect(w.brief.unread).not.toContain(word);
  });

  it('plains under cliffs keep their cliffs; a word a tunnel read as a thing is not the land; a prompt without them is as before', () => {
    expect(composeGameworld({ prompt: 'realistic red plains, granite cliffs, a clear sky', seed: 1 }).style.geocube?.outside?.cliff).toBeUndefined();
    const steam = composeGameworld({ prompt: 'a steampunk frontier: steam trains, iron truss bridges, rifles and field cannon', seed: 1 });
    expect(steam.style.geocube?.outside?.cliff).toBeUndefined();
    expect(composeGameworld({ prompt: 'a haunted forest of misty hills', seed: 2 }).style.geocube).toEqual({ from: 'gothic-night', outside: { base: 'isekai-bamboo' } });
    expect(readPrompt('wildflowers').read[0].decides).toEqual(['flora.flowers']);
  });
});
