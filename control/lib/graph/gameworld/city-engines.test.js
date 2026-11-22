// The open city's car taken, heard by its own engine (sound-sheet.js citySounds `models`): where the recorded library
// voices a car's own engine, the city names it for that car's model, resolved once and heard from the cab; the page
// starts the engine the driven car's model names. Without the library nothing is named and nothing on the page moves.
// A tiny library is built here: one engine of two loops, for the engine one car model is heard by, found in code.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { citySounds, CITY_CAR } from './sound-sheet.js';
import { modelEngines } from '../sfx-shelf/vehicle-sounds.js';
import { HELD_TUNINGS, CAB } from '../sfx-shelf/recorded-held.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
import { forgetLibrary } from '../sound-library/library.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { audioChannelScript } from '../scene/channels/audio.js';

function wav(hz) {
  const sr = 44100, n = sr / 2, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// one car model heard by an engine that is not the city's own, and that engine's tuning
const [model, word] = Object.entries(modelEngines()).find(([, w]) => w !== CITY_CAR.engine && w !== 'car-engine' && HELD_TUNINGS[w]?.engine);
const T = HELD_TUNINGS[word];
const G = { sound: {} }, manifest = { kind: 'geocube', show: 'geocity' };
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {};
  for (const rpm of T.rpm) {
    const b = wav(rpm / 30), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[`${T.engine}-${rpm}`] = { role: 'loop', loop: true, engine: T.engine, rpm, variants: [{ id, take: 1, seconds: 0.5 }] };
  }
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the car taken, heard by its own engine', () => {
  it('without the library the city names no car\'s own engine, and its page is as it was', () => {
    library(false);
    const city = citySounds(G, { manifest });
    expect(city.engine.models).toBeUndefined();
    const audio = resolveWorldAudio({ engine: city.engine });
    expect(audio.engine.voices).toBeUndefined();
    expect(audioChannelScript(audio)).not.toContain('E.models');
  });

  it('with it, a car whose own engine is recorded is named for it, its engine heard from the cab', () => {
    library(true);
    const city = citySounds(G, { manifest });
    expect(city.engine.models).toMatchObject({ [model]: word });
    expect(Object.values(city.engine.models)).not.toContain(CITY_CAR.engine);
    const audio = resolveWorldAudio({ engine: city.engine });
    const v = audio.engine.voices[word];
    expect(v).toEqual(sfxSound(word, { cab: true }).sustain);
    // (heard from the cab: short of its redline, through the small speaker)
    expect(v.layers.every((L) => L.band)).toBe(true);
    expect(v.layers[0].rate[1] * T.rpm[0]).toBeCloseTo(T.rpm[0] + (T.rpm[1] - T.rpm[0]) * CAB.redline, -1);
    const page = audioChannelScript(audio);
    expect(page).toContain('E.models[__mk]');
    expect(page).toContain('const __SAMPLES = ');
  });
});
