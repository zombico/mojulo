// A scene from words (scene-words.js): the words a place is asked in, read into the geocube kind's keys from the same
// table a game reads (compose.js), so what a word decides for a scene's cube it decides for a game's: the backport.
import { describe, expect, it } from 'vitest';
import { sceneOfWords } from './scene-words.js';
import { composeGameworld, readPrompt, readingOf } from './compose.js';
import { glyphOf, GLYPH_WORDS } from './glyph-words.js';
import { HEARTBEATS, SPLATCHES } from '../painted-landscape-cards/loader.js';

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

describe('water and biomes, one table for the scene and the game', () => {
  it('the water words lay their water on the cube; a fall keeps the cliff an open word would take', () => {
    expect(sceneOfWords('a quiet lake beside a meadow').cube).toMatchObject({ outside: { water: { lake: true } } });
    expect(sceneOfWords('a sandy beach by the sea').cube).toMatchObject({ from: 'island-noon', outside: { water: { coast: true } } });
    const R = sceneOfWords('a meadow with a river and a waterfall');
    expect(R.cube.outside.water).toEqual({ river: true });
    expect(R.trail.ground.water).toEqual({ falls: true });
    const F = sceneOfWords('an open field with a waterfall');
    expect(F.cube.outside?.cliff).toBeUndefined();
    expect(F.brief.read.find((r) => r.word === 'field').decides).toEqual(['outside.cliff (gave way to waterfall)']);
  });

  it('a biome lays its flora, its ground and its palette\'s character (the theorist\'s, solved at the stamp)', () => {
    const D = sceneOfWords('desert dunes at sunset').cube;
    expect(D).toMatchObject({ biocube: 'desert', outside: { land: { skin: 'sandstone' } } });
    expect(D.palette.heat).toBeGreaterThan(0.3);
    expect(D.palette.seed).toBeUndefined();
    expect(sceneOfWords('an alpine meadow').cube.biocube).toBe('alpine');
    expect(sceneOfWords('a coastal path').cube).toMatchObject({ biocube: 'coast', outside: { water: { coast: true } } });
  });

  it('the game reads the same water onto its cube', () => {
    const w = composeGameworld({ prompt: 'a village by a lake, a river through the hills', seed: 1 });
    expect(w.style.geocube.outside.water).toEqual({ lake: true, river: true });
  });
});

describe('the painted landscape\'s glyphs as words: derived from each card, never a lookup', () => {
  it('a word the shared table reads stays its; a glyph reads where none does; a generic alias is no glyph', () => {
    expect(readingOf('meadow')).toEqual({ kit: 'isekai-meadow' });
    expect(Object.keys(GLYPH_WORDS)).not.toContain('water');
    expect(readingOf('taiga')['flora.biocube'].from).toBe('alpine');
  });

  it('a heartbeat\'s dials follow its numbers: a jagged one bumpier than a smooth one', () => {
    // one card per engine: the roughest and the smoothest by their own octaves
    const fbm = Object.entries(HEARTBEATS).filter(([, c]) => c.fbm).sort((a, b) => a[1].fbm.octaves[1] - b[1].fbm.octaves[1]);
    const word = ([, c]) => c.aliases.find((a) => glyphOf(a)), rough = glyphOf(word(fbm.at(-1))).decides, calm = glyphOf(word(fbm[0])).decides;
    expect(rough['trail.bumpiness']).toBeGreaterThan(calm['trail.bumpiness']);
    expect(rough['trail.heartbeat']).toBeGreaterThan(calm['trail.heartbeat']);
  });

  it('a splatch is the palette\'s character, not its colours: axes the theorist solves, warm warmer than cold', () => {
    const axes = (id) => glyphOf(SPLATCHES[id].aliases.find((a) => glyphOf(a)?.id === id)).decides.palette;
    const ids = Object.keys(SPLATCHES).filter((id) => SPLATCHES[id].aliases.some((a) => glyphOf(a)?.id === id));
    const hue = (id) => parseInt(SPLATCHES[id].seeds[1].slice(1, 3), 16) - parseInt(SPLATCHES[id].seeds[1].slice(5, 7), 16);
    const [cold, warm] = [ids.reduce((a, b) => (hue(a) < hue(b) ? a : b)), ids.reduce((a, b) => (hue(a) > hue(b) ? a : b))];
    expect(axes(warm).heat).toBeGreaterThan(axes(cold).heat);
    for (const id of [cold, warm]) expect(JSON.stringify(axes(id))).not.toMatch(/#[0-9a-f]{6}/);
    expect(Object.keys(sceneOfWords('an arctic meadow').cube.palette).sort()).toEqual(['activity', 'heat', 'intent', 'weight']);
  });

  it('a sky gives the hour and the clouds; a camera is a scene\'s still, never a game\'s', () => {
    expect(sceneOfWords('a meadow at moonrise')).toMatchObject({ hour: 'night' });
    expect(sceneOfWords('a meadow under cirrus').clouds).toMatchObject({ kind: 'high' });
    expect(sceneOfWords('a top-down meadow').camera).toBe('overhead');
    expect(readingOf('top-down')).toBeNull();
    expect(readPrompt('top-down', { scene: true }).read[0].decides).toEqual(['camera']);
  });
});
