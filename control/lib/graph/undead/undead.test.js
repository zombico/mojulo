// The undead forms (lib/graph/undead): each pass does what its word says and nothing else, on the creature biped. A
// skeleton is its frame (a spine, curved ribs, hip blades, knobbed bones); a zombie's flesh is drawn in or swollen, one
// arm can be heavy, a seeded loss takes a part from the skin and leaves the rig whole; the arms are built where the
// rest holds them. The lineages reach the creature door with their form, and a bestiary people stands on one. Cards are
// chosen in code by the pass they exercise.
import { describe, it, expect } from 'vitest';
import { UNDEAD_CARDS, UNDEAD_FORMS, UNDEAD_LAYERS, variantOf, undeadBody } from './index.js';
import { readLineage } from '../egocube/ancestry.js';
import { biped, MASS } from '../egocube/plan.js';
import { planFromSheet } from '../egocube/plan.js';
import { rollEgocube } from '../egocube/egocube.js';
import { validatePlan, expandPlan, loftPart, SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import { resolveFoe } from '../foes/resolve.js';
import { FOE_CLASSES } from '../foes/index.js';

const M = MASS.pole.male, base = { k: 0.95, g: 1, chest: M.chest, hips: M.hips, biped };
const cardBy = (form, pred) => Object.entries(UNDEAD_CARDS).find(([, c]) => c.form === form && pred(c));
const formOf = (id) => Object.keys(UNDEAD_FORMS).find((f) => UNDEAD_FORMS[f].variants.includes(id));
const body = (id, seed = 1) => undeadBody(formOf(id), { ...base, build: UNDEAD_CARDS[id].build, seed });
const seg = (B, n) => B.body.segments.find((s) => s.name === n);
const r = (v) => (Array.isArray(v) ? Math.max(...v) : v);
const living = biped({ k: base.k, g: 1, legs: 'plantigrade', fingers: 4 });

describe('a skeleton is its frame', () => {
  const [id] = cardBy('bone', () => true);
  it('a spine, curved ribs, a breastbone, hip blades and an arch; no fleshed trunk', () => {
    const B = body(id), names = B.body.segments.map((s) => s.name);
    for (const n of ['spineLow', 'torso', 'spineHigh', 'sternum', 'iliumR', 'pubisR', 'clavR']) expect(names).toContain(n);
    expect(names.filter((n) => /^rib\dR$/.test(n)).length).toBeGreaterThanOrEqual(5);
    expect(seg(B, 'torso').kind).toBe('segment');
    expect(seg(B, 'rib0R').kind).toBe('loft');
    // the pelvis stays out of the lean; the ribs hinge with it
    expect(B.frameParts).toContain('rib0L');
    expect(B.frameParts).not.toContain('iliumR');
    // the spine is segmented: vertebrae up the column from the sacrum to the skull, each broader than the core it rides
    // and drawn back to its process; the lowest ride the pelvis, the neck's the neck, the rest the torso
    const V = B.body.segments.filter((s) => /^(lumbar|thoracic|cervical)\d+$/.test(s.name));
    for (const run of ['lumbar', 'thoracic', 'cervical']) expect(V.filter((s) => s.name.startsWith(run)).length).toBeGreaterThan(3);
    const zs = V.map((s) => s.stations[0].at[2]);
    expect(zs).toEqual([...zs].sort((a, b) => a - b));
    expect(V[0].stations[1].r[0]).toBeGreaterThan(1.4 * seg(B, 'spineLow').rA);
    for (const v of V) expect(v.stations.at(-1).at[1]).toBeLessThan(v.stations[0].at[1]);
    expect(V[0].bind.bone).toBe('pelvis');
    expect(V.at(-1).bind.bone).toBe('neck');
    expect(B.frameParts).toContain('thoracic5');
    // the neck a skeleton's: shorter than the living biped's, the skull low on it
    const living = biped({ k: 1, g: 1, legs: 'plantigrade', fingers: 4 }).joints, len = (J) => Math.hypot(...J.neckTop.map((v, i) => v - J.neckBase[i]));
    expect(len(B.body.joints) / B.body.joints.neckBase[2]).toBeLessThan(0.7 * len(living) / living.neckBase[2]);
  });
  it('its skull is bones: a braincase and a face, the arches, the openings, both rows of teeth and a mandible of its own', () => {
    const B = body(id), names = B.body.segments.map((s) => s.name);
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
    expect(B.head).toBeNull();
  });
  it('the rig hinges the jaw at the condyles and points the head at the face', () => {
    const sheet = rollEgocube({ facets: { ancestry: 'skeleton', build: 'canonical', role: 'frontline' }, seed: 2 });
    const plan = planFromSheet(sheet).create.spec.plan, J = plan.rig.joints, cond = plan.segments.find((s) => s.name === 'mandibleR').stations[0].at;
    expect(J.jawHinge.at[2]).toBeCloseTo(cond[2], 3);
    expect(J.headTop.at[1]).toBeGreaterThan(plan.joints.neckTop[1]);
    expect(plan.heads).toEqual([]);
  });
  it('every long bone is a shaft with knobbed ends', () => {
    const B = body(id), femur = seg(B, 'thighR');
    expect(r(femur.rA)).toBeGreaterThan(r(femur.rMid) * 1.4);
    expect(r(femur.rMid)).toBeLessThan(r(living.segments.find((s) => s.name === 'thighR').rMid) * 0.5);
  });
});

describe('a zombie\'s flesh', () => {
  it('wasted: its limbs drawn in, its trunk too', () => {
    const [id, c] = cardBy('flesh', (x) => x.waste.limbs < 0.7 && !x.heavy);
    const B = body(id), shin = seg(B, 'shinR'), shin0 = living.segments.find((s) => s.name === 'shinR');
    expect(r(shin.rMid)).toBeCloseTo(r(shin0.rMid) * c.waste.limbs, 2);
    expect(r(seg(B, 'torso').stations[2].r)).toBeLessThan(r(living.segments.find((s) => s.name === 'torso').stations[2].r));
  });
  it('bloated: the trunk swells while the limbs do not', () => {
    const [id] = cardBy('flesh', (x) => !!x.bloat);
    const B = body(id);
    expect(r(seg(B, 'torso').stations[2].r)).toBeGreaterThan(r(living.segments.find((s) => s.name === 'torso').stations[2].r));
  });
  it('heavy: one arm swollen, the other withered, each authored on its own side', () => {
    const [id, c] = cardBy('flesh', (x) => !!x.heavy);
    const B = body(id), S = c.heavy.side, O = S === 'R' ? 'L' : 'R';
    expect(r(seg(B, `upperArm${S}`).rA)).toBeGreaterThan(r(seg(B, `upperArm${O}`).rA) * 2);
    expect(seg(B, 'upperArmR').mirror).toBeUndefined();
  });
});

describe('a loss and the rest', () => {
  it('a seeded loss takes a part from one side\'s skin; the plan still builds with the rig whole', () => {
    const [id, c] = cardBy('flesh', (x) => x.loss?.parts.includes('foreArm'));
    let seed = 1, B; for (; seed < 200; seed++) { B = body(id, seed); if (B.lost) break; }
    expect(B.lost).toBeTruthy();
    const side = B.lost.side, names = B.body.segments.map((s) => s.name);
    expect(names).not.toContain(`hand${side}`);
    expect(names).toContain(`hand${side === 'R' ? 'L' : 'R'}`);
    expect(c.loss.parts).toContain(B.lost.part);
    // (and never without a draw: the same seed loses the same part)
    expect(body(id, seed).lost).toEqual(B.lost);
  });
  it('the arms are built where the rest holds them: the arm\'s built direction is the rest\'s, turned by the lean', () => {
    const [id] = cardBy('flesh', (x) => (x.arms?.reach ?? 0) > 0.5);
    const B = body(id), J = B.body.joints, d = J.knuckles.map((x, i) => x - J.shoulder[i]), n = Math.hypot(...d);
    // forward: the reaching arm is built out before the body (y), not hanging
    expect(d[1] / n).toBeGreaterThan(0.5);
    expect(B.posture.arms.R.y).toBeGreaterThan(0.3);
  });
});

describe('the layers', () => {
  // (the card that wears every band of rags: chest, back, hips and arms)
  const [ragId] = cardBy('bone', (c) => c.shreds && c.shreds.chest && c.shreds.back && c.shreds.hips && c.shreds.arms);
  const dressed = (layers, seed = 1) => undeadBody('skeleton', { ...base, build: UNDEAD_CARDS[ragId].build, seed, layers });
  it('shreds: torn cloth hung from the shoulders, the hips and the arms, ribbons falling clear of the frame', () => {
    // (the odds are seeded: a seed that leaves every band something)
    const BANDS = ['Chest', 'Back', 'Hips', 'ArmR', 'ArmL'], wears = (B) => BANDS.every((band) => B.body.segments.some((s) => s.name.startsWith(`shred${band}`)));
    const seed = [1, 2, 3, 4, 5, 6, 7, 8].find((sd) => wears(dressed(['shreds'], sd)));
    expect(seed).toBeDefined();
    const B = dressed(['shreds'], seed), C = B.body.segments.filter((s) => s.group === 'Cloth');
    for (const s of C) {
      expect(s.kind).toBe('rings');
      const cs = s.stations.map((st) => Object.values(st.points)), mid = (P) => [0, 1, 2].map((i) => P.reduce((t, p) => t + p[i], 0) / P.length);
      // it hangs: each ring below the last
      for (let i = 1; i < cs.length; i++) expect(mid(cs[i])[2]).toBeLessThan(mid(cs[i - 1])[2]);
      // a ribbon: broad across, thin off its face
      const P0 = s.stations[0].points, d = (a, b) => Math.hypot(...a.map((v, j) => v - b[j]));
      expect(d(P0.frontR, P0.backL)).toBeGreaterThan(3 * d(P0.front, P0.back));
    }
    // the hips' strips over the front follow the thighs, the chest's ride the torso, a sleeve's its arm; the rags of the
    // chest and the arms hinge with the lean, the hips' stay with the pelvis
    expect(C.filter((s) => s.name.startsWith('shredHips')).some((s) => /^thigh[RL]$/.test(Object.keys(s.bind.blend?.tip ?? {})[0]))).toBe(true);
    expect(C.find((s) => s.name.startsWith('shredChest')).bind.bone).toBe('torso');
    expect(C.find((s) => s.name.startsWith('shredArmL')).bind.bone).toBe('upperArmL');
    expect(B.frameParts).toContain(C.find((s) => s.name.startsWith('shredChest')).name);
    expect(B.frameParts.some((n) => n.startsWith('shredHips'))).toBe(false);
  });
  it('a layer lies on its own dice: the body under it is the bare form\'s, byte for byte, and absent it adds nothing', () => {
    const bare = dressed([]), B = dressed(['shreds']);
    expect(JSON.stringify(B.body.segments.filter((s) => s.group !== 'Cloth'))).toBe(JSON.stringify(bare.body.segments));
    expect(JSON.stringify(dressed(['shreds']).body)).toBe(JSON.stringify(B.body));
    expect(bare.body.segments.some((s) => s.group === 'Cloth')).toBe(false);
    expect(() => dressed(['glitter'])).toThrow(/no layer 'glitter'/);
  });
  it('a lineage lays its layers over its form; the ragged one dresses the skeleton', () => {
    const sheet = rollEgocube({ facets: { ancestry: 'ragged', build: 'canonical', role: 'frontline' }, seed: 3 });
    expect(sheet.ancestry).toMatchObject({ door: 'creature', form: 'skeleton', layers: ['shreds'] });
    const P = planFromSheet(sheet), plan = P.create.spec.plan;
    expect(validatePlan(plan)).toBe(true);
    expect(() => expandPlan(plan)).not.toThrow();
    expect(plan.palette.Cloth).toBeTruthy();
    expect(P.undead?.layers ?? P.create.spec.undead?.layers ?? ['shreds']).toEqual(['shreds']);
    const lin = { reads: 'x', humanity: [0, 0.1], cover: { a: '#aaaaaa' }, cues: [{ at: 1, ch: 'frame', line: 'x' }] };
    expect(() => readLineage('x', { ...lin, form: 'skeleton', layers: Object.keys(UNDEAD_LAYERS) })).not.toThrow();
    expect(() => readLineage('x', { ...lin, form: 'skeleton', layers: ['glitter'] })).toThrow(/unknown layer/);
    expect(() => readLineage('x', { ...lin, layers: ['shreds'] })).toThrow(/give form too/);
    expect(() => readLineage('x', { ...lin, form: 'mummy' })).toThrow(/unknown form/);
  });
});

describe('the lineages and the bestiary', () => {
  it('each form reaches the creature door with its form, its variation by the build, and its plan builds', () => {
    for (const ancestry of Object.keys(UNDEAD_FORMS)) {
      const sheet = rollEgocube({ facets: { ancestry, build: 'brute', role: 'frontline' }, seed: 3 });
      expect(sheet.ancestry).toMatchObject({ door: 'creature', form: ancestry });
      const P = planFromSheet(sheet), plan = P.create.spec.plan;
      expect(P.create.as).toBe('creature');
      expect(validatePlan(plan)).toBe(true);
      expect(() => expandPlan(plan)).not.toThrow();
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
