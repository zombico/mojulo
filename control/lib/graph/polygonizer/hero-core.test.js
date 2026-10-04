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
  it('is structured, and naming it changes no bytes on either look', async () => {
    const { DEFAULT_CORE } = await import('./hero-form.js');
    expect(DEFAULT_CORE).toBe('structured'); expect(HERO_CORES).toEqual(['streamlined', 'structured']);
    for (const opts of [{ cast: 'male' }, { cast: 'female', proportions: 'anime' }]) expect(heroPlan({ ...opts, core: 'structured' })).toEqual(heroPlan(opts));
  });
  it('refuses a core it does not know', () => {
    expect(() => heroPlan({ core: 'bony' })).toThrow(/unknown core 'bony' \(have streamlined, structured\)/);
  });
});

describe('the structured core', () => {
  for (const opts of [{ cast: 'male' }, { cast: 'female' }, { cast: 'male', proportions: 'anime' }, { cast: 'female', proportions: 'anime' }]) {
    const label = `${opts.cast}${opts.proportions ? ' anime' : ''}`;
    const S = rigged({ ...opts, core: 'structured' }), D = rigged({ ...opts, core: 'streamlined' });
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
      // each figure's own hip ring (the two meshes do not share a vertex layout: the structured torso carries more rings)
      const ringOf = (X) => X.mesh.provenance.map((p, i) => (p.part === 'thighR' && /\/st1\./.test(p.id) ? i : -1)).filter((i) => i >= 0);
      expect(ringOf(S).length).toBeGreaterThan(0);
      const posed = (X) => { const fr = boneFrames(X.R, X.R.joints, rigNodesAt(X.R, POSES.curl).nodes); return ringOf(X).map((i) => { let out = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = X.skin.weights[i][k]; if (!w) continue; const f = fr[X.skin.joints[i][k]], v = X.mesh.vertices[i], d = [v[0] - f.restHead[0], v[1] - f.restHead[1], v[2] - f.restHead[2]]; out = out.map((o, a) => o + w * (f.head[a] + f.m[a][0] * d[0] + f.m[a][1] * d[1] + f.m[a][2] * d[2])); } return out; }); };
      const drift = (X) => Math.max(...posed(X).map((p, j) => Math.hypot(...p.map((c, a) => c - X.mesh.vertices[ringOf(X)[j]][a]))));
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

describe('the pelvis mesh: one hip curve, no pouch, no shelf', () => {
  // plane sections of the trunk, pelvis and thighs at rest, from the hem down to the knee
  const sections = (X) => {
    const V = X.mesh.vertices, J = X.R.joints, tris = X.mesh.faces.filter((f) => /^(torso|pelvis|thigh[RL])$/.test(X.mesh.provenance[f[0]].part));
    const at = (z) => { const ps = []; for (const f of tris) for (let i = 1; i + 1 < f.length; i++) { const t = [V[f[0]], V[f[i]], V[f[i + 1]]]; for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3]; if ((a[2] - z) * (b[2] - z) > 0 || a[2] === b[2]) continue; const u = (z - a[2]) / (b[2] - a[2]); ps.push([a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])]); } } return ps; };
    const zp = J.pelvisHub[2], L = J.navel[2] - zp, zHem = zp + 0.63 * L, out = [];
    for (let z = zHem - 0.005; z > J.kneeR[2] + 0.05; z -= 0.01) { const ps = at(z), mid = ps.filter((p) => Math.abs(p[0]) < 0.012); out.push({ z, w: Math.max(...ps.map((p) => p[0])), front: mid.length ? Math.max(...mid.map((p) => p[1])) : null }); }
    return { out, zp, zt: zp - 0.26 * L, zc: zp - 0.4 * L };
  };
  for (const opts of [{ cast: 'male' }, { cast: 'female' }, { cast: 'female', proportions: 'anime' }, { cast: 'male', proportions: 'anime' }]) {
    const label = `${opts.cast}${opts.proportions ? ' anime' : ''}`;
    it(`${label}: one hip curve: the outline rises to a single peak (the female's near the trochanter) and narrows to the knee`, () => {
      const { out, zp, zt } = sections(rigged({ ...opts, core: 'structured' }));
      const peak = out.reduce((a, b) => (b.w > a.w ? b : a));
      if (opts.cast === 'female') { expect(peak.z).toBeLessThan(zp + 0.03); expect(peak.z).toBeGreaterThan(zt - 0.05); }   // the trochanter band, not the hem
      // the male hip is straight: his hem is as wide as his hips, and the peak may sit there
      const above = out.filter((s) => s.z > peak.z), below = out.filter((s) => s.z < peak.z);
      for (let i = 1; i < above.length; i++) expect(above[i].w, `widening at z ${above[i].z.toFixed(3)}`).toBeGreaterThan(above[i - 1].w - 0.004);
      for (let i = 1; i < below.length; i++) expect(below[i].w, `narrowing at z ${below[i].z.toFixed(3)}`).toBeLessThan(below[i - 1].w + 0.004);
      const step = Math.max(...out.slice(1).map((s, i) => s.w - out[i].w).map(Math.abs));
      expect(step).toBeLessThan(0.012);                                                                // no shelf: at most 12 mm a centimetre
    });
    it(`${label}: the front below the hem recedes to the crotch (no pouch)`, () => {
      // down to the crotch: below it the midline sections are the two inner thighs
      const { out, zc } = sections(rigged({ ...opts, core: 'structured' })), fronts = out.filter((s) => s.front !== null && s.z > zc).map((s) => s.front);
      for (let i = 1; i < fronts.length; i++) expect(fronts[i]).toBeLessThan(fronts[i - 1] + 0.004);
      expect(fronts[0] - fronts.at(-1)).toBeGreaterThan(opts.cast === 'female' ? 0.04 : 0.03);
    });
  }
  it('the pelvis is one closed part bound to the basin and the lumbar; the streamlined hero has none', () => {
    const S = rigged({ cast: 'female', core: 'structured' }), D = rigged({ cast: 'female', core: 'streamlined' });
    expect(S.recipe.parts.pelvis).toBeDefined(); expect(D.recipe.parts.pelvis).toBeUndefined();
    const bones = new Set(); S.mesh.provenance.forEach((p, i) => { if (p.part === 'pelvis') S.skin.joints[i].forEach((j, k) => { if (S.skin.weights[i][k] > 0) bones.add(S.R.bones[j].id); }); });
    expect([...bones].sort()).toEqual(['lumbar', 'pelvis']);
  });
});

describe('core measures: what the critic reads', () => {
  it('every structured body measures in band; the streamlined female is told what core structured fixes', async () => {
    const { coreMeasures, coreAdvice } = await import('./hero-core-measures.js');
    for (const opts of [{ cast: 'male' }, { cast: 'female' }, { cast: 'female', proportions: 'anime' }, { cast: 'male', proportions: 'anime' }]) {
      const plan = heroPlan({ ...opts, core: 'structured' }), m = coreMeasures(plan, compileLayered(expandPlan(plan)));
      expect(coreAdvice(m, opts.cast), JSON.stringify({ opts, m })).toEqual([]);
      expect(m.legs).toBe('converge'); expect(m.pouch_m).toBeLessThan(0.004);
    }
    const plan = heroPlan({ cast: 'female', proportions: 'anime', core: 'streamlined' }), m = coreMeasures(plan, compileLayered(expandPlan(plan)));
    expect(m.legs).toBe('splay'); expect(m.seat_m).toBeLessThan(0.015);
    const advice = coreAdvice(m, 'female').join('\n');
    for (const said of ['not at the trochanter', 'the seat is flat', 'the front bulges below the belly', 'the knees stand wider']) expect(advice).toContain(said);
    expect(advice.match(/core 'structured'/g).length).toBeGreaterThanOrEqual(4);
  });
  it('the readout carries the core for every hero; its advice joins the warnings on the structured core (the default) only', async () => {
    const { heroRecord, heroPlanOf, heroReadout } = await import('../../mcp/tools/layered.js');
    const read = (spec) => { const hero = heroRecord(spec), plan = heroPlanOf(hero), recipe = expandPlan(plan), mesh = compileLayered(recipe); return heroReadout(hero, plan, null, [], { mesh, recipe }); };
    const old = read({ cast: 'female', head: 'anime', core: 'streamlined' }), now = read({ cast: 'female', head: 'anime' });
    expect(old.core.core).toBe('streamlined'); expect(old.core.advice.length).toBeGreaterThan(0);
    expect((old.warnings || []).some((w) => w.startsWith('core:'))).toBe(false);
    expect(now.core).toMatchObject({ core: 'structured', body: 'female', legs: 'converge', advice: [] });
  });
});

describe('the dress on the structured core: hip pieces hang from the pelvis', () => {
  it('the knight plates the hips from the pelvis and wraps the thigh it is drawn on; the streamlined kit is as before', async () => {
    const { dressContext } = await import('./hero-dress.js');
    const { expandArmor } = await import('../armor/expand.js');
    const build = { type: 'armor', style: 'knight' };
    const S = heroPlan({ cast: 'male', core: 'structured' }), D = heroPlan({ cast: 'male', core: 'streamlined' });
    const ks = expandArmor(build, dressContext(S.style, 1, S)).kit, kd = expandArmor(build, dressContext(D.style, 1, D)).kit;
    expect(kd).toEqual(expandArmor(build, dressContext(D.style, 1)).kit);                       // no pelvis: byte for byte the old kit
    const id = (k) => k.map((a) => a.id);
    expect(id(ks)).toEqual(expect.arrayContaining(['pelvis-fauld', 'pelvis-tassetR', 'pelvis-tassetL']));
    expect(id(ks)).not.toContain('thighR-tasset'); expect(id(kd)).toContain('thighR-tasset');
    for (const a of ks.filter((x) => /^pelvis-/.test(x.id))) { expect(a.part).toBe('pelvis'); expect(a.pin[3]).toBe('pelvis'); }   // they ride the basin
    const cuisse = (k) => k.find((a) => a.id === 'thighR-cuisse').t[1];
    expect(cuisse(ks) / 4).toBeCloseTo(cuisse(kd) / 3, 6);                                         // the same share of the thigh's own ring
  });
  it('every piece that stands off the thighs stands off the pelvis too, kits of the operator included', async () => {
    const { dressPlan } = await import('./hero-dress.js');
    const mine = [{ id: 'sash', mode: 'band', part: 'torso', over: ['thighR', 'thighL'], s: [0.1, 0.4], t: 'wrap', nt: 12, ns: 2, mugen: 0.004, thick: 0.01, rad: 0.05, group: 'Sash' }];
    for (const adorn of ['ranger', mine]) {
      const S = dressPlan(heroPlan({ cast: 'female', core: 'structured' }), { adorn }), D = dressPlan(heroPlan({ cast: 'female', core: 'streamlined' }), { adorn });
      for (const a of S.adorn.filter((x) => x.over?.some((n) => /^thigh/.test(n)))) expect(a.over).toContain('pelvis');
      for (const a of D.adorn) expect(a.over ?? []).not.toContain('pelvis');
    }
  });
});

describe('the structured torso', () => {
  const torsoOf = (opts) => heroPlan(opts).segments.find((s) => s.name === 'torso');
  for (const opts of [{ cast: 'male' }, { cast: 'female' }, { cast: 'male', proportions: 'anime' }, { cast: 'female', proportions: 'anime' }]) {
    const label = `${opts.cast}${opts.proportions ? ' anime' : ''}`;
    it(`${label}: the five addressed rings keep u 0 … 4; the shaping rings sit between at fractional u, named as refine would`, () => {
      const t = torsoOf(opts);
      expect(t.stations.map((st) => st.id)).toEqual(['st0', 'st1', 'st1_st2_50', 'st2', 'st2_st3_50', 'st3', 'st3_st4_50', 'st4']);
      expect(t.stations.map((st) => st.u)).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
      for (let i = 1; i < t.stations.length; i++) expect(t.stations[i].z).toBeGreaterThan(t.stations[i - 1].z);
      // the old torso's address at every integer s is the same ring role: the hem, the navel, the chest, the shoulder, the neck
      const old = torsoOf({ ...opts, core: 'streamlined' });
      expect(t.stations[0]).toMatchObject({ z: old.stations[0].z }); expect(t.stations[1].z).toBe(old.stations[1].z); expect(t.stations.at(-1).z).toBe(old.stations[4].z);
    });
    it(`${label}: the shoulders slope from the neck: the shoulder ring narrower than the old box, the trapezius ring between it and the neck`, () => {
      const t = torsoOf(opts), old = torsoOf({ ...opts, core: 'streamlined' }), x = (id) => t.stations.find((st) => st.id === id).r[0];
      expect(x('st3')).toBeLessThan(old.stations[3].r[0]);
      expect(x('st3_st4_50')).toBeLessThan(x('st3')); expect(x('st3_st4_50')).toBeGreaterThan(x('st4'));
      expect(x('st1')).toBeLessThan(x('st1_st2_50'));   // the waist under the ribs
    });
  }
  it('the female waist is narrower than her hem and her chest; the male back is widest under the arms', () => {
    const f = torsoOf({ cast: 'female' }), m = torsoOf({ cast: 'male' }), x = (t, id) => t.stations.find((st) => st.id === id).r[0];
    expect(x(f, 'st1')).toBeLessThan(x(f, 'st0')); expect(x(f, 'st1')).toBeLessThan(x(f, 'st2'));
    expect(x(m, 'st2_st3_50')).toBeGreaterThanOrEqual(x(m, 'st2'));
  });
  it('a shaping ring takes its skin and every dial blend from its neighbours by u', () => {
    const p = heroPlan({ cast: 'male' }), t = p.segments.find((s) => s.name === 'torso');
    expect(t.bind.blend.st1_st2_50).toEqual({ lumbar: 0.25, torso: 0.75 });
    expect(p.dials.bulk.blend.st2_st3_50).toBe(1);
  });
  it('a torso address lands on the same parameter: an adornment at s 2.5 sits between the chest and shoulder rings', () => {
    const { recipe } = rigged({ cast: 'male' }), P = compileLayered(recipe).parts.torso;
    expect(P.stations.map((st) => st.u)).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
  });
});

describe('the structured chest layers', () => {
  // the front-most torso surface at (x, z) on the compiled rest mesh
  const front = (mesh, x, z) => { const V = mesh.vertices; let best = -Infinity;
    mesh.faces.forEach((f, fi) => { if (!mesh.faceIds[fi].startsWith('torso/')) return; const [a, b, c] = f.slice(0, 3).map((v) => V[v]);
      const d = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]); if (Math.abs(d) < 1e-12) return;
      const u = ((x - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (z - a[2])) / d, v = ((b[0] - a[0]) * (z - a[2]) - (x - a[0]) * (b[2] - a[2])) / d;
      if (u >= 0 && v >= 0 && u + v <= 1) best = Math.max(best, a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1])); }); return best; };
  const proud = (mesh, part, st, slot) => { const p = mesh.vertices[mesh.pointIds.indexOf(`${part}/${st}.${slot}`)]; return p[1] - front(mesh, p[0], p[2]); };
  it('the adult female: a pectoral and over it a breast per side, each its own part sampling the breast field, on its own bone', () => {
    const { recipe, mesh, R, skin } = rigged({ cast: 'female' });
    expect(Object.keys(recipe.parts).filter((p) => /^(pectoral|bust)/.test(p)).sort()).toEqual(['bustL', 'bustR', 'pectoralL', 'pectoralR']);
    expect(R.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['bustR', 'bustL']));
    expect(proud(mesh, 'bustR', 'st6', 'front')).toBeGreaterThan(0.03);   // the fuller lower pole stands well proud of the chest
    expect(proud(mesh, 'bustR', 'st6', 'front')).toBeGreaterThan(proud(mesh, 'bustR', 'st13', 'front'));   // more than the upper pole
    for (const sl of ['sideL', 'b4R', 'back']) expect(proud(mesh, 'bustR', 'st6', sl), sl).toBeLessThan(0);   // its ends and inside are under the surface
    const dom = (id) => R.bones[skin.dominant[mesh.pointIds.indexOf(id)]].id;
    expect(dom('bustR/st3.front')).toBe('bustR'); expect(dom('bustL/st3.front')).toBe('bustL');
    expect(dom('bustR/st3.back')).toBe('torso'); expect(dom('bustL/st3.sideR')).toBe('torso');   // the left part's mirrored slots keep the torso
    expect(recipe.parts.torso.stations.length).toBe(8);
    const a = auditRig(mesh, skin, R, [{}, ...Object.values(POSES)]); expect(a.badWeights).toBe(0);
  });
  it('the male: the pectorals alone, their lower border the most proud (the shelf), the armpit end a share of the arm', () => {
    const { recipe, mesh, R, skin } = rigged({ cast: 'male' }), P = recipe.parts.pectoralR;
    expect(Object.keys(recipe.parts).filter((p) => /^bust/.test(p))).toEqual([]);
    const low = proud(mesh, 'pectoralR', 'st1', 'front'), top = proud(mesh, 'pectoralR', `st${P.stations.length - 1}`, 'front');
    expect(low).toBeGreaterThan(0.01); expect(low).toBeGreaterThan(top);
    expect(Object.entries(P.bind.blend).some(([k, w]) => /\.backR$/.test(k) && w.upperArmR > 0)).toBe(true);
    expect(recipe.parts.pectoralL.bind.blend[Object.keys(P.bind.blend).find((k) => /\.backR$/.test(k)).replace(/R$/, 'L')]).toMatchObject({ upperArmL: 0.25 });
    const a = auditRig(mesh, skin, R, [{}, ...Object.values(POSES)]); expect(a.badWeights).toBe(0);
  });
  it('the male carries no breast, an explicit body.bust 0 none, and the streamlined core keeps its mounds', () => {
    expect(rigged({ cast: 'male' }).R.bones.some((b) => /bust/.test(b.id))).toBe(false);
    expect(rigged({ cast: 'female', body: { bust: 0 } }).R.bones.some((b) => /bust/.test(b.id))).toBe(false);
    expect(heroPlan({ cast: 'female', core: 'streamlined' }).segments.some((s) => /bust/.test(s.name))).toBe(false);
    expect(heroPlan({ cast: 'female', core: 'streamlined', body: { bust: 0.04 } }).segments.some((s) => s.name === 'bustR')).toBe(true);
  });
  it('a child-coded figure through the door takes none: the kid look on the female cast, the child and chibi casts', async () => {
    const { expandLayeredManifest, heroRecord } = await import('../../mcp/tools/layered.js');
    for (const hero of [{ cast: 'female', head: 'anime', look: ['kid'] }, { cast: 'child' }, { cast: 'chibi' }]) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(hero) });
      expect(m.recipe.rig.bones.some((b) => /bust/.test(b.id ?? '')), JSON.stringify(hero)).toBe(false);
    }
  });
});
