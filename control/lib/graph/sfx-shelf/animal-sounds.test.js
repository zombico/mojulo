// The animal shelf: every animal mojulo makes is heard by a voice class (its family's, its order's, its own), with the
// same four calls each; a foe in an action level and a foe in a party battle heard by it where the library records the
// class, and nothing moving without it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { animalVoice, animalSounds, animalRecorded, FAMILY_VOICE, ORDER_VOICE, SPECIES_VOICE } from './animal-sounds.js';
import { ANIMAL_CLASSES, ANIMAL_CALLS, ANIMAL_ROWS } from './animal-voices.js';
import { SOUNDS } from './roster.js';
import { sfxSound } from './resolve.js';
import { FAMILIES } from '../fauna/families.js';
import { SPECIES } from '../fauna/species.js';
import { BUG_SPECIES } from '../bugs/species.js';
import { FOE_CLASSES } from '../foes/index.js';
import { FOE_PRESETS } from '../playscape/rpg/presets.js';
import { forgetLibrary } from '../sound-library/library.js';
import { soundSheet } from '../gameworld/sound-sheet.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// cases chosen in code: a foe class and an RPG monster heard in the same voice, a camelCase species
const FOE_CLASS = Object.keys(FOE_CLASSES).find((c) => { const v = animalVoice(FOE_CLASSES[c].standIn); return v && Object.keys(FOE_PRESETS).some((id) => animalVoice(id) === v); });
const VOICE = animalVoice(FOE_CLASSES[FOE_CLASS].standIn);
const RPG_FOE = Object.keys(FOE_PRESETS).find((id) => animalVoice(id) === VOICE);
const CAMEL = Object.keys(SPECIES).find((id) => /[A-Z]/.test(id) && animalVoice(id));
const FISH_FAMILY = Object.keys(FAMILY_VOICE).find((f) => FAMILY_VOICE[f] === null);
const FISH = Object.keys(SPECIES).find((id) => SPECIES[id].family === FISH_FAMILY);

let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-animal-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {};
  ANIMAL_CALLS.forEach((call, i) => {
    const b = wav(200 + i * 50), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[`a-${call}`] = { shelf: `${VOICE}-${call}`, role: 'one-shot', variants: [{ id, take: 1, seconds: 0.25 }] };
  });
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('every animal is heard', () => {
  it('every class has its four calls on the shelf, each a recorded row', () => {
    for (const cls of Object.keys(ANIMAL_CLASSES)) for (const c of ANIMAL_CALLS) expect(SOUNDS[`${cls}-${c}`]?.recorded).toBe(true);
    expect(ANIMAL_ROWS.every((r) => SOUNDS[r.id])).toBe(true);
  });

  it('the tables cover every family of the roster and every order of the insects, and name only classes', () => {
    expect(Object.keys(FAMILIES).filter((f) => !(f in FAMILY_VOICE))).toEqual([]);
    expect([...new Set(Object.values(BUG_SPECIES).map((b) => b.order))].filter((o) => !(o in ORDER_VOICE))).toEqual([]);
    expect([...Object.values(FAMILY_VOICE), ...Object.values(ORDER_VOICE), ...Object.values(SPECIES_VOICE)].filter((v) => v !== null && !ANIMAL_CLASSES[v])).toEqual([]);
  });

  it('a species is heard however it is written; a foe class as the species it stands on; a monster by its name; a fish by its moves', () => {
    expect(animalVoice(CAMEL)).toBe(animalVoice(CAMEL.toLowerCase()));
    expect(animalVoice(FOE_CLASS)).toBe(VOICE);
    expect(animalVoice(RPG_FOE)).toBeTruthy();
    expect(animalVoice(`a giant ${RPG_FOE}`)).toBe(animalVoice(RPG_FOE));
    expect(animalSounds(FISH)).toEqual({ voice: null, moves: { swim: expect.any(String) } });
    expect(animalVoice('teapot')).toBe(null);
  });

  it('without the library a call is silent; with it, its recording', () => {
    library(false);
    expect(sfxSound(`${VOICE}-alert`)).toBe(null);
    expect(animalRecorded(VOICE)).toBe(false);
    library(true);
    expect(sfxSound(`${VOICE}-alert`).gestures[0]).toMatchObject({ type: 'sample', library: 'a-alert' });
    expect(animalRecorded(VOICE)).toBe(true);
  });
});

describe('a game\'s foes heard by it', () => {
  const G = { foes: { beast: { class: FOE_CLASS } }, sound: {} };
  it('without the library the sheet is as it was', () => {
    library(false);
    const S = soundSheet(G);
    expect(Object.values(S.foeSounds).flatMap(Object.values).some((w) => String(w).startsWith(`${VOICE}-`))).toBe(false);
  });

  it('with it, an action level\'s foe attacks, is hurt and falls in its class\'s voice, even unskinned', () => {
    library(true);
    expect(soundSheet(G).foeSounds.beast).toEqual({ attack: `${VOICE}-alert`, hurt: `${VOICE}-hurt`, down: `${VOICE}-death` });
  });

  it('and a party battle\'s foe falls in its own', () => {
    library(true);
    const B = soundSheet({ battles: {}, sound: {} }).battle;
    expect(B.ends).toContainEqual([`ko:${RPG_FOE}`, `${animalVoice(RPG_FOE)}-death`]);
  });
});
