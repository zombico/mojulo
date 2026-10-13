import { describe, it, expect } from 'vitest';
import { SFX_PALETTES, SFX_PALETTE_NAMES, SFX_CUE_IDS, MECHANIC_SFX, paletteCues, paletteForIdentity, levelSfx } from './sfx-palettes.js';
import { validateBeatsManifest } from './beats-manifest.js';
import { scoreIdentity } from './field-score.js';
import { midiOf } from './beats-authoring.js';
import { resolveWorldAudio } from './beats-world.js';
import { MECHANIC_KINDS } from '../game/mechanics.js';

describe('sfx palettes', () => {
  it('every palette names the same cues, each valid and warning-free in any key', () => {
    for (const name of SFX_PALETTE_NAMES) {
      expect(Object.keys(SFX_PALETTES[name]).sort(), name).toEqual([...SFX_CUE_IDS].sort());
      for (const id of [undefined, 0, 3, 777, 4242]) {
        const v = validateBeatsManifest({ kind: 'beats-sfx', title: name, cues: paletteCues(name, id) });
        expect([...v.errors, ...(v.warnings || [])], `${name} ${id}`).toEqual([]);
      }
    }
  });

  it("the game's tonic moves every pitched gesture together (−5 … +6), and nothing else", () => {
    const id = scoreIdentity(31);
    const k = ((id.tonic + 5) % 12) - 5;
    const base = paletteCues('arcade'), moved = paletteCues('arcade', id);
    expect(midiOf(moved.jump[0].from) - midiOf(base.jump[0].from)).toBe(k);
    expect(midiOf(moved.pickup[1].to) - midiOf(base.pickup[1].to)).toBe(k);
    expect(moved.step).toEqual(base.step);   // noise has no key
    for (let seed = 0; seed < 40; seed++) { const t = scoreIdentity(seed).tonic, kk = ((t + 5) % 12) - 5; expect(kk).toBeGreaterThanOrEqual(-5); expect(kk).toBeLessThanOrEqual(6); }
  });

  it('a score identity implies a palette by its band; none is arcade', () => {
    expect(paletteForIdentity(null)).toBe('arcade');
    const seen = new Set(Array.from({ length: 60 }, (_, s) => paletteForIdentity(scoreIdentity(s))));
    expect([...seen].sort()).toEqual(['foley', 'orchestral', 'synth']);
  });

  it('every wired mechanic is a mechanic, and every cue it names is in the palettes', () => {
    for (const [kind, rows] of Object.entries(MECHANIC_SFX)) {
      expect(MECHANIC_KINDS, kind).toContain(kind);
      for (const cue of Object.values(rows)) expect(SFX_CUE_IDS, `${kind} → ${cue}`).toContain(cue);
    }
  });
});

describe('levelSfx', () => {
  it("wires only the events the level's mechanics emit", () => {
    const L = levelSfx({ mechanics: ['collect', 'reach-exit'] });
    expect(L.on).toEqual({ 'pickup:*': 'pickup', 'goal:reached*': 'goal' });
    expect(levelSfx({ mechanics: [] }).on).toEqual({});
    expect(levelSfx({ mechanics: ['hp-pool', 'fail-on-death', 'waves'] }).on).toEqual({ 'hit:*': 'hit', 'enemy:down': 'down', dead: 'death', wave: 'wave', leak: 'hit', 'base:fallen': 'lose', 'waves:cleared': 'goal' });
  });

  it('the gait, weapon, melee and dodge sounds come from the same palette', () => {
    const L = levelSfx({ palette: 'foley' });
    expect(L.footsteps).toEqual({ step: L.cues.step, jump: L.cues.jump, land: L.cues.land });
    expect(L.weapon.shot).toBe(L.cues.shoot);
    expect(L.strike).toEqual({ swing: L.cues.swing, hit: L.cues.strike });
  });
});

describe("audio.sfx: 'auto' on a world", () => {
  it("resolves to the palette the soundtrack's identity implies, in its key, wired to the level's mechanics", () => {
    const a = resolveWorldAudio({ soundtrack: { score: { mood: 'forest', game: 4410 } }, sfx: 'auto' }, { ref: 'lv-1', mechanics: ['collect', 'door'] });
    const L = levelSfx({ identity: 4410, mechanics: ['collect', 'door'] });
    expect(a.palette).toBe(paletteForIdentity(scoreIdentity(4410)));
    expect(a.cues).toEqual(L.cues);
    expect(a.on).toEqual({ 'pickup:*': 'pickup', 'door:*': 'door' });
    expect(a.vary).toBe(true);
    expect(a.footsteps).toEqual(L.footsteps);
  });

  it('with no field score it is arcade in C; a named palette, written rows and cues win', () => {
    expect(resolveWorldAudio({ sfx: 'auto' }, { mechanics: [] }).palette).toBe('arcade');
    const own = [{ type: 'ring', note: 'C6', material: 'glass', decay: 0.3 }];
    const a = resolveWorldAudio({ sfx: { auto: 'synth', cues: { pickup: own, ping: own }, on: { 'pickup:gem': 'ping' }, vary: false }, footsteps: true }, { mechanics: ['collect'] });
    expect(a.palette).toBe('synth');
    expect(a.cues.pickup).toEqual(own);
    expect(Object.keys(a.on)).toEqual(['pickup:gem', 'pickup:*']);   // the written row first: it wins the match
    expect(a.vary).toBeUndefined();
    expect(a.footsteps.step).not.toEqual(levelSfx({ palette: 'synth' }).cues.step);   // footsteps: true keeps its own defaults
  });

  it('teaches an unknown palette, a bare string', () => {
    expect(() => resolveWorldAudio({ sfx: { auto: 'kazoo' } })).toThrow(/the palettes: arcade, foley, orchestral, synth/);
    expect(() => resolveWorldAudio({ sfx: 'loud' })).toThrow(/audio.sfx is 'auto'/);
  });
});
