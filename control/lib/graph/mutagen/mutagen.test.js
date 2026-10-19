import { describe, it, expect } from 'vitest';
import { OOZES, oozeErrors, normalizeOozes, composeForm, composePush, pushErrors, resolveMutagen, oozeParams, oozeFauna, mutagenErrors, FORM_KEYS } from './index.js';
import { SPECIES, speciesParams, speciesPlan } from '../fauna/species.js';
import { buildFauna } from '../fauna/build.js';
import { PER_RIG } from '../fauna/test-cases.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';

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
    const a = resolveMutagen(formOn, { key: 'wolf' }), b = resolveMutagen([formOn, { id: formOn === 'dire' ? Object.keys(OOZES).find((o) => o !== formOn) : 'dire' }], { key: 'wolf' }), c = resolveMutagen(formOn, { key: 'houseCat' });
    expect(a.seed).toBe(b.seed);   // the base's seed: adding an ooze does not reroll it
    expect(a.seed).not.toBe(c.seed);
    expect(resolveMutagen(formOn, { key: 'wolf', seed: 9 }).seed).toBe(9);
  });

  it('every row on the shelf is filed under its id and names only form keys and pushes', () => {
    for (const [id, o] of Object.entries(OOZES)) {
      expect(o.id, id).toBe(id);
      for (const k of Object.keys(o.form || {})) expect(FORM_KEYS, `${id}.${k}`).toContain(k);
      expect(pushErrors(o.push, id)).toEqual([]);
    }
    expect(pushErrors({ wedge: { fore: 1.2 }, horns: 2 })[0]).toMatch(/horns: not a push/);
  });

  it('pushes compose: multipliers multiply raised to strength, additions scale, darkening compounds, words are the last ooze\'s', () => {
    const S = { a: { push: { neck: 2, ears: { sweep: 0.4 }, coat: 0.5, hackles: { count: 5, height: 0.6 }, eyes: { color: '#ff0000', glow: true } } },
      b: { push: { neck: 1.5, coat: 0.5, hackles: { count: 3 }, eyes: { color: '#00ff00' } } } };
    const p = composePush([{ id: 'a', strength: 1 }, { id: 'b', strength: 1 }], S);
    expect(p.neck).toBe(3);
    expect(p.coat).toBe(0.75);
    expect(p.hackles).toEqual({ count: 3, height: 0.6 });
    expect(p.eyes).toEqual({ color: '#00ff00', glow: true, mix: 1 });
    const half = composePush([{ id: 'a', strength: 0.25 }], S);
    expect(half.ears.sweep).toBeCloseTo(0.1, 12);
    expect(half.eyes.glow).toBe(false);   // a glow is lit from half strength
    expect(composePush([{ id: 'x', strength: 1 }], { x: { form: { scale: 2 } } })).toBeNull();
  });

  it('tints and marks stack in list order; a spike is the tallest asked; marks wait for strength 0.35', () => {
    const mark = { on: 'torso', kind: 'spots', group: 'G' };
    const S = { a: { push: { tint: { color: '#ff0000', amount: 1 }, marks: [mark], hackles: { height: 0.6 } } },
      b: { push: { tint: { color: '#0000ff', amount: 0.5, light: 1 }, marks: [mark], hackles: { height: 0.4 } } } };
    const p = composePush([{ id: 'a', strength: 1 }, { id: 'b', strength: 1 }], S, 7);
    expect(p.tints.map((t) => t.color)).toEqual(['#ff0000', '#0000ff']);
    expect(p.tints[1]).toEqual({ color: '#0000ff', amount: 0.5, light: 1 });
    expect(p.marks).toHaveLength(2);
    expect(p.hackles.height).toBe(0.6);
    expect(composePush([{ id: 'a', strength: 0.3 }], S, 7).marks).toBeUndefined();
    // each mark's dice are its own ooze's: adding another ooze leaves them where they were
    expect(composePush([{ id: 'a', strength: 1 }], S, 7).marks[0].seed).toBe(p.marks[0].seed);
    expect(composePush([{ id: 'a', strength: 1 }], S, 8).marks[0].seed).not.toBe(p.marks[0].seed);
  });

  it('refuses a push it cannot read: a stray tint, a mark without its kind, a material that is not a name', () => {
    expect(pushErrors({ tint: { color: 'red', amount: 1 } })[0]).toMatch(/tint/);
    expect(pushErrors({ marks: [{ on: 'torso', group: 'G' }] })[0]).toMatch(/marks\[0\]/);
    expect(pushErrors({ surfaces: { '*': { metal: 'steel' } } })[0]).toMatch(/material name/);
  });
});

describe('mutagen: the form on a species', () => {
  it('absent ⇒ the species params as given, and its plan byte-identical', () => {
    const P = speciesParams(PER_RIG[0]);
    expect(oozeParams(P, null)).toBe(P);
    expect(oozeParams(P, resolveMutagen([]))).toBe(P);
    expect(JSON.stringify(oozeFauna(P, null))).toBe(JSON.stringify(speciesPlan(PER_RIG[0])));
  });

  // the joint law: an ooze moves a species joint only by its uniform scale. The throat's two joints are the head's
  // underside and follow the head; the ornaments an ooze adds stand on joints of their own (`ooze…`).
  it('the joint law: every species joint of the oozed plan is grown by the form scale, the ornaments on their own joints', () => {
    for (const id of PER_RIG) {
      const P = speciesParams(id), M = resolveMutagen(formOn, { key: id }), s = M.form.scale;
      const A = buildFauna(P).joints, B = oozeFauna(P, M).joints;
      expect(Object.keys(B).filter((j) => !(j in A)).every((j) => j.startsWith('ooze')), id).toBe(true);
      for (const [j, v] of Object.entries(A)) {
        expect(B[j], `${id}.${j}`).toBeDefined();
        if (j.startsWith('throat')) continue;
        v.forEach((x, a) => expect(Math.abs(B[j][a] - s * x), `${id}.${j}`).toBeLessThan(1e-5));
      }
    }
  });

  it('marks paint the parts they name, on finer rings there only, placed by the seed', () => {
    const id = PER_RIG[0], P = speciesParams(id), spots = { on: 'torso', kind: 'spots', count: 6, group: 'Mark', color: '#ff00ff', glow: true };
    const at = (seed) => oozeFauna(P, { form: {}, push: composePush([{ id: 'm', strength: 1 }], { m: { push: { marks: [spots] } } }, seed) });
    const A = at(1), B = at(2), paint = (p) => p.paint.filter((x) => x.group === 'Mark');
    expect(paint(A)).toHaveLength(6);
    expect(A.palette.Mark).toBe('#ff00ff');
    expect(A.emissive).toContain('Mark');
    expect(JSON.stringify(paint(A))).not.toBe(JSON.stringify(paint(B)));   // the seed moves the spots
    expect(A.joints).toEqual(buildFauna(P).joints);                       // and moves no joint
    const legs = (p) => p.segments.filter((g) => /R$/.test(g.name)).map((g) => JSON.stringify(g));
    expect(legs(A)).toEqual(legs(buildFauna(P)));                         // a leg nobody marked keeps its rings
  });

  it('a mark aimed at legs on a legless body paints nothing there, and the body still builds', () => {
    const id = Object.keys(SPECIES).find((s) => !(speciesParams(s).legs || []).length), P = speciesParams(id);
    const M = { form: {}, push: { marks: [{ on: 'legs', kind: 'band', group: 'Ring' }, { on: ['legs', 'neck'], kind: 'band', group: 'Ring2' }] } };
    expect(oozeParams(P, M).markings.map((m) => m.on)).toEqual(['neck']);
    expect(() => expandPlan(oozeFauna(P, M))).not.toThrow();
  });

  it('surfaces reach the recipe as a statue\'s do; a material off the shelf is refused', () => {
    const P = speciesParams(PER_RIG[0]), M = { form: {}, push: { surfaces: { '*': 'gunmetal' } } };
    expect(expandPlan(oozeFauna(P, M)).surfaces).toEqual({ '*': 'gunmetal' });
    expect(expandPlan(buildFauna(P)).surfaces).toBeUndefined();
    expect(() => expandPlan({ ...buildFauna(P), surfaces: { '*': 'unobtainium' } })).toThrow(/surfaces\.\*: unknown material/);
  });

  it('a worn head mesh grows with the animal and keeps pace with the chest', () => {
    const id = Object.keys(SPECIES).find((s) => speciesParams(s).headMesh), P = speciesParams(id);
    const big = { form: composeForm([{ id: 'big', strength: 1 }], SHELF) };
    expect(oozeParams(P, big).headMesh.length).toBeCloseTo(P.headMesh.length * 2, 9);
    const paced = oozeParams(P, { form: {}, push: { wedge: { fore: 1.44 }, head: { pace: 0.5 } } });
    expect(paced.headMesh.length).toBeCloseTo(P.headMesh.length * 1.2, 9);
  });

  it('the face seats or steps back, and says how much of it was drawn', () => {
    const id = PER_RIG[0], r = {};
    oozeFauna(speciesParams(id), resolveMutagen(formOn, { key: id }), r);
    expect([1, 0.75, 0.5, 0.25, 0]).toContain(r.face);
  });

  it('fangs only on a toothed head: a beak takes none', () => {
    const teeth = (p) => (p.heads[0].plan.ornaments || []).filter((o) => o.kind === 'teeth' && /^fang/.test(o.tag || '')).length;
    const bird = Object.keys(SPECIES).find((id) => SPECIES[id].family === 'avian');
    const M = { form: {}, push: { fangs: 2 } };
    expect(teeth(oozeFauna(speciesParams(PER_RIG[0]), M))).toBe(2);
    expect(teeth(oozeFauna(speciesParams(bird), M))).toBe(0);
  });

  it('a grown head carries its eyes and ears: head detail scales with the growth', () => {
    const id = PER_RIG[0], P = speciesParams(id), M = { form: composeForm([{ id: 'big', strength: 1 }], SHELF) };
    const eye = (p) => p.heads[0].plan.regions.eye.R;
    expect(eye(oozeFauna(P, M)) / eye(buildFauna(P))).toBeCloseTo(P.headRelative ? 1 : 2, 6);
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
    expect(JSON.stringify(oozeFauna(P, resolveMutagen(formOn, { key: id }))))
      .toBe(JSON.stringify(oozeFauna(speciesParams(id), resolveMutagen(formOn, { key: id }))));
  });
});
