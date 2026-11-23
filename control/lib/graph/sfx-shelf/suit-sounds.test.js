// The suit kit: a mobile suit heard by its weight, its drive and its loadout, so two suits designed apart sound apart;
// its variants heard as their stand-ins until the library records them (a page without it as it was), and as their
// recordings where it does; a game's sheet hearing the suit it designs, or the one its feel implies where recorded.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { suitSounds, suitWeight, suitRecorded, SUIT_WEIGHTS, SUIT_DRIVES, SUIT_ARMS, SUIT_SHARED, LIGHT_KG, HEAVY_KG } from './suit-sounds.js';
import { SOUNDS, resolveSoundId } from './roster.js';
import { sfxSound } from './resolve.js';
import { HELD_TUNINGS } from './recorded-held.js';
import { forgetLibrary } from '../sound-library/library.js';
import { soundSheet, readSound } from '../gameworld/sound-sheet.js';
import { POLES } from '../gameworld/feel/cards.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// a mech pole, chosen in code: a feel whose card carries a mech's weight
const MECH_POLE = Object.keys(POLES).find((p) => Number.isFinite(POLES[p].mount));
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-suit-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {}, card = (name, extra, hz) => {
    const b = wav(hz), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[name] = { ...extra, variants: [{ id, take: 1, seconds: 0.25 }] };
  };
  // the heavy suit's footfall (the mech pole's: its weight is heavy) and a rocket's booster loop
  card('heavy-step', { shelf: SUIT_WEIGHTS.heavy.step, role: 'one-shot', tags: ['suit', 'heavy'] }, 80);
  card(HELD_TUNINGS[SUIT_DRIVES.rocket.booster].loop, { shelf: SUIT_DRIVES.rocket.booster, role: 'loop', loop: true, tags: ['suit', 'rocket'] }, 120);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a suit by its axes', () => {
  it('every word the kit can say is a row of the shelf', () => {
    const words = [...Object.values(SUIT_WEIGHTS).flatMap((w) => [w.step, w.land, w.servo]), ...Object.values(SUIT_DRIVES).flatMap((d) => [d.booster, d.boost, d.quickBoost]),
      ...Object.values(SUIT_ARMS).flatMap((a) => Object.values(a)), ...Object.values(SUIT_SHARED)];
    expect(words.filter((w) => !resolveSoundId(w))).toEqual([]);
  });

  it('two suits designed apart are heard apart: weight, drive and loadout each move their own sounds', () => {
    const a = suitSounds({ weight: 'light', drive: 'ion', arms: ['railgun', 'heat-axe'] }), b = suitSounds({ weight: 'heavy', drive: 'rocket', arms: ['bazooka'] });
    for (const k of ['step', 'land', 'booster', 'boost', 'quickBoost']) expect(a[k]).not.toBe(b[k]);
    expect(Object.keys(a.loadout)).toEqual(['railgun', 'heat-axe']);
    expect(a.loadout.railgun.shot).not.toBe(b.loadout.bazooka.shot);
    expect(a.dodge).toBe(b.dodge);   // what every suit shares
  });

  it('a weight is read from a frame\'s mass or a feel\'s weight; a suit with no drive takes its weight\'s', () => {
    expect([LIGHT_KG - 1, LIGHT_KG, HEAVY_KG].map((mass) => suitWeight({ mass }))).toEqual(['light', 'medium', 'heavy']);
    expect([0, 0.5, 1].map((weight) => suitWeight({ weight }))).toEqual(['light', 'medium', 'heavy']);
    expect(suitSounds({ weight: 'heavy' }).drive).toBe(SUIT_WEIGHTS.heavy.drive);
  });

  it('a word off its axis is refused, by name', () => {
    expect(() => suitSounds({ drive: 'steam' })).toThrow(/drive 'steam'/);
    expect(() => suitSounds({ arms: ['spoon'] })).toThrow(/arm 'spoon'/);
    expect(() => suitSounds({ colour: 'red' })).toThrow(/axis/);
    expect(() => readSound({ suit: { weight: 'huge' } })).toThrow(/\.suit: weight 'huge'/);
  });
});

describe('the variants on the shelf', () => {
  it('a variant is heard as its stand-in without the library, byte for byte; one with no stand-in is silent', () => {
    library(false);
    const variant = suitSounds({ weight: 'light' }).step, standIn = SOUNDS[variant].standIn;
    expect(sfxSound(variant).gestures).toEqual(sfxSound(standIn).gestures);
    expect(sfxSound(SUIT_SHARED.jump)).toBe(null);
  });

  it('with the library, its recording plays over its stand-in, and a booster is held on its loop by the thrust', () => {
    library(true);
    const variant = SUIT_WEIGHTS.heavy.step, s = sfxSound(variant);
    library(false);
    const fallback = sfxSound(variant).gestures;
    library(true);
    expect(s.gestures).toEqual([{ type: 'sample', library: 'heavy-step', dur: 0.25, fallback }]);
    const held = sfxSound(SUIT_DRIVES.rocket.booster).sustain;
    expect(held.layers[0]).toMatchObject({ kind: 'sample', library: HELD_TUNINGS[SUIT_DRIVES.rocket.booster].loop });
    expect(suitRecorded(suitSounds({ weight: 'heavy' }))).toBe(true);
    expect(suitRecorded(suitSounds({ weight: 'light' }))).toBe(false);
  });
});

describe('a game\'s sheet hears its suit', () => {
  it('a suit the game designs is heard as written, its blade its swing', () => {
    library(false);
    const S = soundSheet({ sound: { suit: { weight: 'light', drive: 'ion', arms: ['heat-axe'] } } });
    expect(S.suit).toEqual({ weight: 'light', drive: 'ion', arms: ['heat-axe'] });
    expect(S.slots).toMatchObject({ step: SUIT_WEIGHTS.light.step, land: SUIT_WEIGHTS.light.land, swing: SUIT_ARMS['heat-axe'].swing, strike: SUIT_ARMS['heat-axe'].hit });
    expect(S.slots.jump).toBe('jump');   // the suit's jump unrecorded and with no stand-in: the slot as it was
  });

  it('a mech feel\'s implied suit is heard only where the library records it: without, the sheet is as it was', () => {
    library(false);
    const G = { feel: MECH_POLE, sound: {} };
    expect(soundSheet(G).suit).toBeUndefined();
    expect(soundSheet(G).slots).toEqual(soundSheet({ sound: {} }).slots);
    library(true);
    expect(soundSheet(G).suit.weight).toBe(suitWeight({ weight: POLES[MECH_POLE].mount }));
    expect(soundSheet(G).slots.step).toBe(SUIT_WEIGHTS.heavy.step);
  });
});
