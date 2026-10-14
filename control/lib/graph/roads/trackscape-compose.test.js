// A track from words: laws of the reading and the one door. One phrase per kind of word (chosen to exercise each
// category the reader has: what is raced, its shape, its amplitude, its landmark, its pole, a scene word), the
// manifest drawn and dressed, the world and the track together, the quick race's door.
import { describe, it, expect } from 'vitest';
import { readTrackIntent, composeTrack, composeTrackWorld, TRACK_LEXICON, SCENE_WORDS } from './trackscape-compose.js';
import { planScapedTrack } from './trackscape-dress.js';
import { gameStages } from '../gameworld/levels.js';
import { quickWorld } from '../gameworld/quick.js';

describe('reading a track from words', () => {
  it('what is raced sets the class, the set, the car and the pole; a word can turn the pole', () => {
    const k = readTrackIntent('a kart track'), g = readTrackIntent('a GT circuit'), r = readTrackIntent('a realistic kart track');
    expect([k.track.class, k.set, k.vehicle, k.pole]).toEqual(['kart', 'kart', 'kart', 'voxel']);
    expect(readTrackIntent('a cartoon kart track').pole).toBe('banded');
    expect(readTrackIntent('a battle racer arena').set).toBe('kart');
    // a look word is the look's, wherever it stands: "battle racer" names what is raced, not how it is drawn
    expect(readTrackIntent('a sunshine battle racer track').pole).toBe('shaded');
    expect(readTrackIntent('a battle racer track').pole).toBe('voxel');
    expect([g.track.class, g.set, g.pole]).toEqual(['circuit', 'gt', 'material']);
    expect(r.pole).toBe('material');
    expect(readTrackIntent('a rally stage').track.form).toBe('stage');
  });
  it('the shape, the amplitude and the landmark are the course\'s; a land word is read twice (the course and the look)', () => {
    const R = readTrackIntent('a twisty GT circuit in green hills by a castle');
    expect(R.track.twist).toBe(TRACK_LEXICON.twisty.twist);
    expect(R.track.elevation).toEqual(TRACK_LEXICON.hills.elevation);
    expect(R.landmark).toBe('castle');
    expect(R.look).toMatch(/\bhills\b/);
    expect(R.look).toMatch(/^realistic /);
  });
  it('the land round it and what stands there are the surrounds\'; a canyon is the look\'s too', () => {
    expect(readTrackIntent('a GT circuit in green hills').surrounds).toEqual({ land: TRACK_LEXICON.hills.land });
    const R = readTrackIntent('a GT circuit in a canyon by a city');
    expect(R.surrounds).toEqual({ land: TRACK_LEXICON.canyon.land, settlement: TRACK_LEXICON.city.settlement });
    expect(R.look).toContain(SCENE_WORDS.canyon);
    expect(readTrackIntent('a kart track').surrounds).toBeUndefined();
    expect(composeTrack('a rally stage in the mountains').scape.surrounds).toEqual({ land: 'mountains' });
  });
  it('a scene\'s common word is said in the land tunnel\'s own', () => {
    expect(readTrackIntent('an autumn kart track').look).toContain(SCENE_WORDS.autumn);
    expect(() => readTrackIntent('')).toThrow(/an intent is words/);
  });
});

describe('the one door', () => {
  it('composes a roadway manifest the dressed track draws, its laws held', () => {
    const M = composeTrack('a short cartoon kart track by a castle', { seed: 2 });
    expect(M).toMatchObject({ kind: 'roadway', form: 'circuit', scape: { set: 'kart', landmark: 'castle' } });
    const p = planScapedTrack(M);
    expect(p.scape.laws).toEqual([]);
    expect(p.scape.pieces.find((q) => q.landmark).block).toBe('castle');
    expect(JSON.stringify(composeTrack('a short cartoon kart track by a castle', { seed: 2 }))).toBe(JSON.stringify(M));
  }, 60000);
  it('the world and the track together: the world\'s look the words\', its track drawn in it', () => {
    const W = composeTrackWorld('a short cartoon kart track', { seed: 2 });
    const st = gameStages(W).find((x) => x.section === 'roadway');
    expect(st.manifest.kit).toMatchObject({ look: readTrackIntent('a short cartoon kart track').look });
    expect(st.manifest.scape.set).toBe('kart');
  });
  it('a quick race takes the track in words', () => {
    const W = quickWorld({ id: 'q', quick: { goal: 'race', ride: 'car', roadway: { intent: 'a short kart track' } } });
    expect(W.levels.run.roadway).toMatchObject({ form: 'circuit', scape: { set: 'kart' }, kit: { look: expect.any(String) } });
    expect(() => quickWorld({ id: 'q', quick: { goal: 'race', ride: 'car', roadway: { intent: '' } } })).toThrow(/roadway.intent is the track in words/);
  });
});
