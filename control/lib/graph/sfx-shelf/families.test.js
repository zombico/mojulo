import { describe, it, expect } from 'vitest';
import { FAMILIES, FAMILY_NAMES, familyDials, familyCue } from './families.js';
import { SOUNDS, SOUND_IDS } from './roster.js';
import { sfxSound } from './resolve.js';
import { validateBeatsManifest } from '../beats/beats-manifest.js';

// the concept, one family at a time: a family is its dials and a pure build over them
describe('the families', () => {
  it('each family says its dials, its defaults among them, and orders only its own dials', () => {
    for (const name of FAMILY_NAMES) {
      const F = FAMILIES[name];
      expect(typeof F.label).toBe('string');
      for (const [k, v] of Object.entries(F.defaults)) expect(F.dials[k], `${name}.${k}`).toContain(v);
      for (const o of F.ordered) {
        expect(F.dials[o.dial], `${name} orders ${o.dial}`).toBeDefined();
        for (const v of o.values ?? []) expect(F.dials[o.dial]).toContain(v);
      }
    }
  });

  it('a dial a family has not, or a value a dial has not, throws naming what it takes', () => {
    const name = FAMILY_NAMES[0], dial = Object.keys(FAMILIES[name].dials)[0];
    expect(() => familyDials(name, { nope: 1 })).toThrow(/its dials/);
    expect(() => familyDials(name, { [dial]: 'nope' })).toThrow(/is one of/);
    expect(() => familyCue('no-such-family')).toThrow(/one of/);
  });

  it('a build is pure: the same dials the same cue, frozen; another dial point another cue, and other grain seeds', () => {
    for (const name of FAMILY_NAMES) {
      const F = FAMILIES[name], dial = Object.keys(F.dials)[0], [a, b] = F.dials[dial];
      expect(familyCue(name, { [dial]: a })).toEqual(familyCue(name, { [dial]: a }));
      expect(Object.isFrozen(F.sustain ? familyCue(name).layers[0] : familyCue(name)[0])).toBe(true);
      if (b !== undefined) expect(familyCue(name, { [dial]: a }), `${name}.${dial}`).not.toEqual(familyCue(name, { [dial]: b }));
    }
    const seeds = (c) => c.filter((g) => g.type === 'grain').map((g) => g.seed);
    expect(seeds(familyCue('impact', { material: 'metal' }))).not.toEqual(seeds(familyCue('impact', { material: 'stone' })));
  });

  it('every family\'s defaults are a beats-sfx cue, or a held voice, the beats tools take as it is', () => {
    for (const name of FAMILY_NAMES) {
      const m = FAMILIES[name].sustain ? { sustains: { h: familyCue(name) } } : { cues: { c: familyCue(name) } };
      expect(validateBeatsManifest({ kind: 'beats-sfx', title: name, ...m }), name).toEqual({ ok: true, errors: [] });
    }
  });

  it('a row a family builds resolves to that build; a caller\'s dials turn it further', () => {
    const id = SOUND_IDS.find((i) => SOUNDS[i].make && !FAMILIES[SOUNDS[i].make.family].sustain && Object.keys(SOUNDS[i].make.dials).length);
    const { family, dials } = SOUNDS[id].make, other = Object.keys(FAMILIES[family].dials).find((k) => !(k in dials));
    expect(sfxSound(id)).toEqual({ id, style: 'realistic', from: `family:${family}`, gestures: familyCue(family, dials) });
    if (other) {
      const v = FAMILIES[family].dials[other].at(-1);
      expect(sfxSound(id, { dials: { [other]: v } }).gestures).toEqual(familyCue(family, { ...dials, [other]: v }));
    }
    expect(() => sfxSound(id, { dials: { nope: 1 } })).toThrow(/its dials/);
  });
});
