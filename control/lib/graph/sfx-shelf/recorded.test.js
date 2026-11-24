// The recorded voice (the sound library's): where a library on this machine records a shelf row, the row's realistic
// one-shot at its own dials is one `sample` gesture carrying its synthesized gestures as the fallback; anywhere else
// (no library, another style, dials asked for, a master missing) the shelf answers as it always did. A tiny library is
// built here, one card for one row chosen in code, never the real one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { sfxSound } from './resolve.js';
import { SOUND_IDS } from './roster.js';
import { forgetLibrary, recordedFor } from '../sound-library/library.js';
import { renderBeatsOffline } from '../beats/beats-render.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';
import { audioFeatures } from '../beats/beats-features.js';
import { audioChannelScript } from '../scene/channels/audio.js';

const sha = (b) => createHash('sha256').update(b).digest('hex');
function wav(seconds) {
  const sr = 44100, n = Math.round(seconds * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(24000 * Math.exp(-i / (sr * 0.04)) * Math.sin((2 * Math.PI * 330 * i) / sr)), 44 + i * 2);
  return b;
}

// one row whose realistic voice is gestures (a one-shot), chosen from the roster, not named
const row = SOUND_IDS.find((id) => { const s = sfxSound(id); return s && s.style === 'realistic' && Array.isArray(s.gestures); });
const card = `${row}-take`;
// and one row realistic does not voice at all (only the mouth style does)
const bare = SOUND_IDS.find((id) => !sfxSound(id) && sfxSound(id, { style: 'mouth' }));
let dir = null, master = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
const cue = (gestures) => ({ kind: 'beats-sfx', title: 'recorded probe', cues: { hit: gestures } });

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const variants = [0.2, 0.3].map((s, i) => { const b = wav(s), id = sha(b).slice(0, 16); writeFileSync(path.join(dir, 'masters', `${id}.wav`), b); return { id, take: i + 1, seconds: s }; });
  master = path.join(dir, 'masters', `${variants[0].id}.wav`);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards: { [card]: { shelf: row, role: 'one-shot', variants }, [`${bare}-take`]: { shelf: bare, role: 'one-shot', variants } } }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the recorded voice', () => {
  it('without the library, the shelf answers as it always did', () => {
    library(false);
    const s = sfxSound(row);
    expect(s.recorded).toBeUndefined();
    expect(s.gestures.some((g) => g.type === 'sample')).toBe(false);
  });

  it('with it, the realistic one-shot is the recording, its synthesized gestures the fallback', () => {
    library(false);
    const synth = sfxSound(row).gestures;
    library(true);
    const s = sfxSound(row);
    expect(s.recorded).toBe(card);
    expect(s.gestures).toEqual([{ type: 'sample', library: card, dur: 0.3, fallback: synth }]);
    expect(validateBeatsManifest(cue(s.gestures)).ok).toBe(true);
    expect(audioFeatures({ cues: { hit: s.gestures } })).toEqual(expect.arrayContaining(['sampler', 'sfx']));
  });

  it('a row realistic does not voice is given one by its recording; the style that voices it keeps its own', () => {
    library(false);
    expect(sfxSound(bare)).toBe(null);
    const mouth = sfxSound(bare, { style: 'mouth' });
    library(true);
    const s = sfxSound(bare);
    expect(s.recorded).toBe(`${bare}-take`);
    expect(s.gestures).toEqual([{ type: 'sample', library: `${bare}-take`, dur: 0.3 }]);
    expect(validateBeatsManifest(cue(s.gestures)).ok).toBe(true);
    expect(sfxSound(bare, { style: 'mouth' })).toEqual(mouth);
  });

  it('another style, or dials asked for, stays synthesized', () => {
    library(true);
    expect(sfxSound(row, { style: 'arcade' })?.recorded).toBeUndefined();
    expect(sfxSound(row, { dials: { probe: 1 } }).recorded).toBeUndefined();
  });

  it('a cue renders its recording, the same bytes twice; unloaded it renders exactly its fallback', async () => {
    library(true);
    const g = sfxSound(row).gestures;
    const a = await renderBeatsOffline(cue(g), { cue: 'hit', tail: 0.2 });
    const b = await renderBeatsOffline(cue(g), { cue: 'hit', tail: 0.2 });
    expect(sha(a.wav)).toBe(sha(b.wav));
    library(false);
    const unloaded = await renderBeatsOffline(cue(g), { cue: 'hit', tail: 0.2 });
    const synth = await renderBeatsOffline(cue(g[0].fallback), { cue: 'hit', tail: 0.2 });
    expect(sha(a.wav)).not.toBe(sha(unloaded.wav));
    expect(unloaded.durationSeconds).toBeGreaterThanOrEqual(synth.durationSeconds);
    expect(sha(unloaded.wav.subarray(44, 44 + synth.wav.length - 44))).toBe(sha(synth.wav.subarray(44)));
  });

  it('a world page inlines the samples only where its cues play them and this machine holds them', () => {
    library(true);
    const g = sfxSound(row).gestures;
    expect(audioChannelScript({ cues: { hit: g } })).toContain('const __SAMPLES = ');
    library(false);
    expect(audioChannelScript({ cues: { hit: sfxSound(row).gestures } })).not.toContain('__SAMPLES');
  });

  it('a card whose masters are missing records nothing', () => {
    library(true);
    expect(recordedFor(row)).toBeTruthy();
    unlinkSync(master);
    forgetLibrary();
    expect(recordedFor(row).variants).toBe(1);
  });
});
