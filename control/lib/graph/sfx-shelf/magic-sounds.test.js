// The magic kit: each element by its phase and tier, the statuses, the spells, a battle's moments and what magic does
// to a world, each a shelf row heard as its stand-in until the library records it; an RPG battle's happenings heard by
// it (one sound a lane, the accents over it) where the library records the kit, and nothing moving without it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { MAGIC_ROWS, ELEMENTS, ELEMENT_NAMES, STATUSES, STATUS_SHARED, SPELLS, BATTLE, WORLD, WORLD_HELD, MAGIC_TIERS,
  elementOf, elementSound, skillTier, skillSounds, battleSounds, magicRecorded } from './magic-sounds.js';
import { SOUNDS, resolveSoundId } from './roster.js';
import { sfxSound } from './resolve.js';
import { forgetLibrary } from '../sound-library/library.js';
import { SKILL_PRESETS } from '../playscape/rpg/presets.js';
import { soundSheet, sheetAudio, readSound } from '../gameworld/sound-sheet.js';
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

// one skill per procedure, chosen in code from the presets: an elemental spell on one, one on every foe, a heal, a
// revive, a lowering, a plain blow
const pick = (f) => Object.keys(SKILL_PRESETS).find((id) => f(SKILL_PRESETS[id]));
const ONE = pick((s) => s.element && s.stat === 'mag' && s.target === 'foe');
const ALL = pick((s) => s.element && s.stat === 'mag' && s.target === 'foes');
const HEAL = pick((s) => s.heal && s.target === 'ally');
const REVIVE = pick((s) => s.revive);
const LOWER = pick((s) => s.buff && s.buff.pct < 0);
const BLOW = pick((s) => s.stat === 'atk' && !s.element && s.power > 0);
const BATTLE_WORLD = { battles: {}, sound: {} };

let dir = null;
const prev = process.env.MOJULO_SOUNDS_DIR;
const library = (on) => { process.env.MOJULO_SOUNDS_DIR = on ? dir : path.join(dir, 'absent'); forgetLibrary(); };
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'mojulo-magic-'));
  mkdirSync(path.join(dir, 'masters'));
  const cards = {}, card = (name, extra, hz) => {
    const b = wav(hz), id = createHash('sha256').update(b).digest('hex').slice(0, 16);
    writeFileSync(path.join(dir, 'masters', `${id}.wav`), b);
    cards[name] = { ...extra, variants: [{ id, take: 1, seconds: 0.25 }] };
  };
  // the kit's mark (a fire bolt) and a tier above it
  card('a-fire-bolt', { shelf: elementSound('fire'), role: 'one-shot', tags: ['magic'] }, 300);
  card('a-fire-burst', { shelf: elementSound('fire', { tier: 'major' }), role: 'one-shot', tags: ['magic'] }, 200);
  writeFileSync(path.join(dir, 'library.json'), JSON.stringify({ version: 1, cards }));
});
afterAll(() => {
  if (prev === undefined) delete process.env.MOJULO_SOUNDS_DIR; else process.env.MOJULO_SOUNDS_DIR = prev;
  forgetLibrary();
  rmSync(dir, { recursive: true, force: true });
});

describe('the kit', () => {
  it('every word it can say is a row of the shelf, and every row it lays is one', () => {
    const words = [...ELEMENT_NAMES.flatMap((el) => [elementSound(el, { phase: 'cast' }), ...MAGIC_TIERS.map((tier) => elementSound(el, { tier }))]),
      ...Object.keys(STATUSES).map((s) => `status-${s}`), ...Object.values(STATUS_SHARED), ...Object.values(SPELLS), ...Object.values(BATTLE), ...Object.values(WORLD), ...Object.values(WORLD_HELD)];
    expect(words.filter((w) => !resolveSoundId(w))).toEqual([]);
    expect(MAGIC_ROWS.filter((r) => !SOUNDS[r.id]?.recorded).map((r) => r.id)).toEqual([]);
  });

  it('an element is one element whatever a game calls it, and its tiers are heard apart', () => {
    const [el] = ELEMENT_NAMES, [word] = ELEMENTS[el].words;
    expect(elementOf(word.toUpperCase())).toBe(el);
    expect(new Set(MAGIC_TIERS.map((tier) => elementSound(word, { tier }))).size).toBe(MAGIC_TIERS.length);
    expect(() => elementSound('plasma')).toThrow(/names no element/);
  });

  it('a skill is heard by what it does: its element at its tier, a heal, a revive, a lowering; a plain blow casts nothing', () => {
    expect(skillTier(SKILL_PRESETS[ONE])).toBe('minor');
    expect(skillTier(SKILL_PRESETS[ALL])).not.toBe('minor');
    expect(skillSounds(SKILL_PRESETS[ONE])).toEqual({ cast: elementSound(SKILL_PRESETS[ONE].element, { phase: 'cast' }), land: elementSound(SKILL_PRESETS[ONE].element) });
    expect(skillSounds(SKILL_PRESETS[HEAL]).land).toBe(SPELLS.heal);
    expect(skillSounds(SKILL_PRESETS[REVIVE]).land).toBe(SPELLS.revive);
    expect(skillSounds(SKILL_PRESETS[LOWER]).land).toBe(STATUS_SHARED.down);
    expect(skillSounds(SKILL_PRESETS[BLOW]).cast).toBeUndefined();
  });

  it('a battle\'s happenings: a skill\'s own tier ahead of its element, the element ahead of any blow, the ends a lane of their own', () => {
    const B = battleSounds(SKILL_PRESETS), at = (k) => B.order.findIndex(([h]) => h === k);
    expect(at(`skill:${ALL}`)).toBeGreaterThanOrEqual(0);
    expect(at(`skill:${ALL}`)).toBeLessThan(at(`element:${SKILL_PRESETS[ALL].element}`));
    expect(at(`element:${SKILL_PRESETS[ALL].element}`)).toBeLessThan(at('hit'));
    expect(B.ends.map(([h]) => h)).toContain('ko');
    expect(B.also).toEqual({ crit: BATTLE.crit, weak: BATTLE.weak });
  });
});

describe('on the shelf', () => {
  it('without the library a row is heard as its stand-in, byte for byte; one with no stand-in is silent', () => {
    library(false);
    const row = elementSound('fire');
    expect(sfxSound(row).gestures).toEqual(sfxSound(SOUNDS[row].standIn).gestures);
    expect(sfxSound(SPELLS.timeStop)).toBe(null);
    expect(magicRecorded()).toBe(false);
  });

  it('with it, its recording plays over the stand-in', () => {
    library(true);
    expect(magicRecorded()).toBe(true);
    expect(sfxSound(elementSound('fire')).gestures[0]).toMatchObject({ type: 'sample', library: 'a-fire-bolt' });
  });
});

describe('a game\'s battles heard', () => {
  it('without the library the sheet and its page are as they were', () => {
    library(false);
    expect(soundSheet(BATTLE_WORLD).battle).toBeUndefined();
    expect(sheetAudio(BATTLE_WORLD).sheet.battle).toBeUndefined();
  });

  it('with it, the page plays the first of each lane its frame carries, only the words it holds', () => {
    library(true);
    const A = resolveWorldAudio({ sfx: sheetAudio(BATTLE_WORLD) });
    expect(A.battle.order.length).toBeGreaterThan(0);
    for (const [, id] of [...A.battle.order, ...A.battle.ends]) expect(A.cues[id]).toBeTruthy();
    // (a word the library does not record and with no stand-in is left out: the kit's silent rows)
    expect(A.battle.order.some(([, id]) => id === `rpg-${SPELLS.timeStop}`)).toBe(false);
    const page = audioChannelScript(A);
    expect(page).toContain("indexOf('rpg-on:')");
    expect(audioChannelScript(resolveWorldAudio({ sfx: { cues: A.cues } }))).not.toContain("indexOf('rpg-on:')");
  });

  it('a game can turn them off, and says so only as false', () => {
    library(true);
    expect(soundSheet({ ...BATTLE_WORLD, sound: { battle: false } }).battle).toBeUndefined();
    expect(() => readSound({ battle: true })).toThrow(/\.battle is false/);
  });
});
