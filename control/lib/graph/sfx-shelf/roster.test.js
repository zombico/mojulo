import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { SOUNDS, SOUND_IDS, CATEGORIES, SLOTS, normalizeName, soundNameIndex, resolveSoundId, soundsIn, sfxGaps } from './roster.js';
import { STYLES, STYLE_NAMES } from './styles.js';
import { SETS, SET_NAMES, FLOOR_SETS, setManifest } from './sets.js';
import { MECHA, MECHA_HASH } from './sets/mecha.js';
import { SFX_PALETTES, SFX_PALETTE_NAMES, SFX_CUE_IDS } from '../beats/sfx-palettes.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';
import { FAMILIES, familyDials } from './families.js';

const FROZEN = 'a palette cue id is exactly one shelf row (sfx-shelf/roster.js): a new sound is a row first';
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

const CONTRACT = {
  label: (r) => (typeof r.label === 'string' && r.label.length > 0) || 'label: what it is in prose',
  aliases: (r) => (Array.isArray(r.aliases) && r.aliases.every((a) => typeof a === 'string' && a.length >= 3)) || 'aliases: the words people say, 3+ characters each',
  category: (r) => r.category in CATEGORIES || `category: one of ${Object.keys(CATEGORIES).join(', ')}`,
  slot: (r) => SLOTS.includes(r.slot) || `slot: one of ${SLOTS.join(', ')}`,
  family: (r) => r.family === null || (r.family in SOUNDS && SOUNDS[r.family].palette === r.family) || 'family: null or a palette row',
  voiced: (r) => !!(r.palette || r.channel || (r.voices && Object.keys(r.voices).length)) || 'a palette cue, a set voice or a channel slot',
  voices: (r) => Object.entries(r.voices ?? {}).every(([style, set]) => style in STYLES && !STYLES[style].palette && (set in SETS || (set === 'families' && r.make))) || "voices: { <non-palette style>: <set> | 'families' (with make) }",
  make: (r) => r.make === undefined || (r.make.family in FAMILIES && (() => { try { familyDials(r.make.family, r.make.dials); return true; } catch { return false; } })()) || 'make: { family, dials } a family builds at those dials',
  channel: (r) => r.channel === undefined || (SLOTS.includes(r.channel) && r.channel === r.slot) || 'channel: the slot its code plays in',
};

describe('the sound row contract', () => {
  it('every row says everything the shelf needs', () => {
    const missing = SOUND_IDS.flatMap((id) => Object.values(CONTRACT).map((c) => c(SOUNDS[id])).filter((m) => m !== true).map((m) => `${id}: ${m}`));
    expect(missing).toEqual([]);
  });

  it('every id and alias is one word on the index: no two rows answer to the same word', () => {
    const words = SOUND_IDS.flatMap((id) => [id, ...SOUNDS[id].aliases].map((w) => [normalizeName(w), id]));
    const clash = words.filter(([w, id], i) => words.findIndex(([v]) => v === w) !== i && words.find(([v]) => v === w)[1] !== id);
    expect(clash).toEqual([]);
    expect(soundNameIndex().size).toBe(new Set(words.map(([w]) => w)).size);
  });

  it('a word resolves however it is written', () => {
    const id = SOUND_IDS.find((i) => SOUNDS[i].voices);
    const alias = SOUNDS[id].aliases[0];
    expect(resolveSoundId(id)).toBe(id);
    expect(resolveSoundId(alias.toUpperCase().replace(/ /g, '_'))).toBe(id);
    expect(resolveSoundId('no such sound')).toBeNull();
  });

  it('the rows are frozen', () => {
    const r = SOUNDS[SOUND_IDS[0]];
    expect(Object.isFrozen(r) && Object.isFrozen(r.aliases)).toBe(true);
  });
});

describe('the palettes are frozen behind the shelf', () => {
  it('the palette styles are the palettes', () => {
    expect(STYLE_NAMES.filter((s) => STYLES[s].palette)).toEqual(SFX_PALETTE_NAMES);
    for (const s of STYLE_NAMES.filter((n) => !STYLES[n].palette)) expect(STYLES[s].fallback in STYLES).toBe(true);
  });

  it(`every palette cue id is exactly one row, its own family (${FROZEN})`, () => {
    const claimed = SOUND_IDS.filter((id) => SOUNDS[id].palette).map((id) => SOUNDS[id].palette);
    expect([...claimed].sort()).toEqual([...SFX_CUE_IDS].sort());
    for (const cue of SFX_CUE_IDS) expect(SOUNDS[cue]?.family).toBe(cue);
  });

  it('every palette voices every one of its cue ids (so a palette style needs no fallback)', () => {
    for (const p of SFX_PALETTE_NAMES) expect(Object.keys(SFX_PALETTES[p]).sort()).toEqual([...SFX_CUE_IDS].sort());
  });
});

describe('the sets', () => {
  it('a row a set voices is a cue of that set, and every cue of a set no other stands on is a row it voices', () => {
    const voiced = SOUND_IDS.flatMap((id) => Object.values(SOUNDS[id].voices ?? {}).filter((set) => set !== 'families').map((set) => `${set}:${id}`)).sort();
    const cues = SET_NAMES.filter((s) => !FLOOR_SETS.includes(s)).flatMap((s) => Object.keys(SETS[s].cues).map((c) => `${s}:${c}`)).sort();
    expect(voiced).toEqual(cues);
  });

  it('a set that stands on a floor improves it cue for cue: the same ids, every floor gesture kept in order', () => {
    for (const s of SET_NAMES.filter((n) => SETS[n].floor)) {
      const F = SETS[SETS[s].floor];
      expect(F, `${s}'s floor`).toBeDefined();
      expect(Object.keys(SETS[s].cues).sort()).toEqual(Object.keys(F.cues).sort());
      for (const [id, g] of Object.entries(F.cues)) {
        const kept = SETS[s].cues[id].slice(0, g.length).map((x) => ({ type: x.type, seed: x.seed, from: x.from, to: x.to, note: x.note }));
        expect(kept, `${s}:${id}`).toEqual(g.map((x) => ({ type: x.type, seed: x.seed, from: x.from, to: x.to, note: x.note })));
      }
    }
  });

  it('every set is a beats-sfx manifest the beats tools take as it is, in a space or dry', () => {
    for (const name of SET_NAMES) {
      expect(validateBeatsManifest(setManifest(name)), name).toEqual({ ok: true, errors: [] });
      expect(validateBeatsManifest(setManifest(name, { space: 'hangar' })).ok).toBe(true);
    }
    expect(() => setManifest('no-such-set')).toThrow(/one of/);
  });

  it('the mecha set is its recorded cues verbatim (a better voice is a new set, never an edit)', () => {
    expect(createHash('sha256').update(canon(MECHA.cues)).digest('hex').slice(0, 16)).toBe(MECHA_HASH);
    expect(Object.isFrozen(MECHA.cues[Object.keys(MECHA.cues)[0]][0])).toBe(true);
    expect(Object.keys(MECHA.used).sort()).toEqual(Object.keys(MECHA.cues).sort());
  });
});

describe('the gaps', () => {
  it('a category with no row is a gap, and a gap has no row', () => {
    const gaps = sfxGaps();
    for (const c of Object.keys(CATEGORIES)) expect(gaps.includes(c)).toBe(soundsIn(c).length === 0);
  });
});
