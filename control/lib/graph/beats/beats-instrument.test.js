// A recorded INSTRUMENT played note by note: the pitch converter reads what note a take really is and where it loops
// (scripts/sound-library/pitch.js); the library hands a page an instrument's takes with their roots and loops; the
// kernel plays each note on the take whose root is nearest, bent the rest of the way, held on its loop for as long as
// the note lasts; without the library the instrument is, byte for byte, the synthesized one it stands in for. A tiny
// library is built here (steady sine notes), never the real one.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { renderBeatsOffline } from './beats-render.js';
import { normalizeBeatsManifest, validateBeatsManifest } from './beats-manifest.js';
import { INSTRUMENTS } from './instruments.js';
import { PATCHES, RECORDED_TWINS } from './audio-patches.js';
import { forgetLibrary, sampleSlice, hasInstrument } from '../sound-library/library.js';
import { fundamental, steadyPitch, loopPoints } from '../../../scripts/sound-library/pitch.js';

// the instrument patch (a zoned, looped sample voice), chosen in code
const INST = Object.keys(PATCHES).find((k) => PATCHES[k].voice === 'sample' && PATCHES[k].zones && PATCHES[k].loop);
const NAME = PATCHES[INST].library;
const SR = 44100;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const sha = (b) => createHash('sha256').update(b).digest('hex');

function tone(seconds, hz, shape = (p) => Math.sin(p)) {
  const n = Math.round(seconds * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.7 * shape((2 * Math.PI * hz * i) / SR);
  return x;
}
function wavOf(x) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(32000 * x[i]), 44 + i * 2);
  return b;
}
// a rendered WAV's first channel as floats
function samplesOf(wav) {
  let o = 12, fmt = null, data = null;
  while (o + 8 <= wav.length) { const id = wav.toString('ascii', o, o + 4), size = wav.readUInt32LE(o + 4); if (id === 'fmt ') fmt = { ch: wav.readUInt16LE(o + 10), bits: wav.readUInt16LE(o + 22) }; else if (id === 'data') data = { at: o + 8, size }; o += 8 + size + (size % 2); }
  const step = (fmt.bits / 8) * fmt.ch, n = Math.floor(data.size / step), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = fmt.bits === 16 ? wav.readInt16LE(data.at + i * step) / 32768 : wav.readFloatLE(data.at + i * step);
  return x;
}
const rms = (x, a, b) => { let s = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, Math.round((b - a) * SR))); };
const render = async (note, beats = 4) => samplesOf((await renderBeatsOffline(normalizeBeatsManifest({ kind: 'beats-composition', title: 'instrument probe', bpm: 120, parts: [{ name: 'k', patch: INST, events: [[0, note, beats, 0.8]] }] }), { tail: 0.5 })).wav);

let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
// the takes: two notes a fifth and an octave apart (A3 and A4), each 0.6 s, looped on whole periods; and one that holds
// no pitch, left without a root (conditioning leaves such a take out of its instrument)
const ROOTS = [57, 69];
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-instrument-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {};
  ROOTS.forEach((root) => {
    const x = tone(0.6, mtof(root)), b = wavOf(x), id = sha(b).slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[`inst-${root}`] = { instrument: NAME, pitched: true, sustain: true, role: 'instrument', variants: [{ id, take: 1, seconds: 0.6, root, loopAt: loopPoints(x, SR, mtof(root)) }] };
  });
  const nb = wavOf(Float32Array.from({ length: SR / 4 }, (_, i) => Math.sin(i * 12.9898) * 0.3)), nid = sha(nb).slice(0, 16);
  writeFileSync(path.join(dir, 'masters', `${nid}.wav`), nb);
  cards['inst-noise'] = { instrument: NAME, pitched: true, role: 'instrument', variants: [{ id: nid, take: 1, seconds: 0.25 }] };
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the pitch converter', () => {
  it('reads a note to the cent, harmonics and all, and refuses a take that holds no pitch', () => {
    const saw = (p) => ((p / (2 * Math.PI)) % 1) * 2 - 1;
    expect(Math.abs(fundamental(tone(1, 300, saw), SR).hz - 300)).toBeLessThan(1);
    expect(Math.abs(steadyPitch(tone(2, mtof(64)), SR).midi - 64)).toBeLessThan(0.05);
    let s = 7;
    const noise = Float32Array.from({ length: SR * 2 }, () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 - 0.5; });
    expect(steadyPitch(noise, SR)).toBe(null);
  });

  it('loops a held note on a whole number of its periods', () => {
    const hz = 220, [a, b] = loopPoints(tone(2, hz), SR, hz), periods = (b - a) * hz;
    expect(Math.abs(periods - Math.round(periods))).toBeLessThan(0.02);
    expect(b - a).toBeGreaterThan(0.5);
  });
});

describe('an instrument from the library', () => {
  it('a page is handed its pitched takes with their roots and loops; a take with no root is left out', () => {
    library(true);
    const S = sampleSlice([NAME]);
    expect(S.cards[NAME]).toHaveLength(ROOTS.length);
    expect(Object.values(S.roots).sort()).toEqual(ROOTS);
    expect(Object.keys(S.loops)).toHaveLength(ROOTS.length);
    expect(hasInstrument(NAME)).toBe(true);
  });

  it('each note plays on its nearest take, bent the rest of the way: a C4 from the A3 take, an A4 from its own', async () => {
    library(true);
    for (const [note, midi] of [['C4', 60], ['A4', 69]]) {
      const x = await render(note);
      expect(Math.abs(steadyPitch(x.subarray(0, SR * 1.5), SR).midi - midi)).toBeLessThan(0.1);
    }
  });

  it('a note held past its take\'s length holds on its loop', async () => {
    library(true);
    const x = await render('A4', 4);
    expect(rms(x, 1.3, 1.8)).toBeGreaterThan(0.5 * rms(x, 0.1, 0.5));
  });

  it('without the library the instrument is the synthesized one it stands in for, byte for byte', async () => {
    library(false);
    const own = await renderBeatsOffline(normalizeBeatsManifest({ kind: 'beats-composition', title: 'p', bpm: 120, parts: [{ name: 'k', patch: INST, events: [[0, 'C4', 2, 0.8]] }] }));
    const synth = await renderBeatsOffline(normalizeBeatsManifest({ kind: 'beats-composition', title: 'p', bpm: 120, parts: [{ name: 'k', patch: Object.keys(PATCHES).find((k) => PATCHES[k] === PATCHES[INST].fallback), events: [[0, 'C4', 2, 0.8]] }] }));
    expect(sha(own.wav)).toBe(sha(synth.wav));
  });
});

describe('the recorded twins', () => {
  it('each names a zoned recorded instrument standing in for the synthesized patch it is the twin of', () => {
    for (const [synth, twin] of Object.entries(RECORDED_TWINS)) {
      expect(PATCHES[twin]).toMatchObject({ voice: 'sample', zones: true });
      expect(PATCHES[twin].fallback).toBe(PATCHES[synth]);
    }
  });
});

describe('the recorded switch', () => {
  // an instrument whose patch has a twin, and one whose has none, chosen in code
  const TWINNED = Object.keys(INSTRUMENTS).find((i) => RECORDED_TWINS[INSTRUMENTS[i].patch] === INST);
  const PLAIN = Object.keys(INSTRUMENTS).find((i) => typeof INSTRUMENTS[i].patch === 'string' && !RECORDED_TWINS[INSTRUMENTS[i].patch] && !PATCHES[INSTRUMENTS[i].patch]?.kit);
  const song = (extra = {}, part = {}) => ({ kind: 'beats-composition', title: 'switch', bpm: 120, ...extra, parts: [
    { name: 'a', instrument: TWINNED, events: [[0, 'C4', 2, 0.8]], ...part }, { name: 'b', instrument: PLAIN, events: [[0, 'E4', 2, 0.7]] }] });

  it('puts every part whose patch has a twin on it, its instrument\'s chain kept, and leaves the rest', () => {
    const N = normalizeBeatsManifest(song({ recorded: true }));
    expect(N.parts[0].patch).toBe(INST);
    expect(N.parts[0].chain).toEqual(INSTRUMENTS[TWINNED].chain);
    expect(N.parts[1].patch).toBe(INSTRUMENTS[PLAIN].patch);
    expect(normalizeBeatsManifest(song({ recorded: true }, { recorded: false })).parts[0].patch).toBe(INSTRUMENTS[TWINNED].patch);
    expect(normalizeBeatsManifest(song({}, { recorded: true })).parts[0].patch).toBe(INST);
    expect(normalizeBeatsManifest(song()).parts[0].patch).toBe(INSTRUMENTS[TWINNED].patch);
  });

  it('is a yes or a no', () => {
    expect(validateBeatsManifest(song({ recorded: 'yes' })).errors.join(' ')).toMatch(/recorded is true or false/);
    expect(validateBeatsManifest(song({ recorded: true })).ok).toBe(true);
  });

  it('without the library a song switched to recorded renders byte for byte as it does without the switch', async () => {
    library(false);
    const on = await renderBeatsOffline(normalizeBeatsManifest(song({ recorded: true })));
    const off = await renderBeatsOffline(normalizeBeatsManifest(song()));
    expect(sha(on.wav)).toBe(sha(off.wav));
  });

  it('with it, the switched song is the one that names its twins by hand', async () => {
    library(true);
    const on = await renderBeatsOffline(normalizeBeatsManifest(song({ recorded: true })));
    const hand = await renderBeatsOffline(normalizeBeatsManifest(song({}, { patch: INST })));
    expect(sha(on.wav)).toBe(sha(hand.wav));
  });
});

describe('a twin heard through an amp', () => {
  it('moves its instrument\'s amp makeup by its trim, once: a song normalized twice is the song normalized once', () => {
    const twin = Object.keys(PATCHES).find((k) => PATCHES[k].ampTrim);
    const synth = Object.keys(RECORDED_TWINS).find((k) => RECORDED_TWINS[k] === twin);
    const inst = Object.keys(INSTRUMENTS).find((i) => INSTRUMENTS[i].patch === synth && (INSTRUMENTS[i].chain || []).some((f) => f.type === 'amp'));
    const amp = (m) => m.parts[0].chain.find((f) => f.type === 'amp').level;
    const plain = normalizeBeatsManifest({ kind: 'beats-composition', title: 'amp', bpm: 120, parts: [{ name: 'g', instrument: inst, events: [[0, 'E3', 1, 0.8]] }] });
    const once = normalizeBeatsManifest({ kind: 'beats-composition', title: 'amp', bpm: 120, recorded: true, parts: [{ name: 'g', instrument: inst, events: [[0, 'E3', 1, 0.8]] }] });
    expect(amp(once)).toBeCloseTo((amp(plain) ?? -10) + PATCHES[twin].ampTrim, 5);
    expect(normalizeBeatsManifest(once)).toEqual(once);
  });
});
