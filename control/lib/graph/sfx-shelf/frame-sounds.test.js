// An assault frame heard by its parts, the recorded library first: its legs' class its weight, its booster's its drive,
// each weapon by its kind; a word the library has not recorded giving way to a synthesized one, and the recording
// winning where it is; the level's audio carrying every part's sounds, checked by the world's audio, refused when it
// names a cue it has not.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { FRAME_WEIGHTS, FRAME_DRIVES, FRAME_ARMS, FRAME_UNITS, FRAME_COCKPIT, FRAME_WORLD, frameWeight, frameDrive, frameWord } from './frame-sounds.js';
import { SUIT_WEIGHTS } from './suit-sounds.js';
import { resolveSoundId } from './roster.js';
import { forgetLibrary } from '../sound-library/library.js';
import { PARTS, WEAPON_SLOTS } from '../assault-frame/parts.js';
import { OPERATION } from '../gameworld/frame-goal.js';
import { frameAudio } from '../gameworld/frame-sound.js';
import { resolveWorldAudio } from '../beats/beats-world.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}
// (a recorded row with no synthesized voice, chosen in code: a drive's ignition)
const IGNITION = FRAME_DRIVES.rocket.boost[0];
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-frame-'));
  mkdirSync(path.join(dir, 'masters'));
  const b = wav(90), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
  writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards: { 'rocket-ignition': { shelf: IGNITION, role: 'one-shot', variants: [{ id, take: 1, seconds: 0.25 }] } } }));
  library(false);
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a frame by its parts', () => {
  it('every word the kit can say is a row of the shelf', () => {
    const lists = [...Object.values(FRAME_WEIGHTS), ...Object.values(FRAME_DRIVES), ...Object.values(FRAME_ARMS), ...Object.values(FRAME_UNITS)].flatMap((o) => Object.values(o).filter(Array.isArray));
    const words = [...lists, ...Object.values(FRAME_COCKPIT), ...Object.values(FRAME_WORLD)].flat();
    expect(words.filter((w) => !resolveSoundId(w))).toEqual([]);
  });

  it('its legs\' class is its weight and its booster\'s its drive, as a suit of that weight\'s', () => {
    const light = Object.values(PARTS.legs).find((L) => L.class === 'light'), heavy = Object.values(PARTS.legs).find((L) => L.class === 'heavy');
    expect([frameWeight(light), frameWeight(heavy), frameWeight({})]).toEqual(['light', 'heavy', 'medium']);
    const B = Object.values(PARTS.booster).find((x) => x.class === 'heavy');
    expect(frameDrive(B)).toBe(SUIT_WEIGHTS.heavy.drive);
    expect(FRAME_WEIGHTS.light.step).not.toEqual(FRAME_WEIGHTS.heavy.step);
  });

  it('every weapon kind a part has, and every unit an operation stands, is heard', () => {
    const kinds = new Set(WEAPON_SLOTS.flatMap((s) => Object.values(PARTS[s] ?? {}).map((W) => W.kind)));
    expect([...kinds].filter((k) => !FRAME_ARMS[k])).toEqual([]);
    expect(Object.keys(OPERATION.units).filter((k) => !FRAME_UNITS[k])).toEqual([]);
  });
});

describe('the recorded library first', () => {
  it('a recorded row the library has not is heard by the next word; where it has it, its recording', () => {
    library(false);
    expect(frameWord(FRAME_DRIVES.rocket.boost).word).toBe(FRAME_DRIVES.rocket.boost[1]);
    library(true);
    const r = frameWord(FRAME_DRIVES.rocket.boost);
    expect(r.word).toBe(IGNITION);
    expect(r.sound.gestures[0]).toMatchObject({ type: 'sample', library: 'rocket-ignition' });
    library(false);
  });
});

describe('the level\'s audio', () => {
  it('carries every part\'s sounds and its units\', checked by the world\'s audio; outdoors the wind, indoors the works', () => {
    const A = frameAudio({ units: ['gnat', 'turret', 'gnat'] });
    expect(Object.keys(A.frame.arms).sort()).toEqual(Object.keys(FRAME_ARMS).sort());
    expect(Object.keys(A.frame.units)).toEqual(['gnat', 'turret']);
    expect(A.frame.units.gnat.hum).toBeTruthy();
    expect(Object.keys(A.frame.parts.legs).sort()).toEqual(Object.keys(PARTS.legs).sort());
    expect(A.sfx.on['objectives:done']).toBeTruthy();
    expect(A.wind).toBeTruthy();
    const out = resolveWorldAudio(A);
    expect(out.frame.arms.laser.charge).toBe(A.frame.arms.laser.charge);
    expect(out.cues[out.frame.weights.heavy.step]).toBeTruthy();
    const W = frameAudio({ indoor: true });
    expect(W.wind).toBeUndefined();
    expect(resolveWorldAudio(W).ambience).toBeTruthy();
  });

  it('a frame spec naming a cue the level has not is refused, saying which', () => {
    const A = frameAudio({});
    expect(() => resolveWorldAudio({ ...A, frame: { ...A.frame, world: { struck: 'fr:nothing' } } })).toThrow(/world\.struck names 'fr:nothing'/);
    expect(() => resolveWorldAudio({ ...A, frame: { ...A.frame, colour: {} } })).toThrow(/colour is not part of a frame's sounds/);
  });
});
