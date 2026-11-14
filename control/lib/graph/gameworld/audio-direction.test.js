import { describe, it, expect } from 'vitest';
import { readMusic, audioDirection, tasteNotes, MIX_SPACES } from './audio-direction.js';
import { soundSheet, sheetAudio, levelSpace } from './sound-sheet.js';
import { readGameworld } from './index.js';
import { MEADOWMARK } from './index.js';
import { scoreIdentity } from '../beats/field-score.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { emitBeatsKernel } from '../beats/beats-kernel.js';

// The audio direction (audio-direction.js): the music department's taste, read by the sound and the interface.

describe('the audio direction', () => {
  it('is solved from the game\'s words: the orchestra unless they say electronic; the game\'s own words win', () => {
    const D = audioDirection({ name: 'Meadow walk', style: { kit: 'isekai-meadow' } });
    expect(D).toMatchObject({ style: 'field', identity: null, voice: null, sfx: 'mouth', space: null, ui: 'paper' });
    expect(audioDirection({ name: 'Neon lab station' }).style).toBe('club');
    expect(audioDirection({ name: 'Neon lab station' }).ui).toBe('console');
    const own = audioDirection({ name: 'Neon lab station', music: { direction: { style: 'field', sfx: 'realistic', space: 'hangar', ui: 'crypt', identity: 5 } } });
    expect(own).toMatchObject({ style: 'field', sfx: 'realistic', space: 'hangar', ui: 'crypt', identity: 5 });
    expect(own.why.style).toBe('the game says so');
  });

  it('its identity is the score\'s: the key, the flavour, the hall and the players, the cast over them', () => {
    const id = scoreIdentity(5), D = audioDirection({ music: { direction: { identity: 5, cast: { ground: 'cello' } } } });
    expect(D.voice).toMatchObject({ tonic: id.tonic, flavour: id.flavour, players: { ground: 'cello', kit: id.kit } });
    // the run's own identity where the direction names none
    expect(audioDirection({}, { game: 5 }).voice.tonic).toBe(id.tonic);
  });

  it('refuses what cannot be read, naming it', () => {
    expect(() => readMusic({ direction: { style: 'jazz' } })).toThrow(/field or club/);
    expect(() => readMusic({ direction: { sfx: 'loud' } })).toThrow(/SFX shelf style/);
    expect(() => readMusic({ direction: { space: 'bathroom' } })).toThrow(/one of/);
    expect(() => readMusic({ direction: { cast: { ground: 'kazoo-of-doom' } } })).toThrow(/direction\.cast/);
    expect(() => readMusic({ tracks: [] })).toThrow(/not one of/);
    expect(readMusic(undefined)).toBeUndefined();
    // the world's read checks it and carries it
    expect(readGameworld({ ...MEADOWMARK, music: { direction: { sfx: 'foley' } } }).music).toEqual({ direction: { sfx: 'foley' } });
    expect(() => readGameworld({ ...MEADOWMARK, music: { direction: { style: 'jazz' } } })).toThrow(/music/);
  });

  it('the mixer\'s spaces are the kernel\'s', () => {
    const K = new Function(`return (${emitBeatsKernel(['sfxmix'])})()`)();
    expect([...MIX_SPACES].sort()).toEqual(Object.keys(K.SFX_SPACES).sort());
  });
});

describe('play reads it (the sound sheet)', () => {
  it('the sheet speaks the direction\'s sfx where the game\'s sound says none; the game\'s own style wins', () => {
    expect(soundSheet({ music: { direction: { sfx: 'foley' } } }).style).toBe('foley');
    expect(soundSheet({ music: { direction: { sfx: 'foley' } }, sound: { style: 'arcade' } }).style).toBe('arcade');
    expect(soundSheet({}).style).toBe('mouth');
  });

  it('a game with a direction hears each level in a space: its own, else the level\'s place; without one, no space is named', () => {
    expect(levelSpace({}, { manifest: { kit: 'crystal-cave' } })).toBeNull();
    expect(sheetAudio({}).sheet.mix).toBeUndefined();
    expect(levelSpace({ music: {} }, { manifest: { kit: 'crystal-cave' } })).toBe('cavern');
    expect(levelSpace({ music: {} }, { manifest: { kind: 'stage' } })).toBe('open');
    expect(levelSpace({ music: { direction: { space: 'hangar' } } }, { manifest: { kit: 'crystal-cave' } })).toBe('hangar');
    const audio = resolveWorldAudio({ sfx: sheetAudio({ music: {} }, { manifest: { kit: 'crystal-cave' } }) }, { ref: 'lv', mechanics: ['door'] });
    expect(audio.mix).toMatchObject({ space: 'cavern' });
  });
});

describe('taste is advice', () => {
  it('says where the sheet sits badly with the score, and changes nothing', () => {
    const W = { name: 'Meadow walk', sound: { style: 'arcade' } }, S = soundSheet(W);
    expect(tasteNotes(W, S).some((l) => /chiptune effects under an orchestra/.test(l))).toBe(true);
    expect(S.style).toBe('arcade');
    expect(tasteNotes({ name: 'Meadow walk' }, soundSheet({ name: 'Meadow walk' }))).toEqual([]);
  });
});
