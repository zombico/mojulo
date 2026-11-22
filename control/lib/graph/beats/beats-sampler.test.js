// The sampler (the sound library's recorded pieces): a `voice: 'sample'` patch plays its library card's variants when
// the library is installed, and the synthesized piece it stands in for when it is not, so a machine without the
// library renders the recorded kit byte-identical to the kit it was modelled on. A tiny library is built here (one
// decaying tone a card), never the real one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { renderBeatsOffline } from './beats-render.js';
import { normalizeBeatsManifest } from './beats-manifest.js';
import { beatsFeatures, sampleCards } from './beats-features.js';
import { emitBeatsKernel, sliceKernelText } from './beats-kernel.js';
import { emitBeatsPlayer } from './beats-player.js';
import { PATCHES } from './audio-patches.js';
import { forgetLibrary, sampleSlice } from '../sound-library/library.js';

const kitPiece = Object.keys(PATCHES).find((k) => PATCHES[k].voice === 'sample');
const recordedKit = Object.keys(PATCHES).find((k) => PATCHES[k].kit && Object.values(PATCHES[k].kit).some((n) => PATCHES[n] && PATCHES[n].voice === 'sample'));

// a groove on a kit patch (no instrument: the recorded kit is the sampler's proving patch, not on the shelf)
const comp = (patch) => normalizeBeatsManifest({ kind: 'beats-composition', title: 'sampler probe', bpm: 120, seed: 7, parts: [{ name: 'dr', patch, groove: { style: 'rock-drive', bars: 1 } }] });
const ARENA = 'rockKit90s';

function wav(seconds, hz) {
  const sr = 44100, n = Math.round(seconds * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(26000 * Math.exp(-i / (sr * 0.05)) * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const withLibrary = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
const sha = (b) => createHash('sha256').update(b).digest('hex');

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {};
  for (const [i, card] of [...new Set(Object.values(PATCHES).filter((p) => p.voice === 'sample').map((p) => p.library))].entries()) {
    const variants = [0, 1].map((v) => { const b = wav(0.15, 180 + 40 * i + 7 * v), id = sha(b).slice(0, 16); writeFileSync(path.join(dir, 'masters', `${id}.wav`), b); return { id, take: v + 1 }; });
    cards[card] = { role: 'instrument', variants };
  }
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the sampler', () => {
  it('is its own kernel feature: a recipe without recorded pieces carries none of it', () => {
    expect(recordedKit).toBeTruthy();
    expect(beatsFeatures(comp(recordedKit))).toContain('sampler');
    expect(beatsFeatures(comp(ARENA))).not.toContain('sampler');
    expect(emitBeatsKernel(beatsFeatures(comp(ARENA)))).not.toContain('loadSamples');
    expect(emitBeatsKernel(['sampler'])).toContain('loadSamples');
    expect(sampleCards(comp(ARENA))).toEqual([]);
  });

  it('with the sampler off, every other feature on is byte for byte the kernel before it', () => {
    // pinned from 1116-rc's kernel with every feature on: the sampler regions, off, leave that text as it was.
    const t = readFileSync(new URL('./beats-kernel.js', import.meta.url), 'utf8');
    const text = sliceKernelText(t.slice(t.indexOf('function buildBeatsKernel()'), t.lastIndexOf('}') + 1), (f) => f !== 'sampler');
    expect(sha(text)).toBe('55adeb89fe5d2191d1f8920728303e89f0bab76e35f8fdca1db3b275e83e564a');
  });

  it('without the library, the recorded kit renders byte-identical to the kit its pieces stand in for', async () => {
    withLibrary(false);
    expect(sampleSlice(sampleCards(comp(recordedKit)))).toBe(null);
    const rec = await renderBeatsOffline(comp(recordedKit), { tail: 0.3 });
    const arena = await renderBeatsOffline(comp(ARENA), { tail: 0.3 });
    expect(sha(rec.wav)).toBe(sha(arena.wav));
  });

  it('with the library, the recorded pieces play their samples, and a second render is the same bytes', async () => {
    withLibrary(true);
    const slice = sampleSlice([PATCHES[kitPiece].library]);
    expect(Object.values(slice.cards)[0]).toHaveLength(2);
    const a = await renderBeatsOffline(comp(recordedKit), { tail: 0.3 });
    const b = await renderBeatsOffline(comp(recordedKit), { tail: 0.3 });
    withLibrary(false);
    const fallback = await renderBeatsOffline(comp(recordedKit), { tail: 0.3 });
    expect(sha(a.wav)).toBe(sha(b.wav));
    expect(sha(a.wav)).not.toBe(sha(fallback.wav));
  });

  it('a page inlines the samples only where the recipe plays them and this machine holds them', () => {
    withLibrary(true);
    expect(emitBeatsPlayer(comp(recordedKit))).toContain('const SAMPLES = ');
    expect(emitBeatsPlayer(comp(ARENA))).not.toContain('const SAMPLES');
    withLibrary(false);
    expect(emitBeatsPlayer(comp(recordedKit))).not.toContain('const SAMPLES');
  });
});
