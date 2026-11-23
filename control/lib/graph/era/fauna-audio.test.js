// A biocube's fauna heard: the field's kinds and its herds calling from where they live, as place sounds, in their
// animals' voices, only where the library records them; a kind that makes no sound, and a page without the library,
// carry none of it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { faunaAudio, FIELD_SOUNDS, HERD_SOUND } from './fauna-audio.js';
import { FIELD_KINDS } from './biocube-fauna.js';
import { animalSounds } from '../sfx-shelf/animal-sounds.js';
import { ANIMAL_CLASSES } from '../sfx-shelf/animal-voices.js';
import { SPECIES } from '../fauna/species.js';
import { forgetLibrary } from '../sound-library/library.js';
import { resolveWorldAudio } from '../beats/beats-world.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// cases chosen in code: the flock's voice, a kind that makes no sound, and a herd species heard in a voice of its own
const BIRDS = animalSounds(FIELD_KINDS.birds.stands).voice;
const SILENT = Object.keys(FIELD_SOUNDS).find((k) => FIELD_SOUNDS[k] === null);
const HERD = Object.keys(SPECIES).find((id) => { const v = animalSounds(id)?.voice; return v && v !== BIRDS && ANIMAL_CLASSES[v].weight === 'heavy'; });
const HERD_VOICE = animalSounds(HERD).voice;
const field = { seed: 1, birds: { flock: [3, 7], every: 40, height: [24, 40], centre: [50, 50, 0], span: 160 }, [SILENT]: { homes: [[1, 1, 0]], flies: [[1, 1, 0]] } };
const herd = [0, 1].flatMap((g) => [0, 1, 2].map((k) => ({ id: `fauna:${HERD}:${g}:${k}`, fauna: true, transform: { pos: [10 * g + k, 20, 0] } })))
  .concat([{ id: `fauna:${HERD}:0:grass0`, fauna: true, food: true, transform: { pos: [0, 0, 0] } }]);

let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-field-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {};
  [[BIRDS, 'call'], [BIRDS, 'alert'], [HERD_VOICE, 'call'], [HERD_VOICE, 'alert']].forEach(([v, c], i) => {
    const b = wav(300 + 40 * i), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[`a-${v}-${c}`] = { shelf: `${v}-${c}`, role: 'one-shot', variants: [{ id, take: 1, seconds: 0.25 }] };
  });
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the field heard', () => {
  it('every field kind has its sound settings, and each kind that calls calls in a voice', () => {
    expect(Object.keys(FIELD_SOUNDS).sort()).toEqual(Object.keys(FIELD_KINDS).sort());
    for (const [k, S] of Object.entries(FIELD_SOUNDS)) if (S) expect(animalSounds(FIELD_KINDS[k].stands)?.voice).toBeTruthy();
  });

  it('without the library, nothing', () => {
    library(false);
    expect(faunaAudio({ fauna: field, entities: herd })).toBe(null);
  });

  it('with it, the flock over the site as often as it crosses, each herd from its ground by its weight, a silent kind silent', () => {
    library(true);
    const A = faunaAudio({ fauna: field, entities: herd });
    const birds = A.emitters.find((e) => e.cue === `fauna:${BIRDS}-call`);
    expect(birds.reach).toBe(field.birds.span);
    expect(birds.every[0]).toBeLessThan(field.birds.every);
    expect(birds.every[1]).toBeGreaterThan(field.birds.every);
    const herds = A.emitters.filter((e) => e.cue === `fauna:${HERD_VOICE}-call`);
    expect(herds).toHaveLength(2);
    expect(herds[0].reach).toBe(HERD_SOUND.reach.heavy);
    expect(A.emitters).toHaveLength(3);
    const R = resolveWorldAudio(A);
    expect(R.emitters).toHaveLength(3);
    expect(R.cues[`fauna:${BIRDS}-call`][0]).toMatchObject({ type: 'sample' });
  });

  it('a field with only silent kinds and no herds carries nothing', () => {
    library(true);
    expect(faunaAudio({ fauna: { seed: 1, [SILENT]: field[SILENT] }, entities: [] })).toBe(null);
  });
});
