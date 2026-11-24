// The mount lane's horse heard, where the sound library records it: its hooves held by its pace, its neigh as the hero
// settles in the saddle, its snort as it is urged to its top gait; without the library the lane is as it was.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { mountLane } from './mount-lane.js';
import { HELD_TUNINGS } from '../sfx-shelf/recorded-held.js';
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

const G = { id: 'lane-test', name: 'Lane test' };
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-lane-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {}, card = (name, extra, hz) => {
    const b = wav(hz), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[name] = { ...extra, variants: [{ id, take: 1, seconds: 0.25 }] };
  };
  card(HELD_TUNINGS.hooves.loop, { shelf: 'hooves', role: 'loop', loop: true }, 150);
  card('a-neigh', { shelf: 'equine-call', role: 'one-shot' }, 500);
  card('a-snort', { shelf: 'equine-alert', role: 'one-shot' }, 400);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the mount lane\'s horse', () => {
  it('without the library the lane carries none of it', () => {
    library(false);
    const { manifest } = mountLane(G);
    expect(manifest.audio?.mount).toBeUndefined();
    expect(audioChannelScript(resolveWorldAudio(manifest.audio))).not.toContain('RIDDEN ANIMAL');
  });

  it('with it, its hooves held by its pace, its neigh and its snort, played by the page', () => {
    library(true);
    const { manifest } = mountLane(G);
    expect(manifest.audio.mount.hooves.layers[0]).toMatchObject({ kind: 'sample', library: HELD_TUNINGS.hooves.loop });
    expect(manifest.audio.mount.mounted[0]).toMatchObject({ type: 'sample', library: 'a-neigh' });
    expect(manifest.audio.mount.gallop[0]).toMatchObject({ type: 'sample', library: 'a-snort' });
    const A = resolveWorldAudio(manifest.audio);
    expect(A.mount.level).toBeGreaterThan(0);
    const page = audioChannelScript(A);
    expect(page).toContain('RIDDEN ANIMAL');
    expect(page).toContain('a-neigh');
  });

  it('a lane made silent is silent', () => {
    library(true);
    expect(mountLane(G, { sound: 'none' }).manifest.audio).toBeUndefined();
  });
});
