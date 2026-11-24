// Recorded held voices (the sound library's loops): a row with a tuning (recorded-held.js) whose engine the library
// holds is voiced by the engine's loops, crossfaded by the control and bent by revs over their own, its synthesized
// spec the fallback; unloaded it is exactly that spec. A tiny library is built here: one engine of three loops, one
// tyre loop, each a steady tone.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { sfxSound } from './resolve.js';
import { HELD_TUNINGS, recordedHeld } from './recorded-held.js';
import { forgetLibrary } from '../sound-library/library.js';
import { renderBeatsOffline } from '../beats/beats-render.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';
import { audioFeatures, gestureSampleCards } from '../beats/beats-features.js';

const sha = (b) => createHash('sha256').update(b).digest('hex');
function wav(hz) {
  const sr = 44100, n = sr, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(9000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// one engine tuning and one loop tuning, chosen from the table, not named
const engineRow = Object.keys(HELD_TUNINGS).find((k) => HELD_TUNINGS[k].engine && sfxSound(k)?.sustain);
const loopRow = Object.keys(HELD_TUNINGS).find((k) => HELD_TUNINGS[k].loop && sfxSound(k)?.sustain);
const T = HELD_TUNINGS[engineRow], [idle, red] = T.rpm, rpms = [idle, Math.round((idle + red) / 2), red];
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
const held = (spec) => ({ kind: 'beats-sfx', title: 'held probe', sustains: { e: spec } });
const LANE = [[0, 0], [0.3, 1], [0.6, 0]];

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const card = (hz, extra) => { const b = wav(hz), id = sha(b).slice(0, 16); writeFileSync(path.join(dir, 'masters', `${id}.wav`), b); return { role: 'loop', loop: true, ...extra, variants: [{ id, take: 1, seconds: 1 }] }; };
  const cards = Object.fromEntries(rpms.map((r) => [`${T.engine}-${r}`, card(r / 30, { engine: T.engine, rpm: r })]));
  cards[HELD_TUNINGS[loopRow].loop] = card(900, {});
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('recorded held voices', () => {
  it('without the library, a held row keeps its synthesized voice', () => {
    library(false);
    expect(sfxSound(engineRow).recorded).toBeUndefined();
    expect(recordedHeld(engineRow, sfxSound(engineRow).sustain)).toBe(null);
  });

  it('an engine is its loops on windows that rise in order, each bent by revs over its own, the synthesized spec the fallback', () => {
    library(false);
    const synth = sfxSound(engineRow).sustain;
    library(true);
    const s = sfxSound(engineRow).sustain;
    expect(s.fallback).toEqual(synth);
    expect(s.layers.map((L) => L.library)).toEqual(rpms.map((r) => `${T.engine}-${r}`));
    expect(s.layers[0].window[0]).toBe(s.layers[0].window[1]);   // full below the lowest
    expect(s.layers.at(-1).window[2]).toBe(s.layers.at(-1).window[1]);   // and above the highest
    for (let i = 1; i < s.layers.length; i++) expect(s.layers[i].window[1]).toBeGreaterThan(s.layers[i - 1].window[1]);
    s.layers.forEach((L, i) => expect(L.rate[0] * rpms[i]).toBeCloseTo(idle, 0));
    expect(validateBeatsManifest(held(s)).ok).toBe(true);
    expect(audioFeatures({ sustains: { e: s } })).toEqual(expect.arrayContaining(['sustain', 'sampler']));
    expect(gestureSampleCards({ sustains: { e: s } })).toHaveLength(rpms.length);
  });

  it('the widest rev range in the table is a valid held voice, its lowest loop bent far up where it is silent', () => {
    const [wide, W] = Object.entries(HELD_TUNINGS).filter(([, t]) => t.engine).sort(([, a], [, b]) => b.rpm[1] / b.rpm[0] - a.rpm[1] / a.rpm[0])[0];
    library(true);
    const synth = { layers: [{ kind: 'noise', gain: [0, 1] }] };
    const cards = Object.fromEntries([W.rpm[0], W.rpm[1]].map((r) => [`${W.engine}-${r}`, r]));
    // (its two ends recorded, in the fixture's library beside the probe engine)
    const lib = JSON.parse(readFileSync(path.join(dir, 'library.json'), 'utf8')), some = Object.values(lib.cards)[0].variants;
    for (const [card, rpm] of Object.entries(cards)) lib.cards[card] = { role: 'loop', loop: true, engine: W.engine, rpm, variants: some };
    writeFileSync(path.join(dir, 'library.json'), JSON.stringify(lib)); forgetLibrary();
    const s = recordedHeld(wide, synth);
    expect(s.layers[0].rate[1]).toBeGreaterThan(8);
    expect(validateBeatsManifest(held(s)).ok).toBe(true);
  });

  it('a loop row is its one loop under the control', () => {
    library(true);
    const s = sfxSound(loopRow).sustain;
    expect(s.layers).toEqual([expect.objectContaining({ kind: 'sample', library: HELD_TUNINGS[loopRow].loop })]);
  });

  it('it renders its recordings, the same bytes twice; unloaded, exactly its synthesized voice', async () => {
    library(true);
    const s = sfxSound(engineRow).sustain;
    const a = await renderBeatsOffline(held(s), { sustain: 'e', lane: LANE, tail: 0.1 });
    const b = await renderBeatsOffline(held(s), { sustain: 'e', lane: LANE, tail: 0.1 });
    expect(sha(a.wav)).toBe(sha(b.wav));
    library(false);
    const unloaded = await renderBeatsOffline(held(s), { sustain: 'e', lane: LANE, tail: 0.1 });
    const synth = await renderBeatsOffline(held(s.fallback), { sustain: 'e', lane: LANE, tail: 0.1 });
    expect(sha(unloaded.wav)).toBe(sha(synth.wav));
    expect(sha(a.wav)).not.toBe(sha(synth.wav));
  });
});
