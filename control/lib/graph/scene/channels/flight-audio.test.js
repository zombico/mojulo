// A flown level's sounds: the kit is chosen by how the craft is flown (its pilot's rule), every word a row of the shelf;
// a level nothing flies in, or one that says `audio: false`, carries none; without the library its new rows are heard as
// their stand-ins, with it as their recordings (a starfighter's engines crossfaded by the throttle); the page's block is
// emitted only for a level that has it, and parses.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { flightAudio, flightAudioScript, flownPilot, FLIGHT_REACH } from './flight-audio.js';
import { FLIGHT_KITS, FLIGHT_KIT_IDS, FLIGHT_EVENTS, FLIGHT_ROWS, flightKitOf, flightSounds } from '../../sfx-shelf/flight-sounds.js';
import { SOUNDS, resolveSoundId } from '../../sfx-shelf/roster.js';
import { HELD_TUNINGS } from '../../sfx-shelf/recorded-held.js';
import { resolveWorldAudio } from '../../beats/beats-world.js';
import { audioChannelScript } from './audio.js';
import { forgetLibrary } from '../../sound-library/library.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

const level = (type, extra = {}) => ({ entities: [{ id: 'ship', pilotable: true, rule: { type } }, { id: 'foe-1', team: 'foes', rule: { type: 'ai' } }], ...extra });
const RULES = { trainer: 'fly', arcade: 'rail', cockpit: 'starfighter' };
const COCKPIT_ENGINE = HELD_TUNINGS[FLIGHT_KITS.cockpit.words.engine];
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-flight-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {}, card = (name, extra, hz) => {
    const b = wav(hz), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[name] = { ...extra, variants: [{ id, take: 1, seconds: 0.25 }] };
  };
  // the cockpit's engines at both ends of its throttle, and its cannon
  for (const [i, rpm] of COCKPIT_ENGINE.rpm.entries()) card(`${COCKPIT_ENGINE.engine}-${rpm}`, { engine: COCKPIT_ENGINE.engine, rpm, role: 'loop', loop: true }, 90 + 60 * i);
  card('cannon-take', { shelf: FLIGHT_KITS.cockpit.words.shot, role: 'one-shot' }, 700);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a flight by how it is flown', () => {
  it('every word a kit can say is a row of the shelf, every event one the page plays', () => {
    const words = FLIGHT_KIT_IDS.flatMap((k) => Object.entries(FLIGHT_KITS[k].words));
    expect(words.filter(([ev]) => !FLIGHT_EVENTS.includes(ev))).toEqual([]);
    expect(words.filter(([, w]) => !resolveSoundId(w))).toEqual([]);
    expect(FLIGHT_ROWS.every((r) => SOUNDS[r.id] && SOUNDS[r.id].recorded === true)).toBe(true);
  });

  it('the kit is the pilot\'s rule\'s; nothing flown, or a level that says audio: false, carries none', () => {
    for (const [kit, rule] of Object.entries(RULES)) expect(flightKitOf({ type: rule })).toBe(kit);
    expect(flightKitOf({ type: 'platform' })).toBeNull();
    expect(flownPilot(level('platform').entities)).toBeNull();
    expect(flightAudio(level('platform'))).toBeNull();
    expect(flightAudio(level('rail'), { audio: false })).toBeNull();
    expect(flightAudio(level('rail')).reach).toBe(FLIGHT_REACH.arcade);
  });

  it('two ways of flying sound apart', () => {
    const a = flightSounds('arcade').words, c = flightSounds('cockpit').words;
    for (const ev of ['engine', 'shot', 'hit', 'down']) expect(a[ev]).not.toBe(c[ev]);
  });

  it('a game\'s own words over the kit\'s, false silencing one; a word for no event is refused', () => {
    const W = flightSounds('trainer', { gate: false, crash: 'big-explosion' }).words;
    expect(W.gate).toBeUndefined();
    expect(W.crash).toBe('big-explosion');
    expect(() => flightSounds('trainer', { loop: 'x' })).toThrow(/not a flight's event/);
  });
});

describe('the flight on the page', () => {
  it('without the library: each kit resolves on its stand-ins, carries no recording, and its block parses', () => {
    library(false);
    for (const rule of Object.values(RULES)) {
      const fa = flightAudio(level(rule));
      const A = resolveWorldAudio(fa.spec, { time: 12, ref: 't' });
      expect(Object.keys(A.flight).length).toBeGreaterThan(2);
      expect(JSON.stringify(A.flight)).not.toMatch(/"library"/);
      const js = audioChannelScript({ ...A, mix: { ...A.mix, reach: fa.reach } });
      expect(js).toContain(flightAudioScript().trim().split('\n')[1]);
      expect(() => new Function(js)).not.toThrow();
    }
  });

  it('a level with no flight emits not a byte of the flight\'s block', () => {
    library(false);
    const A = resolveWorldAudio(flightAudio(level('starfighter')).spec, { time: 12, ref: 't' });
    const { flight: _f, ...rest } = A;
    expect(audioChannelScript(rest)).not.toContain('flight-audio.js');
  });

  it('with the library: the cockpit\'s engines are its recorded loops crossfaded by the throttle, its cannon a take', () => {
    library(true);
    const A = resolveWorldAudio(flightAudio(level('starfighter')).spec, { time: 12, ref: 't' });
    const layers = A.flight.engine.layers;
    expect(layers.map((l) => l.library)).toEqual(COCKPIT_ENGINE.rpm.map((r) => `${COCKPIT_ENGINE.engine}-${r}`));
    expect(layers.every((l) => l.kind === 'sample' && Array.isArray(l.window))).toBe(true);
    expect(A.flight.shot[0]).toMatchObject({ type: 'sample', library: 'cannon-take' });
    library(false);
  });
});
