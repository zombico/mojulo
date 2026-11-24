// A FLAVOR (a game's own recorded sounds: a rail's, `flavor` on the card): a flavored card voices its row for a game of
// that flavor, in any style and ahead of the row's realistic recording, and is never heard by a game without it; a
// held tuning of a flavor answers only that flavor. A tiny library is built here: one row recorded twice (realistic,
// and flavored), and a flavored held loop.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { sfxSound } from './resolve.js';
import { SOUND_IDS, SOUNDS } from './roster.js';
import { HELD_TUNINGS } from './recorded-held.js';
import { forgetLibrary, hasFlavor } from '../sound-library/library.js';
import { soundSheet } from '../gameworld/sound-sheet.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// a flavored held tuning (a game's own loop), and a one-shot row realistic voices, chosen in code
const [heldRow, HT] = Object.entries(HELD_TUNINGS).find(([, t]) => t.flavor);
const FLAVOR = HT.flavor;
const row = SOUND_IDS.find((id) => { const s = sfxSound(id); return s && s.style === 'realistic' && Array.isArray(s.gestures); });
// a row that stands on a palette row (its family), and that family: a flavored card on the family voices the row too
const standing = SOUND_IDS.find((id) => id !== row && SOUNDS[id].family && SOUNDS[id].family !== id && SOUNDS[SOUNDS[id].family]?.palette && sfxSound(id)?.gestures);
const fam = SOUNDS[standing].family;
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {}, card = (name, extra, hz) => {
    const b = wav(hz), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[name] = { ...extra, variants: [{ id, take: 1, seconds: 0.25 }] };
  };
  card(`${row}-real`, { shelf: row, role: 'one-shot' }, 300);
  card(`${row}-own`, { shelf: row, role: 'one-shot', flavor: FLAVOR }, 600);
  card(HT.loop, { shelf: heldRow, role: 'loop', loop: true, flavor: FLAVOR }, 200);
  card(`${fam}-own`, { shelf: fam, role: 'one-shot', flavor: FLAVOR }, 700);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a flavor', () => {
  it('a game of the flavor hears its own recording, in any style, ahead of the realistic one', () => {
    library(true);
    expect(sfxSound(row, { flavor: FLAVOR }).recorded).toBe(`${row}-own`);
    expect(sfxSound(row, { style: 'arcade', flavor: FLAVOR }).recorded).toBe(`${row}-own`);
  });

  it('a game without it never hears the flavored card, and hears the realistic recording as before', () => {
    library(true);
    expect(sfxSound(row).recorded).toBe(`${row}-real`);
    expect(sfxSound(row, { flavor: 'some-other-rail' }).recorded).toBe(`${row}-real`);
  });

  it('a flavored card on a palette row voices, for its flavor, every row that stands on it', () => {
    library(true);
    expect(sfxSound(standing, { flavor: FLAVOR }).recorded).toBe(`${fam}-own`);
    expect(sfxSound(standing).recorded).not.toBe(`${fam}-own`);
  });

  it('a flavored held voice answers only its flavor', () => {
    library(true);
    expect(sfxSound(heldRow).recorded).toBeUndefined();
    expect(sfxSound(heldRow, { flavor: FLAVOR }).recorded).toBe(HT.loop);
    expect(sfxSound(heldRow, { flavor: FLAVOR }).sustain.fallback).toEqual(sfxSound(heldRow).sustain);
  });

  it('a game\'s sheet names its flavor only where the library holds one', () => {
    const G = { sound: {}, feel: FLAVOR };
    library(false);
    expect(hasFlavor(FLAVOR)).toBe(false);
    expect(soundSheet(G).flavor).toBeUndefined();
    library(true);
    expect(soundSheet(G).flavor).toBe(FLAVOR);
    expect(soundSheet({ sound: {} }).flavor).toBeUndefined();
  });
});
