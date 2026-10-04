// hero-core.test.js — the structured core (figure articulation: pelvic). `core: 'structured'` splits the hero's one
// pelvis bone into the basin (`pelvis`, turned by the hip line alone, as figure-vajra.js articulateTransforms' pelvis
// rides hipL) and the lumbar (`lumbar`, the pelvis hub to the navel: the old pelvis frame), so a spine curl bends the lower
// back over a still pelvis. A rig bone's `align` is what turns the basin. The default core changes no bytes.
import { describe, it, expect } from 'vitest';
import { heroPlan, HERO_CORES } from './hero-form.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, auditRig } from './station-loft-rig.js';

const turn = (f) => Math.acos(Math.max(-1, Math.min(1, (f.m[0][0] + f.m[1][1] + f.m[2][2] - 1) / 2))) * 180 / Math.PI;
const rigged = (opts) => { const recipe = expandPlan(heroPlan(opts)); const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); return { recipe, mesh, R, skin: bindLayered(mesh, recipe, R) }; };
const frames = (R, pose) => Object.fromEntries(boneFrames(R, R.joints, rigNodesAt(R, pose).nodes).map((f) => [f.id, f]));
const POSES = { curl: { spine: { curl: 1 } }, arch: { spine: { arch: 1 } }, sideBend: { spine: { sideBend: ['left', 1] } }, hinge: { hinge: 30 }, pelvis: { pelvis: 15 } };

describe('a rig bone can be aligned by two joints', () => {
  const rig = (bone) => ({ joints: Object.fromEntries(Object.entries(validateRig(expandPlan(heroPlan()).rig).joints).map(([k, at]) => [k, { at }])), bones: [bone] });
  it('refuses an align that does not name two different joints', () => {
    for (const align of [['hipL'], ['hipL', 'hipL'], ['hipL', 'nowhere'], 'hipL']) expect(() => validateRig(rig({ id: 'b', head: 'pelvisHub', tail: 'navel', align }))).toThrow(/align must name two different joints/);
  });
  it('the aligned frame follows its joints\' line and sits at its head', () => {
    const R = validateRig(rig({ id: 'b', head: 'pelvisHub', tail: 'navel', align: ['hipR', 'hipL'] }));
    const curl = frames(R, POSES.curl).b, yaw = frames(R, POSES.pelvis).b;
    expect(turn(curl)).toBeLessThan(1e-6);                       // the navel moved; the hip line did not
    expect(turn(yaw)).toBeCloseTo(15, 6);                        // the hip line turned 15° about the pelvis hub
    expect(curl.head).toEqual(rigNodesAt(R, POSES.curl).nodes.pelvisHub);
  });
});

describe('the default core', () => {
  it('is streamlined, and naming it changes no bytes on either look', () => {
    expect(HERO_CORES[0]).toBe('streamlined');
    for (const opts of [{ cast: 'male' }, { cast: 'female', proportions: 'anime' }]) expect(heroPlan({ ...opts, core: 'streamlined' })).toEqual(heroPlan(opts));
  });
  it('refuses a core it does not know', () => {
    expect(() => heroPlan({ core: 'bony' })).toThrow(/unknown core 'bony' \(have streamlined, structured\)/);
  });
});

describe('the structured core', () => {
  for (const opts of [{ cast: 'male' }, { cast: 'female' }, { cast: 'male', proportions: 'anime' }, { cast: 'female', proportions: 'anime' }]) {
    const label = `${opts.cast}${opts.proportions ? ' anime' : ''}`;
    const S = rigged({ ...opts, core: 'structured' }), D = rigged(opts);
    it(`${label}: the basin turns with the hip line alone; the lumbar carries what the old pelvis did`, () => {
      expect(S.R.bones.slice(0, 3).map((b) => b.id)).toEqual(['pelvis', 'lumbar', 'torso']);
      for (const [name, pose] of Object.entries(POSES)) {
        const s = frames(S.R, pose), d = frames(D.R, pose);
        expect(turn(s.lumbar), name).toBeCloseTo(turn(d.pelvis), 9);
        expect(turn(s.pelvis), name).toBeCloseTo(name === 'pelvis' ? 15 : 0, 6);
      }
    });
    it(`${label}: the legs converge: the knee inside the hip joint, clear of the other knee, the ankle under it`, () => {
      const j = S.R.joints, d = D.R.joints;
      expect(j.kneeR[0]).toBeLessThan(j.hipR[0]); expect(d.kneeR[0]).toBeGreaterThan(d.hipR[0]);   // the cast alone splays them
      expect(j.ankleR[0]).toBe(j.kneeR[0]); expect(j.kneeL[0]).toBe(-j.kneeR[0]);
      const shin = S.mesh.vertices.filter((_, i) => S.mesh.provenance[i].part === 'shankR');
      expect(Math.min(...shin.map((v) => v[0]))).toBeGreaterThan(0.005);   // the knees and shins never meet at the midline
      for (const k of ['pelvisHub', 'navel', 'neckHub', 'hipR', 'shoulderR']) expect(j[k]).toEqual(d[k]);   // above the knee nothing moves
    });
    it(`${label}: the hip ring holds still under a spine curl, and the rig gates pass`, () => {
      const hipRing = S.mesh.provenance.map((p, i) => (p.part === 'thighR' && /\/st1\./.test(p.id) ? i : -1)).filter((i) => i >= 0);
      expect(hipRing.length).toBeGreaterThan(0);
      const posed = (X) => { const fr = boneFrames(X.R, X.R.joints, rigNodesAt(X.R, POSES.curl).nodes); return hipRing.map((i) => { let out = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = X.skin.weights[i][k]; if (!w) continue; const f = fr[X.skin.joints[i][k]], v = X.mesh.vertices[i], d = [v[0] - f.restHead[0], v[1] - f.restHead[1], v[2] - f.restHead[2]]; out = out.map((o, a) => o + w * (f.head[a] + f.m[a][0] * d[0] + f.m[a][1] * d[1] + f.m[a][2] * d[2])); } return out; }); };
      const drift = (X) => Math.max(...posed(X).map((p, j) => Math.hypot(...p.map((c, a) => c - X.mesh.vertices[hipRing[j]][a]))));
      expect(drift(S)).toBeLessThan(0.25 * drift(D));             // the thigh's own 0.2 remains; the curl no longer drags the hips
      const a = auditRig(S.mesh, S.skin, S.R, [{}, ...Object.values(POSES)]);
      expect(a.badWeights).toBe(0); expect(a.maxLengthError).toBeLessThan(1e-9); expect(a.maxOrthoError).toBeLessThan(1e-9);
    });
  }
});

describe('the hero door takes the core', () => {
  it('stores it when given, plans it, and refuses an unknown word by name', async () => {
    const { heroRecord, heroPlanOf } = await import('../../mcp/tools/layered.js');
    expect(heroRecord({ cast: 'female', head: 'anime' }).core).toBeUndefined();
    const rec = heroRecord({ cast: 'female', head: 'anime', core: 'structured' });
    expect(rec.core).toBe('structured');
    expect(heroPlanOf(rec).rig.bones.slice(0, 2).map((b) => b.id)).toEqual(['pelvis', 'lumbar']);
    expect(heroPlanOf(heroRecord({ cast: 'male', core: 'structured' })).rig.bones[1].id).toBe('lumbar');   // the landmark head too
    expect(() => heroRecord({ core: 'bony' })).toThrow(/core: 'structured'/);
  });
});

describe('the stand owns its base: stance and stagger', () => {
  it('no stance word plants the rest foot exactly; stance spreads and stagger splits the planted feet', async () => {
    const { plantedFoot } = await import('./station-loft-rig.js');
    const { R } = rigged({ cast: 'female', core: 'structured' }), legR = R.legs.R, legL = R.legs.L, j = R.joints;
    expect(plantedFoot(R, legR, {}).toeBase).toEqual(j.toeBaseR);
    const wide = rigNodesAt(R, { stance: 2, crouch: 0.2 }).nodes;   // a straight leg cannot reach a wide foot: the stands crouch
    expect(wide.ankleR[0]).toBeCloseTo(2 * j.hipR[0], 9); expect(wide.ankleL[0]).toBeCloseTo(2 * j.hipL[0], 9);
    const split = rigNodesAt(R, { stagger: 0.3, crouch: 0.2 }).nodes, legH = j.hipR[2] - j.toeBaseR[2];
    expect(split.toeBaseL[1] - j.toeBaseL[1]).toBeCloseTo(0.15 * legH, 9); expect(split.toeBaseR[1] - j.toeBaseR[1]).toBeCloseTo(-0.15 * legH, 9);
  });
  it('the streamlined core resolves every preset as before; the structured one swaps the free leg for a planted base', async () => {
    const { resolveGesture, GESTURE_PRESETS, STRUCTURED_STANDS } = await import('./hero-gesture.js');
    for (const word of Object.keys(GESTURE_PRESETS)) for (const cast of ['male', 'female']) {
      expect(resolveGesture(word, cast)).toEqual(GESTURE_PRESETS[word][cast]);
      expect(resolveGesture(word, cast, { core: 'streamlined' })).toEqual(GESTURE_PRESETS[word][cast]);
      const s = resolveGesture(word, cast, { core: 'structured' }), F = STRUCTURED_STANDS[word].free;
      expect(s.support).toBe('both'); expect(s.stance).toBe(STRUCTURED_STANDS[word].legs.stance);
      for (const k of [`hip${F}`, `knee${F}`]) expect(s[k]).toBeUndefined();
      for (const k of ['shL', 'shR', 'head', 'spine']) if (GESTURE_PRESETS[word][cast][k]) expect(s[k]).toEqual(GESTURE_PRESETS[word][cast][k]);   // the body, arms and head kept
    }
  });
  it('every structured stand is reachable on both bodies, plants where it says, and keeps the knees apart', async () => {
    const { resolveGesture, GESTURE_PRESETS } = await import('./hero-gesture.js');
    for (const opts of [{ cast: 'male' }, { cast: 'female' }, { cast: 'female', proportions: 'anime' }]) {
      const X = rigged({ ...opts, core: 'structured' });
      const poses = Object.keys(GESTURE_PRESETS).map((w) => resolveGesture(w, opts.cast, { core: 'structured' }));
      const a = auditRig(X.mesh, X.skin, X.R, poses);
      expect(a.maxPlantedDrift).toBeLessThan(1e-9);
      for (const p of poses) { const n = rigNodesAt(X.R, p).nodes; expect(n.kneeR[0] - n.kneeL[0]).toBeGreaterThan(0.1); }
    }
  });
  it('the door refuses a stance or stagger out of range by name', async () => {
    const { validateGesture } = await import('./hero-gesture.js');
    expect(validateGesture({ stance: 4 }).join(' ')).toMatch(/stance: the planted feet's spread/);
    expect(validateGesture({ stagger: -2 }).join(' ')).toMatch(/stagger: \+ the left foot forward/);
    expect(validateGesture({ stance: 1.5, stagger: 0.2, heelR: 10 })).toEqual([]);
  });
});
