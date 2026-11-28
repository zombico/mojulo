// A RECORDED SCORE on a World page (audio.js): a score whose `recorded` puts a part on its twin carries that twin's takes
// where the sound library is installed, and every engine that plays a score is handed them (the explore and combat
// engines of an adaptive score among them); without the library the page carries nothing of it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { audioChannelScript } from './audio.js';
import { resolveWorldAudio } from '../../beats/beats-world.js';
import { forgetLibrary } from '../../sound-library/library.js';
import { PATCHES } from '../../beats/audio-patches.js';

function wav(hz) {
  const sr = 22000, n = sr / 8, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// (the smallest adaptive score: a held chord on the string machine, recorded, and a synthesized one to fight to)
const piece = (title, instrument, recorded) => ({ kind: 'beats-composition', title, bpm: 90, loop: true, ...(recorded ? { recorded: true } : {}),
  parts: [{ name: 'pad', instrument, events: [['0:0:0', ['D3', 'F3', 'A3'], '4:0:0', 0.4]] }] });
const AUDIO = { soundtrack: piece('calm', 'string-machine', true), combat: piece('fight', 'acid-bass', false), tension: { on: { 'hit:*': 0.3 }, enter: 0.5, exit: 0.2, hold: 2, decay: 4 } };
const LIB = PATCHES.stringsRec.library;
const page = (spec) => audioChannelScript(resolveWorldAudio(spec, { time: 12, ref: 't' }));

let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-score-'));
  mkdirSync(path.join(dir, 'masters'));
  const b = wav(147), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
  writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards: { [`${LIB}-d3`]: { instrument: LIB, variants: [{ id, take: 1, seconds: 0.125, root: 50 }] } } }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a recorded score on a World page', () => {
  it('with the library: the twin\'s takes are inlined and handed to every score\'s engine', () => {
    library(true);
    const js = page(AUDIO);
    expect(js).toContain('const __SAMPLES = ');
    expect(js).toContain(`"${LIB}"`);
    expect(js).toContain('for (const e of Object.values(__engs)) __samplesFor(e);');
    expect(js).toContain('__samplesFor(__beatsEng);');
    library(false);
  });

  it('without it: not a byte of it', () => {
    library(false);
    const js = page(AUDIO);
    expect(js).not.toContain('__SAMPLES');
    expect(js).not.toContain('__samplesFor');
  });

  it('a score not recorded carries none, the library installed or not', () => {
    library(true);
    const js = page({ ...AUDIO, soundtrack: piece('calm', 'string-machine', false) });
    expect(js).not.toContain('__SAMPLES');
    library(false);
  });
});
