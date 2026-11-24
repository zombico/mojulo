// A platformer's own moves (sound-sheet.js PLATFORM_RUN): a feel on the platformer's base whose charge is no shot hears its
// wall kick, wall slide, a blow taken, a foe stomped on and its jump in the air through the run channel, only where the
// game's own recordings (its flavor) are; without them its sheet and its page are as they were. A tiny library is built
// here: one flavored card for one of those moves.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { soundSheet, sheetAudio, PLATFORM_RUN, RUN_LEVEL } from './sound-sheet.js';
import { POLES } from './feel/cards.js';
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

// a platformer's pole whose charge is no shot, chosen from the cards, not named
const pole = Object.keys(POLES).find((p) => POLES[p].base === 'platformer' && POLES[p].set?.charge?.kind !== 'shot');
const G = { sound: {}, feel: pole };
let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-sounds-'));
  mkdirSync(path.join(dir, 'masters'));
  const b = wav(400), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
  writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards: { 'own-air': { shelf: PLATFORM_RUN.air, flavor: pole, role: 'one-shot', variants: [{ id, take: 1, seconds: 0.25 }] } } }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('a platformer\'s own moves', () => {
  it('without its own recordings a platformer has no run, and its page plays none', () => {
    library(false);
    expect(soundSheet(G).run).toBeUndefined();
    expect(audioChannelScript(resolveWorldAudio({ sfx: { sheet: sheetAudio(G).sheet } }))).not.toContain('airJumpsUsed');
  });

  it('with them, its moves ride the run channel, its double jump among them, and its mix is its own', () => {
    library(true);
    const S = soundSheet(G);
    expect(S.run).toEqual(PLATFORM_RUN);
    expect(S.flavor).toBe(pole);
    expect(sheetAudio(G).sheet.level ?? null).not.toBe(RUN_LEVEL);
    const audio = resolveWorldAudio({ sfx: { sheet: sheetAudio(G).sheet } });
    expect(audio.run.air).toEqual([expect.objectContaining({ type: 'sample' })]);
    expect(audioChannelScript(audio)).toContain('P.airJumpsUsed');
  });
});
