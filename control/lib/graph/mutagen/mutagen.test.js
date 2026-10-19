import { describe, it, expect } from 'vitest';
import { OOZES, oozeErrors, normalizeOozes, composeForm, resolveMutagen, oozeParams, mutagenErrors, FORM_KEYS } from './index.js';
import { speciesParams, speciesPlan } from '../fauna/species.js';
import { buildFauna } from '../fauna/build.js';
import { PER_RIG } from '../fauna/test-cases.js';

// The law, read on rows the test makes (the shelf's numbers are the oozes', not the law's), and the form read on one
// species per rig: the concept, not the catalog.
const SHELF = { big: { id: 'big', form: { scale: 2, bulk: 1.5 } }, wide: { id: 'wide', form: { bulk: 2, legBulk: 1.2 } } };
const formOn = Object.keys(OOZES).find((id) => OOZES[id].form?.scale);   // one form ooze that grows the animal

describe('mutagen: the composition law', () => {
  it('form multiplies, each ooze raised to its strength, and order does not matter', () => {
    expect(composeForm([{ id: 'big', strength: 1 }, { id: 'wide', strength: 1 }], SHELF)).toEqual({ scale: 2, bulk: 2.5, legBulk: 1.2 });
    expect(composeForm([{ id: 'wide', strength: 1 }, { id: 'big', strength: 1 }], SHELF)).toEqual(composeForm([{ id: 'big', strength: 1 }, { id: 'wide', strength: 1 }], SHELF));
    const half = composeForm([{ id: 'big', strength: 0.5 }], SHELF);
    expect(half.scale).toBeCloseTo(Math.SQRT2, 12);
    expect(half.scale * half.scale).toBeCloseTo(2, 12);   // two half strengths meet one full
  });

  it('strength is monotone from identity', () => {
    const at = (s) => composeForm([{ id: 'big', strength: s }], SHELF).scale ?? 1;
    expect(at(0)).toBe(1);
    expect(at(0.25)).toBeLessThan(at(0.5));
    expect(at(0.5)).toBeLessThan(at(1));
  });

  it('clamps the product: growth within [0.5, 3], girth within [0.3, 2.5]', () => {
    const f = composeForm([{ id: 'big', strength: 1 }, { id: 'wide', strength: 1 }, { id: 'huge', strength: 1 }], { ...SHELF, huge: { form: { scale: 4, bulk: 4 } } });
    expect(f.scale).toBe(3);
    expect(f.bulk).toBe(2.5);
  });

  it('normalizes a word, an entry and a list, dropping the oozes at strength 0', () => {
    expect(normalizeOozes(formOn)).toEqual([{ id: formOn, strength: 1 }]);
    expect(normalizeOozes([{ id: formOn, strength: 0.4 }])).toEqual([{ id: formOn, strength: 0.4 }]);
    expect(normalizeOozes([{ id: formOn, strength: 0 }])).toEqual([]);
    expect(normalizeOozes(undefined)).toEqual([]);
  });

  it('refuses what it cannot read, naming what would work', () => {
    expect(oozeErrors('ectoplasm')[0]).toMatch(/unknown ooze .*the oozes:/);
    expect(oozeErrors([{ id: formOn, gem: 'ruby' }])[0]).toMatch(/takes id, strength \(not gem\)/);
    expect(oozeErrors([formOn, formOn])[0]).toMatch(/named twice/);
    expect(oozeErrors({ id: formOn, strength: 1.5 })[0]).toMatch(/\[0, 1\]/);
    expect(oozeErrors(7)[0]).toMatch(/a word/);
    expect(mutagenErrors(undefined, 3)[0]).toMatch(/pass it with `ooze`/);
    expect(mutagenErrors(formOn, -1)[0]).toMatch(/non-negative integer/);
    expect(oozeErrors(undefined)).toEqual([]);
  });

  it('nothing acts ⇒ null; the seed defaults from what the creature is made of, and is kept when given', () => {
    expect(resolveMutagen(undefined)).toBeNull();
    expect(resolveMutagen([])).toBeNull();
    expect(resolveMutagen({ id: formOn, strength: 0 })).toBeNull();
    const a = resolveMutagen(formOn, { key: 'wolf' }), b = resolveMutagen(formOn, { key: 'wolf' }), c = resolveMutagen(formOn, { key: 'houseCat' });
    expect(a.seed).toBe(b.seed);
    expect(a.seed).not.toBe(c.seed);
    expect(resolveMutagen(formOn, { key: 'wolf', seed: 9 }).seed).toBe(9);
  });

  it('every row on the shelf is filed under its id and names only form keys', () => {
    for (const [id, o] of Object.entries(OOZES)) {
      expect(o.id, id).toBe(id);
      for (const k of Object.keys(o.form || {})) expect(FORM_KEYS, `${id}.${k}`).toContain(k);
    }
  });
});

describe('mutagen: the form on a species', () => {
  it('absent ⇒ the species params as given, and its plan byte-identical', () => {
    const P = speciesParams(PER_RIG[0]);
    expect(oozeParams(P, null)).toBe(P);
    expect(oozeParams(P, resolveMutagen([]))).toBe(P);
    expect(JSON.stringify(buildFauna(oozeParams(P, null)))).toBe(JSON.stringify(speciesPlan(PER_RIG[0])));
  });

  // the joint law: a form moves a joint only by its uniform scale. The throat's two joints are the head's underside
  // and follow the head, which `headScale` grows about its nape.
  it('the joint law: every joint of the oozed plan is the species joint grown by the form scale, the same joints', () => {
    for (const id of PER_RIG) {
      const P = speciesParams(id), M = resolveMutagen(formOn, { key: id }), s = M.form.scale;
      const A = buildFauna(P).joints, B = buildFauna(oozeParams(P, M)).joints;
      expect(Object.keys(B), id).toEqual(Object.keys(A));
      for (const [j, v] of Object.entries(A)) {
        if (j.startsWith('throat')) continue;
        v.forEach((x, a) => expect(Math.abs(B[j][a] - s * x), `${id}.${j}`).toBeLessThan(1e-5));
      }
    }
  });

  it('girth is ring radius alone: a girth-only form leaves every joint where it was', () => {
    const id = PER_RIG[0], P = speciesParams(id);
    const M = { form: composeForm([{ id: 'wide', strength: 1 }], SHELF) };
    expect(buildFauna(oozeParams(P, M)).joints).toEqual(buildFauna(P).joints);
    const r = (p) => p.segments.find((g) => g.name === 'torso').stations.map((st) => st.r);
    const [a, b] = [r(buildFauna(P)), r(buildFauna(oozeParams(P, M)))];
    expect(JSON.stringify(b)).not.toBe(JSON.stringify(a));
  });

  it('is deterministic', () => {
    const id = PER_RIG[0], P = speciesParams(id);
    expect(JSON.stringify(buildFauna(oozeParams(P, resolveMutagen(formOn, { key: id })))))
      .toBe(JSON.stringify(buildFauna(oozeParams(speciesParams(id), resolveMutagen(formOn, { key: id })))));
  });
});
