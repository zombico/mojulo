// The undead library (lib/graph/undead), on the tiered hero: the skull as bones with a jaw of its own, the bone and
// vertebra helpers, the bared pick, a layer on its own dice, and the lineages that reach the hero door with their form
// and layers (the hero's plan, flesh, skeleton and layers in full: ./tiered.test.js). Cards are chosen in code by the
// pass they exercise.
import { describe, it, expect } from 'vitest';
import { UNDEAD_CARDS, UNDEAD_FORMS, UNDEAD_LAYERS, variantOf } from './index.js';
import { boneLimb, vertebrae, posture } from './passes.js';
import { pickBared } from './bared.js';
import { readLineage } from '../egocube/ancestry.js';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';
import { planFromSheet } from '../egocube/plan.js';
import { rollEgocube } from '../egocube/egocube.js';
import { expandPlan, loftPart, SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import { resolveFoe } from '../foes/resolve.js';
import { FOE_CLASSES } from '../foes/index.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

const seg = (B, n) => B.body.segments.find((s) => s.name === n);
const r = (v) => (Array.isArray(v) ? Math.max(...v) : v);
const skeletonHero = (layers, seed = 3) => heroRecord({ form: 'tiered', cast: 'male', palette: { Skin: '#d6cfbd' }, undead: { form: 'skeleton', build: 'canonical', seed, ...(layers ? { layers } : {}) } });
const skeletonPlan = (layers, seed) => heroPlanOf(skeletonHero(layers, seed));

describe('the skull and the bones', () => {
  it('its skull is bones: a braincase and a face, the arches, the openings, both rows of teeth and a mandible of its own', () => {
    const B = { body: skeletonPlan() }, names = B.body.segments.map((s) => s.name);
    for (const n of ['braincase', 'face', 'zygomaR', 'socketR', 'nasal', 'mandibleR']) expect(names).toContain(n);
    expect(names.filter((n) => /^toothU\dR$/.test(n)).length).toBeGreaterThan(2);
    expect(names.filter((n) => /^toothL\dR$/.test(n)).length).toBeGreaterThan(2);
    // the jaw is separate: the mandible and the lower teeth ride the rig's jaw bone, the rest of the skull its head
    expect(seg(B, 'mandibleR').bind.bone).toBe('jaw');
    expect(seg(B, 'toothL0R').bind.bone).toBe('jaw');
    expect(seg(B, 'toothU0R').bind.bone).toBe('head');
    expect(seg(B, 'braincase').bind.bone).toBe('head');
    // the mandible rises from its condyle, under the cheekbone's back end, down the ramus, to the chin
    const M = seg(B, 'mandibleR').stations.map((st) => st.at), Z = seg(B, 'zygomaR').stations.map((st) => st.at);
    expect(M[0][2]).toBeLessThan(Z.at(-1)[2]);
    const angle = M.reduce((lo, p, i) => (p[1] < M[1][1] + 0.02 && p[2] < M[lo][2] ? i : lo), 0);
    expect(M[0][2] - M[angle][2]).toBeGreaterThan(0.05);
    expect(M.at(-1)[0]).toBe(0);
    // a plate: the jaw's body stands on its edge, taller than it is thick (the loft's `up` frame)
    const ring = Object.values(loftPart(seg(B, 'mandibleR').stations, null, SLOT_FAMILIES.limb6, 2, { up: true }).stations[angle + 2].points);
    const span = (k) => Math.max(...ring.map((p) => p[k])) - Math.min(...ring.map((p) => p[k]));
    expect(span(2)).toBeGreaterThan(2 * span(0));
    // the teeth run back along the arch from the incisors to the molars
    const T = names.filter((n) => /^toothU\dR$/.test(n)).map((n) => B.body.joints[`${n}a`]);
    expect(T[0][1] - T.at(-1)[1]).toBeGreaterThan(0.04);
  });
  it('the rig hinges the jaw at the condyles and points the head at the face', () => {
    // (the skeleton's lineage stands it on the tiered hero: its plan the hero's, its head the skull's)
    const sheet = rollEgocube({ facets: { ancestry: 'skeleton', build: 'canonical', role: 'frontline' }, seed: 2 });
    const plan = heroPlanOf(heroRecord(planFromSheet(sheet).create.spec)), J = plan.rig.joints, cond = plan.segments.find((s) => s.name === 'mandibleR').stations[0].at;
    expect(J.jawHinge.at[2]).toBeCloseTo(cond[2], 3);
    expect(J.headTop.at[1]).toBeGreaterThan(plan.joints.headBase[1]);
    expect((plan.include ?? []).some((x) => x.name === 'head')).toBe(false);
  });
  it('every long bone is a shaft with knobbed ends, its weights the card\'s', () => {
    const [, light] = Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === 'bone' && c.bones.shaft < 1);
    const femur = boneLimb({ name: 'thigh', kind: 'segment', from: 'hip', to: 'knee' }, { k: 1, g: 1 }), thin = boneLimb({ name: 'thigh', kind: 'segment', from: 'hip', to: 'knee' }, { k: 1, g: 1, Bw: light.bones });
    expect(r(femur.rA)).toBeGreaterThan(1.5 * r(femur.rMid));
    expect(r(thin.rMid)).toBeLessThan(r(femur.rMid));
    expect(boneLimb({ name: 'torso' }, { k: 1, g: 1 })).toBeNull();
  });
  it('the vertebrae rise up the column, each its body and its process behind it, on the bone it rides', () => {
    const J = { spine0: [0, -0.05, 0.98], spine1: [0, -0.085, 1.2], spine2: [0, -0.075, 1.42], neckBase: [0, 0.03, 1.63], neckTop: [0, 0.09, 1.77] };
    const V = vertebrae(J, { k: 1, g: 1 }), zs = V.map((v) => v.stations[0].at[2]);
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
    for (const v of V) expect(v.stations.at(-1).at[1]).toBeLessThan(v.stations[0].at[1]);
    expect(V[0].bind.bone).toBe('pelvis');
    expect(V.at(-1).bind.bone).toBe('neck');
  });
});

describe('the picks and the rest', () => {
  it('a bared pick: within its count, each word once, an arm bared once, never a lost forearm', () => {
    const spec = { count: [2, 3], parts: ['arm', 'foreArm', 'ribs', 'shin', 'skull'] };
    for (const sd of [1, 2, 3, 4, 5, 6]) {
      const P = pickBared(spec, mulberry32(sd), { part: 'foreArm', side: 'R' });
      expect(P.length).toBeLessThanOrEqual(3);
      expect(new Set(P.map((x) => x.part)).size).toBe(P.length);
      expect(P.filter((x) => (x.part === 'arm' || x.part === 'foreArm') && x.side === 'R').length).toBeLessThanOrEqual(1);
      expect(P.some((x) => x.part === 'foreArm' && x.side === 'R')).toBe(false);
    }
  });
  it('the rest a card stands in: its hunch, a reaching corpse leading with one arm', () => {
    const [, c] = Object.entries(UNDEAD_CARDS).find(([, x]) => (x.arms?.reach ?? 0) > 0.5);
    const P = posture(c, mulberry32(3));
    expect(P.lean).toBe(c.lean);
    expect(Math.abs(P.arms.R.y - P.arms.L.y)).toBeGreaterThan(0.05);
  });
  it('a layer lies on its own dice: the body under it is the bare form\'s, byte for byte', () => {
    const bare = skeletonPlan(), ragged = skeletonPlan(['shreds']);
    expect(JSON.stringify(ragged.segments.filter((s) => s.group !== 'Cloth'))).toBe(JSON.stringify(bare.segments));
    expect(JSON.stringify(skeletonPlan(['shreds']))).toBe(JSON.stringify(ragged));
  });
  it('a lineage lays its layers over its form, on the hero spec; the ragged, the decayed and the rotting build', () => {
    // (each lineage's layers reach the hero spec in order; the hero plan they make is undead/tiered.test.js's)
    for (const [ancestry, form, layers] of [['ragged', 'skeleton', ['shreds']], ['decayed', 'skeleton', ['decayed', 'shreds']], ['rotting', 'zombie', ['bared']]]) {
      const sheet = rollEgocube({ facets: { ancestry, build: 'canonical', role: 'frontline' }, seed: 3 });
      expect(sheet.ancestry).toMatchObject({ door: 'hero', form, layers });
      const spec = planFromSheet(sheet).create.spec;
      expect(spec.undead).toMatchObject({ form, layers });
      expect(() => expandPlan(heroPlanOf(heroRecord(spec)))).not.toThrow();
    }
    const lin = { reads: 'x', humanity: [0, 0.1], cover: { a: '#aaaaaa' }, cues: [{ at: 1, ch: 'frame', line: 'x' }] };
    expect(() => readLineage('x', { ...lin, form: 'skeleton', layers: Object.keys(UNDEAD_LAYERS) })).not.toThrow();
    expect(() => readLineage('x', { ...lin, form: 'skeleton', layers: ['glitter'] })).toThrow(/unknown layer/);
    expect(() => readLineage('x', { ...lin, layers: ['shreds'] })).toThrow(/give form too/);
    expect(() => readLineage('x', { ...lin, form: 'mummy' })).toThrow(/unknown form/);
  });
});

describe('the lineages and the bestiary', () => {
  it('every undead lineage reaches the hero door with its form, its variation by the build', () => {
    // (the forms and their layers stand on the tiered body: undead/tiered.test.js)
    for (const ancestry of [...Object.keys(UNDEAD_FORMS), 'ragged', 'rotting']) {
      const sheet = rollEgocube({ facets: { ancestry, build: 'brute', role: 'frontline' }, seed: 3 });
      expect(sheet.ancestry.door).toBe('hero');
      const P = planFromSheet(sheet);
      expect(P.create.as).toBe('hero');
      expect(JSON.stringify(planFromSheet(rollEgocube({ facets: { ancestry, build: 'brute', role: 'frontline' }, seed: 3 })).create)).toBe(JSON.stringify(P.create));
    }
    expect(variantOf('skeleton', 'brute')).toBe(Object.keys(UNDEAD_CARDS).find((id) => UNDEAD_CARDS[id].form === 'bone' && UNDEAD_CARDS[id].build === 'brute'));
    expect(() => variantOf('mummy', 'brute')).toThrow(/no form 'mummy'/);
  });
  it('a bestiary stands one as a people', () => {
    const c = Object.values(FOE_CLASSES).find((x) => x.attack.kind === 'strike' && (x.fits.support ?? []).includes('two'));
    expect(resolveFoe({ class: c.id, skin: { people: 'skeleton', facets: { build: 'brute' } } }).skin).toEqual({ people: 'skeleton', facets: { build: 'brute' } });
  });
});
