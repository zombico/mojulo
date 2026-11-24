// A racing car's own events (sound-sheet.js rideEvents): where the recorded library voices a ride's events, the level
// hears its start, its gears (and its revs through them), its brakes and its horn, and its tyres' roar and screech
// beside the engine; without the library nothing is named and the page is as it was. A tiny library is built here: the
// events of one road vehicle with gears, found in code, and the two tyre loops.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { rideEvents } from './sound-sheet.js';
import { vehicleSounds } from '../sfx-shelf/vehicle-sounds.js';
import { HELD_TUNINGS } from '../sfx-shelf/recorded-held.js';
import { VEHICLES } from '../vehicle-registry/roster.js';
import { forgetLibrary } from '../sound-library/library.js';
import { resolveWorldAudio } from '../beats/beats-world.js';
import { audioChannelScript } from '../scene/channels/audio.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// a road vehicle with gears and a horn, chosen from the registry, not named
const car = Object.keys(VEHICLES).find((id) => VEHICLES[id].realm === 'road' && vehicleSounds(id).events.shift && vehicleSounds(id).events.horn);
const EV = vehicleSounds(car).events;
const G = { sound: {} };
const FALLBACK = 'sedan';
const engine = { voice: 'car-engine', top: 40 };
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
const page = (ev) => audioChannelScript(resolveWorldAudio({ engine: { ...engine, ...(ev?.engine ?? {}) }, ...(ev ? { sfx: { cues: ev.cues } } : {}) }));

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {}, card = (name, extra, hz) => {
    const b = wav(hz), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[name] = { ...extra, variants: [{ id, take: 1, seconds: 0.25 }] };
  };
  ['start', 'shift', 'brake', 'horn'].forEach((e, i) => card(`${EV[e]}-take`, { shelf: EV[e], role: 'one-shot' }, 300 + 40 * i));
  // (and the start of the vehicle a car's engine stands for, for a ride the registry does not know)
  const plain = vehicleSounds(FALLBACK).events.start;
  if (!cards[`${plain}-take`]) card(`${plain}-take`, { shelf: plain, role: 'one-shot' }, 520);
  for (const row of ['tire-squeal', 'road-roar']) card(HELD_TUNINGS[row].loop, { role: 'loop', loop: true }, 200);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a racing car\'s own events', () => {
  it('without the library a ride has none, and its page is as it was', () => {
    library(false);
    expect(rideEvents(G, { words: car })).toBe(null);
    expect(page(null)).not.toMatch(/ride:|__rev\(/);
  });

  it('with it, a ride is heard by its start, its gears, its brakes, its horn and its tyres', () => {
    library(true);
    const ev = rideEvents(G, { words: `a ${car}` });
    expect(Object.keys(ev.cues).sort()).toEqual(['ride:brake', 'ride:horn', 'ride:shift', 'ride:start']);
    expect(ev.engine).toMatchObject({ ride: true, gears: true, drive: { road: expect.any(Object), skid: expect.any(Object) } });
    const audio = resolveWorldAudio({ engine: { ...engine, ...ev.engine }, sfx: { cues: ev.cues } });
    expect(audio.engine).toMatchObject({ ride: true, gears: true });
    const p = audioChannelScript(audio);
    for (const k of ["__AUDIO.cues['ride:start']", "__AUDIO.cues['ride:shift']", "__AUDIO.cues['ride:brake']", "__AUDIO.cues['ride:horn']", 'K.skid.set', '__rev(K.speed)']) expect(p).toContain(k);
    expect(p).not.toContain("'ride:reverse'");   // (none recorded here)
  });

  it('a ride the registry does not know is heard as the vehicle its engine is', () => {
    library(true);
    expect(rideEvents(G, { words: 'zzqx' })).toBe(null);
    const ev = rideEvents(G, { words: 'zzqx', voice: 'car-engine' });
    expect(ev.cues['ride:start']).toBeTruthy();
    expect(ev.why).toContain(FALLBACK);
  });

  it('a game that says its ride is silent, or a ride that is not driven on the ground, has none', () => {
    library(true);
    expect(rideEvents({ sound: { ride: false } }, { words: car })).toBe(null);
    const flier = Object.keys(VEHICLES).find((id) => VEHICLES[id].realm === 'air');
    expect(rideEvents(G, { words: flier })).toBe(null);
  });
});
