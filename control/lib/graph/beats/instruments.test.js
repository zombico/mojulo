import { describe, expect, it } from 'vitest';

import { INSTRUMENTS, FEEL_PRESETS, resolveFeel, resolveInstrument, auditInstruments } from './instruments.js';
import { PATCHES } from './audio-patches.js';
import { validateBeatsManifest, normalizeBeatsManifest } from './beats-manifest.js';

// ── B6 instrument model: named data + a merge, expanded at normalize time ───────

describe('shelf integrity', () => {
  it('every instrument references a real patch and a valid feel preset', () => {
    expect(auditInstruments()).toEqual([]);
  });

  it('every instrument chain uses only known effect types (cross-checks the FX whitelist via validate)', () => {
    for (const [name, inst] of Object.entries(INSTRUMENTS)) {
      const m = { kind: 'beats-composition', title: name, bpm: 120, parts: [{ name: 'p', patch: inst.patch, chain: inst.chain, events: [['0:0:0', 'C3']] }] };
      expect(validateBeatsManifest(m).ok, `${name}: ${validateBeatsManifest(m).errors.join(', ')}`).toBe(true);
    }
  });
});

describe('resolveFeel', () => {
  it('resolves a preset name to a params clone', () => {
    expect(resolveFeel('palm-mute')).toEqual(FEEL_PRESETS['palm-mute']);
    expect(resolveFeel('palm-mute')).not.toBe(FEEL_PRESETS['palm-mute']); // clone, not the shelf object
  });
  it('robotic (and any empty feel) resolves to undefined — the quantized/null path', () => {
    expect(resolveFeel('robotic')).toBeUndefined();
    expect(resolveFeel({})).toBeUndefined();
    expect(resolveFeel(undefined)).toBeUndefined();
  });
  it('clones an inline object and rejects bad shapes', () => {
    const o = { strum: 0.01 };
    expect(resolveFeel(o)).toEqual(o);
    expect(resolveFeel(o)).not.toBe(o);
    expect(() => resolveFeel('nope')).toThrow(/unknown feel preset/);
    expect(() => resolveFeel([1, 2])).toThrow(/preset name/);
  });
});

describe('resolveInstrument', () => {
  it('resolves a known instrument to { patch, chain, feel }', () => {
    const r = resolveInstrument('electric-guitar');
    expect(r.patch).toBe('guitarElectric');
    expect(PATCHES[r.patch]).toBeDefined();
    expect(r.chain).toEqual(INSTRUMENTS['electric-guitar'].chain);
    expect(r.feel).toEqual(FEEL_PRESETS['alt-pick']);
  });
  it('part overrides win: patch/chain replace, feel shallow-merges', () => {
    const r = resolveInstrument('electric-guitar', { patch: 'guitarLead', chain: [{ type: 'reverb' }], feel: { strum: 0 } });
    expect(r.patch).toBe('guitarLead');
    expect(r.chain).toEqual([{ type: 'reverb' }]);
    expect(r.feel.strum).toBe(0);                 // overridden
    expect(r.feel.jitterVel).toBe(FEEL_PRESETS['alt-pick'].jitterVel); // preserved from base
  });
  it('throws on an unknown instrument', () => {
    expect(() => resolveInstrument('kazoo')).toThrow(/unknown instrument/);
  });
});

describe('normalize expansion (composition)', () => {
  const comp = (part) => ({ kind: 'beats-composition', title: 't', bpm: 120, parts: [{ name: 'g', events: [['0:0:0', 'C3']], ...part }] });

  it('expands instrument → patch + chain + feel and drops the instrument key', () => {
    const out = normalizeBeatsManifest(comp({ instrument: 'distorted-guitar' }));
    const p = out.parts[0];
    expect(p.instrument).toBeUndefined();
    expect(p.patch).toBe('guitarElectric');
    expect(p.chain).toEqual(INSTRUMENTS['distorted-guitar'].chain);
    expect(p.feel).toEqual(FEEL_PRESETS['palm-mute']);
  });

  it('a part-level feel merges over the instrument feel', () => {
    const out = normalizeBeatsManifest(comp({ instrument: 'electric-guitar', feel: { strum: 0.03 } }));
    expect(out.parts[0].feel.strum).toBe(0.03);
    expect(out.parts[0].feel.jitterVel).toBe(FEEL_PRESETS['alt-pick'].jitterVel);
  });

  it('resolves a bare feel preset name with no instrument', () => {
    const out = normalizeBeatsManifest(comp({ patch: 'guitarClean', feel: 'fingerpick' }));
    expect(out.parts[0].patch).toBe('guitarClean');
    expect(out.parts[0].feel).toEqual(FEEL_PRESETS.fingerpick);
  });

  it('NULL PATH: a plain part gains no feel/instrument keys (byte-identical to pre-B6)', () => {
    const out = normalizeBeatsManifest(comp({ patch: 'sinePluck' }));
    const p = out.parts[0];
    expect(p.patch).toBe('sinePluck');
    expect('feel' in p).toBe(false);
    expect('instrument' in p).toBe(false);
  });

  it('robotic feel resolves away to no feel key', () => {
    const out = normalizeBeatsManifest(comp({ patch: 'guitarClean', feel: 'robotic' }));
    expect('feel' in out.parts[0]).toBe(false);
  });
});

describe('validation', () => {
  const comp = (part) => ({ kind: 'beats-composition', title: 't', bpm: 120, parts: [{ name: 'g', events: [['0:0:0', 'C3']], ...part }] });

  it('accepts a known instrument and feel preset', () => {
    expect(validateBeatsManifest(comp({ instrument: 'lead-guitar', feel: 'alt-pick' })).ok).toBe(true);
  });
  it('teaches on an unknown instrument', () => {
    expect(validateBeatsManifest(comp({ instrument: 'kazoo' })).errors.join(' ')).toMatch(/instrument 'kazoo' is unknown/);
  });
  it('teaches on an unknown feel preset', () => {
    expect(validateBeatsManifest(comp({ patch: 'guitarClean', feel: 'shredly' })).errors.join(' ')).toMatch(/feel 'shredly' is unknown/);
  });
  it('accepts feel on a pattern track', () => {
    const m = { kind: 'beats-pattern', title: 't', bpm: 120, steps: 16, tracks: [{ name: 'g', patch: 'guitarMuted', feel: 'palm-mute', mask: [1, 0, 1, 0], notes: ['A2'] }] };
    expect(validateBeatsManifest(m).ok, validateBeatsManifest(m).errors.join(', ')).toBe(true);
    expect(normalizeBeatsManifest(m).tracks[0].feel).toEqual(FEEL_PRESETS['palm-mute']);
  });

  it('accepts an instrument on a pattern track (B6.1 loose end)', () => {
    const m = { kind: 'beats-pattern', title: 't', bpm: 120, steps: 8, tracks: [{ name: 'g', instrument: 'acoustic-guitar', mask: [1, 0, 1, 0] }] };
    expect(validateBeatsManifest(m).ok, validateBeatsManifest(m).errors.join(', ')).toBe(true);
    const tr = normalizeBeatsManifest(m).tracks[0];
    expect(tr.patch).toBe('guitarClean');
    expect(tr.instrument).toBeUndefined();
    expect(tr.chain).toEqual(INSTRUMENTS['acoustic-guitar'].chain);
  });
});

describe('harmony-bus validation + normalize (B7)', () => {
  const harmony = (extra) => ({
    kind: 'beats-pattern', title: 't', bpm: 120, steps: 32,
    chords: { Fm9: ['F3', 'Ab3', 'C4', 'G4'], Bb: ['Bb3', 'D4', 'F4'] },
    progression: ['Fm9', 'Bb'],
    tracks: [{ name: 'gtr', instrument: 'acoustic-guitar', chordVoice: 'chord', mask: [1, 0, 1, 0] }],
    ...extra,
  });

  it('accepts a valid harmony bus + chordVoice track', () => {
    const r = validateBeatsManifest(harmony());
    expect(r.ok, r.errors.join(', ')).toBe(true);
  });

  it('stretches the progression across the loop (2 chords over 32 steps → 16 each)', () => {
    const out = normalizeBeatsManifest(harmony());
    expect(out.progression).toHaveLength(32);
    expect(out.progression[0]).toBe('Fm9');
    expect(out.progression[15]).toBe('Fm9');
    expect(out.progression[16]).toBe('Bb');
    expect(out.progression[31]).toBe('Bb');
  });

  it('teaches when a progression names an unknown chord', () => {
    expect(validateBeatsManifest(harmony({ progression: ['Fm9', 'Xdim'] })).errors.join(' ')).toMatch(/progression\[1\] 'Xdim' is not a key in chords/);
  });

  it('teaches on a bad chordVoice mode', () => {
    expect(validateBeatsManifest(harmony({ tracks: [{ name: 'g', patch: 'guitarClean', chordVoice: 'shred', mask: [1] }] })).errors.join(' ')).toMatch(/chordVoice must be one of/);
  });

  it('teaches when chordVoice is used without a harmony bus', () => {
    const m = { kind: 'beats-pattern', title: 't', bpm: 120, tracks: [{ name: 'g', patch: 'guitarClean', chordVoice: 'chord', mask: [1] }] };
    expect(validateBeatsManifest(m).errors.join(' ')).toMatch(/needs a harmony bus/);
  });

  it('rejects chordVoice on a foley (gesture) track', () => {
    expect(validateBeatsManifest(harmony({ tracks: [{ name: 'g', gesture: { type: 'burst' }, chordVoice: 'chord', mask: [1] }] })).errors.join(' ')).toMatch(/needs a musical voice/);
  });
});
