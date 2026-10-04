// station-loft-clearance.test.js — worn things stay OUT of the body at every dial extreme. The clearance ledger measures
// it; `follow` pins (compileLayered) are the fix: a worn part moves with the dials as the surface under its pin does.
import { describe, it, expect } from 'vitest';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';
import { layeredClearance } from './station-loft-clearance.js';
import { fitEvidence } from './humanoid-head-fit.js';

const dressed = expandPlan(humanoidPlan({ preset: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger' }));
/** the same recipe with every `follow` removed: the dress rides its pin frames rigidly (the behaviour before follow) */
const rigid = (r) => ({ ...r, parts: Object.fromEntries(Object.entries(r.parts).map(([k, p]) => { const { follow, ...rest } = p; return [k, rest]; })) });

describe('follow pins', () => {
  it('without follow nothing changes: a recipe with no follower compiles byte for byte the same at every dial extreme', () => {
    const plain = expandPlan(humanoidPlan({ preset: 'female', register: 'lowpoly', hair: 'ponytail' }));
    expect(Object.values(plain.parts).some((p) => p.follow)).toBe(false);
    for (const [k, d] of Object.entries(plain.dials)) for (const v of [d.min, d.max]) {
      const a = compileLayered(plain, { [k]: v }), b = compileLayered({ ...plain, parts: { ...plain.parts } }, { [k]: v });
      expect(JSON.stringify(a.vertices)).toBe(JSON.stringify(b.vertices));
    }
  });
  it('at rest a follower sits exactly where the rigid pin put it; under a dial it moves with the surface', () => {
    const f = compileLayered(dressed), r = compileLayered(rigid(dressed));
    expect(JSON.stringify(f.vertices)).toBe(JSON.stringify(r.vertices));
    const fb = compileLayered(dressed, { bulk: 1.4 }).parts['adorn.baldric'].points, rb = compileLayered(rigid(dressed), { bulk: 1.4 }).parts['adorn.baldric'].points;
    const width = (P) => { const xs = Object.values(P).map((p) => p[0]); return Math.max(...xs) - Math.min(...xs); };
    expect(width(fb)).toBeGreaterThan(width(rb) * 1.1);   // the baldric widens with the chest
  });
  it('a follower turns with a hinge that turns its parent', () => {
    const a = compileLayered(dressed, { lean: 25 }); const toggle = a.parts['stud.torso.2'].points; const torsoTop = a.parts.torso.points['torso/st3.front'];
    const b = compileLayered(dressed, {}); const d0 = Object.values(b.parts['stud.torso.2'].points)[0], d1 = Object.values(toggle)[0];
    expect(Math.hypot(...d1.map((x, i) => x - d0[i]))).toBeGreaterThan(0.01); expect(torsoTop).toBeTruthy();
  });
  it("a follower needs a layer-1 parent, and says so", () => {
    const r = JSON.parse(JSON.stringify(dressed)); const [name] = Object.entries(r.parts).find(([, p]) => p.layer === 2 && p.pin.parent === 'cranium'); r.parts[name].follow = true;
    r.parts[name].pin = { ...r.parts[name].pin, parent: 'eyeR' };
    expect(() => compileLayered(r)).toThrow(/follow needs a layer-1 parent/);
  });
});

describe('the clearance ledger', () => {
  it('names the sinking the rigid dress had: at bulk 1.4 the baldric, the belt and the bracer sink into the body', () => {
    const C = layeredClearance(rigid(dressed));
    expect(C.sinking).toEqual(expect.arrayContaining(['baldric', 'belt', 'bracer']));
    expect(C.adornments.baldric.worst).toMatchObject({ dial: 'bulk', value: 1.4 }); expect(C.adornments.baldric.worst.share).toBeGreaterThan(0.4);
    expect(C.adornments.baldric.worst.into[0]).toBe('torso');
  });
  it('with follow the dress clears every bulk extreme; the one limit left is named (the belt over the hips)', () => {
    const C = layeredClearance(dressed);
    for (const id of ['baldric', 'bracer', 'pauldron']) expect(C.adornments[id].worst.share, id).toBeLessThanOrEqual(0.02);
    // on the structured core (DEFAULT_CORE) the belt's worst is `bulk` at its narrow end, over the pelvis: the dial narrows
    // the torso and its hem, not the pelvis under them (a dial blends by station across all its parts). Before it, the
    // worst was `stance` 1.35 into the thighs, still the streamlined core's
    expect(C.sinking).toEqual(['belt']); expect(C.adornments.belt.worst).toMatchObject({ dial: 'bulk', value: 0.8 }); expect(C.adornments.belt.worst.into).toContain('pelvis');
    const old = layeredClearance(expandPlan(humanoidPlan({ preset: 'male', register: 'round', hair: 'crop', detail: 'clothed', adorn: 'ranger', core: 'streamlined' })));
    expect(old.adornments.belt.worst).toMatchObject({ dial: 'stance', value: 1.35, into: ['thighL', 'thighR'] });
    expect(C.configs).toBe(1 + 2 * Object.values(dressed.dials).length);
  });
});

describe('evidence', () => {
  it('the fits say what they saw: the female three views, the male two and an inferred front', () => {
    expect(fitEvidence('female')).toEqual({ observed: [{ view: 'front', yawDegrees: 0 }, { view: 'three-quarter', yawDegrees: 40 }, { view: 'profile', yawDegrees: 74 }], inferred: [] });
    const m = fitEvidence('male'); expect(m.inferred).toEqual(['front']); expect(m.observed).toEqual([{ view: 'three-quarter', yawDegrees: 33 }, { view: 'profile', yawDegrees: 71 }]);
  });
});
