// The menus' sounds, pinned to mana-ui's sound sets (a card's `ui` cues on its `uiSets`): a page whose theme plays a set
// hears that set's recordings over its synthesized cues, a game's menus (the play shell) hear them where its ui names
// the set, and nothing moves without them. And a recording's reuse: `also` voices more rows with the same takes. A tiny
// library is built here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { uiSoundAudio, uiSounds, UI_SOUND_SET_IDS } from '../beats/ui-sounds.js';
import { forgetLibrary, hasUi, recordedFor, recordedUi, recordingsTagged } from './library.js';
import { shellManaConfig, shellManaScript, readShellUi } from '../game/play-shell-mana.js';
import { menuSoundSet, MENU_SOUNDS } from '../playscape/ui/interface-look.js';
import { SOUND_IDS, SOUNDS } from '../sfx-shelf/roster.js';

function wav(hz) {
  const sr = 44100, n = sr / 4, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / sr)), 44 + i * 2);
  return b;
}

// one set pinned, one left alone, and two one-shot rows for `also`, chosen in code
const [pinned, other] = UI_SOUND_SET_IDS;
const [rowA, rowB] = SOUND_IDS.filter((id) => SOUNDS[id].slot === 'on').slice(0, 2);
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
  card('menu-accept', { role: 'cue', ui: ['accept'], uiSets: [pinned], tags: ['menu'] }, 600);
  card('a-chime', { shelf: rowA, also: [rowB], role: 'cue', tags: ['success'] }, 700);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('menu sounds pinned to mana-ui\'s sets', () => {
  it('a recording voices its cue in the set it is pinned to, and no other set', () => {
    library(true);
    expect(recordedUi('accept', { set: pinned }).card).toBe('menu-accept');
    expect(recordedUi('accept', { set: other })).toBe(null);
    expect(recordedUi('back', { set: pinned })).toBe(null);
    expect(hasUi(pinned)).toBe(true);
    expect(hasUi(other)).toBe(false);
  });

  it('a page\'s sounds carry the recording over the set\'s own cue, its fallback; without the library they are as they were', () => {
    library(false);
    const plain = uiSoundAudio([pinned]);
    expect(plain.samples).toBeUndefined();
    expect(plain.sets[pinned]).toEqual(uiSounds(pinned));
    library(true);
    const A = uiSoundAudio([pinned, other]);
    expect(A.sets[pinned].accept).toEqual([{ type: 'sample', library: 'menu-accept', dur: 0.25, fallback: uiSounds(pinned).accept }]);
    expect(A.sets[other]).toEqual(uiSounds(other));
    expect(A.samples.cards).toEqual({ 'menu-accept': expect.any(Array) });
    expect(A.source).toContain('loadSamples');
  });

  it('a game\'s menus play them where its ui names the set; without, the shell carries none of it', () => {
    expect(readShellUi({ theme: 'console', sounds: { set: pinned } })).toEqual([]);
    expect(readShellUi({ theme: 'console', sounds: { set: 'nope' } }).join(' ')).toContain('sounds');
    library(true);
    const M = shellManaConfig({ theme: 'console', sounds: { set: pinned } });
    expect(M.sounds.cues.accept[0].type).toBe('sample');
    expect(shellManaScript(M)).toContain("cues: 'full'");
    library(false);
    const N = shellManaConfig({ theme: 'console', sounds: { set: pinned } });
    expect(N.sounds).toBeUndefined();
    expect(shellManaScript(N)).toBe(shellManaScript());
  });

  it('a rail or a genre names its menus\' set over its look\'s', () => {
    const [pole, set] = Object.entries(MENU_SOUNDS.pole)[0];
    expect(menuSoundSet({ feel: pole }, 'console')).toBe(set);
    const [genre, gset] = Object.entries(MENU_SOUNDS.intent)[0];
    expect(menuSoundSet({ intent: { from: genre } }, 'console')).toBe(gset);
    expect(menuSoundSet({}, 'console')).toBe('console');
  });
});

describe('a recording reused', () => {
  it('`also` voices more rows with the same takes; `tags` find it again', () => {
    library(true);
    expect(recordedFor(rowA).card).toBe('a-chime');
    expect(recordedFor(rowB).card).toBe('a-chime');
    expect(recordingsTagged('success')).toEqual(['a-chime']);
  });
});
