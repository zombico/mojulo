// hero-flow — the hair's and the garments' control strings on real anime heroes: absent the `flow` channel the rig is as it was; every
// section has its string and its vertices ride it; the strings hold still at rest, lean downwind and come back in a
// calm; through a sprint and a roll the links hold their lengths, no joint enters the body-and-outfit form or the
// floor, and a loop's seam meets. Deterministic.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { hairRig, flowRig, flowSimulation as hairSimulation, simulateClip, HAIR_SECTIONS, rigidityParams, rigidityErrors } from './hero-flow.js';
import { locomotionClips, motionPlan } from './hero-motion.js';
import { heroJump } from './hero-jump.js';
import { heroRecord, heroPlanOf, planLayered, expandLayeredManifest } from '../../mcp/tools/layered.js';

const heroOf = (spec) => {
  const hero = heroRecord(spec); const ex = expandLayeredManifest({ kind: 'layered', title: 't', hero });
  const manifest = { kind: 'layered', title: 't', recipe: ex.recipe, plan: heroPlanOf(hero), hero, dials: ex.dials, units: 'm' };
  return { mesh: planLayered(manifest).mesh, recipe: manifest.recipe };
};
const FEMALE = heroOf({ cast: 'female', head: 'anime', hair: 'long' }), MALE = heroOf({ cast: 'male', head: 'anime' });
const H = hairRig(FEMALE.mesh, FEMALE.recipe);
const tipKey = (part) => H.strings.find((s) => s.part === part).joints.at(-1);
const segT = (p, a, b) => { const ab = [0, 1, 2].map((k) => b[k] - a[k]), ap = [0, 1, 2].map((k) => p[k] - a[k]); return Math.max(0, Math.min(1, ab.reduce((s, v, k) => s + v * ap[k], 0) / ab.reduce((s, v) => s + v * v, 0))); };
const segD = (p, a, b) => { const ab = [0, 1, 2].map((k) => b[k] - a[k]), t = segT(p, a, b); return Math.hypot(...[0, 1, 2].map((k) => p[k] - a[k] - ab[k] * t)); };
const rAt = (c, p) => c.r0 + (c.r1 - c.r0) * segT(p, c.a, c.b);

describe('hero-flow: the hair strings', () => {
  it('absent the flow channel the rig places every joint as it did; the strings ride the head at rest', () => {
    const R0 = validateRig(FEMALE.recipe.rig);
    for (const pose of [{}, { kneeL: 30, head: { yaw: 20 } }, { body: { roll: 120, at: R0.joints.navel } }]) {
      const a = rigNodesAt(R0, pose).nodes, b = rigNodesAt(H.R, pose).nodes;
      for (const k of Object.keys(a)) expect(b[k]).toEqual(a[k]);
      expect(rigNodesAt(H.R, { ...pose, flow: {} }).nodes).toEqual(b);
    }
  });
  for (const [name, X] of [['female', FEMALE], ['male', MALE]]) it(`${name}: a string per hair section, its vertices weighed along it`, () => {
    const Hx = hairRig(X.mesh, X.recipe); const parts = Hx.strings.map((s) => s.part);
    for (const p of ['hairFormBackC', 'hairFormFringeA', 'hairAhoge']) if (X.mesh.parts[p]) expect(parts).toContain(p);
    for (const st of Hx.strings) { expect(st.joints).toHaveLength(HAIR_SECTIONS[st.part].links + 1); for (const l of st.lengths) expect(l).toBeGreaterThan(0.005); }
    const hairBones = new Set(Hx.strings.flatMap((s) => s.bones.map((b) => Hx.R.boneIndex[b])).concat(Hx.R.boneIndex.head));
    X.mesh.provenance.forEach((p, i) => {
      if (!parts.includes(p.part)) return;
      const w = Hx.skin.weights[i]; expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
      Hx.skin.joints[i].forEach((j, k) => { if (w[k]) expect(hairBones.has(j)).toBe(true); });
    });
    expect(Hx.form.map((c) => c.bone)).toEqual(expect.arrayContaining(['torso', 'neck', 'head']));
  });
});

describe('hero-flow: the dynamics', () => {
  it('holds still at rest, leans downwind in a steady wind and comes back in a calm; deterministic', () => {
    const run = () => { const sim = hairSimulation(H); let p; for (let i = 0; i < 60; i++) p = sim.step({}, 1 / 30); const still = p; for (let i = 0; i < 90; i++) p = sim.step({}, 1 / 30, [5, 0, 0]); const windy = p; for (let i = 0; i < 120; i++) p = sim.step({}, 1 / 30); return { still, windy, calm: p }; };
    const A = run(), B = run();
    expect(JSON.stringify(A)).toBe(JSON.stringify(B));
    for (const v of Object.values(A.still.flow)) expect(Math.hypot(...v)).toBeLessThan(2e-6);   // the channel's micrometre rounding
    expect(A.windy.flow[tipKey('hairFormBackC')][0]).toBeGreaterThan(0.05);   // the back's tip blown toward +x
    for (const v of Object.values(A.calm.flow)) expect(Math.hypot(...v)).toBeLessThan(0.01);
  });
  const clipsOf = locomotionClips(motionPlan({ sprint: true }), validateRig(FEMALE.recipe.rig)).clips;
  for (const [label, fn, seconds, loop, speed] of [['sprint', clipsOf.sprint, 0.55, true, 5.3], ['rollForward', heroJump('rollForward', validateRig(FEMALE.recipe.rig)).fn, 1.5, false, 0]]) {
    it(`${label}: the links hold, nothing enters the form or the floor${loop ? ', the loop meets' : ''}`, () => {
      const K = Math.round(seconds * 120); const poses = Array.from({ length: K }, (_, k) => fn(loop ? k / K : k / (K - 1)));
      const out = simulateClip(H, poses, seconds, { loop, air: () => [0, -speed, 0] });
      const sim = hairSimulation(H); const floor = Math.min(...Object.values(H.R.legs).map((L) => H.R.joints[L.toeBase][2]));
      const restD = H.strings.map((st) => st.rest.map((p) => H.form.map((c) => segD(p, c.a, c.b))));
      out.forEach((pose, i) => {
        if (i % 6) return;
        const { nodes } = rigNodesAt(H.R, pose); const caps = sim.caps(pose);
        H.strings.forEach((st, si) => st.joints.forEach((j, k) => {
          if (k) expect(Math.abs(Math.hypot(...[0, 1, 2].map((a) => nodes[j][a] - nodes[st.joints[k - 1]][a])) - st.lengths[k - 1])).toBeLessThan(0.003);
          expect(nodes[j][2]).toBeGreaterThan(floor - 0.002);
          // inside a capsule only as far as it lay at rest (the form round it as it stood), with a margin for the seam's blend
          // (a joint lying on the floor is squeezed between it and the form: the floor wins)
          if (k && nodes[j][2] > floor + 0.03) caps.forEach((c, ci) => expect(segD(nodes[j], c.a, c.b), `${label} frame ${i} ${j} in ${H.form[ci].bone} (r ${c.r.toFixed(3)}, rest ${restD[si][k][ci].toFixed(3)})`).toBeGreaterThan(Math.min(rAt(c, nodes[j]), restD[si][k][ci]) - 0.02));
        }));
      });
      if (loop) { const a = out[0].flow, b = out[K - 1].flow; for (const k of Object.keys(a)) expect(Math.hypot(...a[k].map((v, x) => v - b[k][x]))).toBeLessThan(0.03); }
    });
  }
});

// THE GARMENTS: a piece flows because its design says so (`rigidity` on the piece or the outfit's language), as a
// CURTAIN of strings round its hanging edge; without it nothing changes; through a jog the skirt's links hold and no
// joint enters the legs (the form round them as it stood at rest).
describe('hero-flow: a garment designed to flow', () => {
  const dress = (bottom) => heroOf({ cast: 'female', head: 'anime', outfit: { type: 'outfit', style: 'sundress', language: { bottom } } });
  const FLOWING = dress({ rigidity: 'flowing', leg: 'midi' }), LOCKED = dress({ leg: 'midi' });
  it('the rigidity rides the part; absent, the part and the rig are as they were', () => {
    expect(FLOWING.recipe.parts.skirt_skirt.rigidity).toBe('flowing');
    expect(LOCKED.recipe.parts.skirt_skirt.rigidity).toBeUndefined();
    const { rigidity: _r, ...rest } = FLOWING.recipe.parts.skirt_skirt; expect(JSON.stringify(rest)).toBe(JSON.stringify(LOCKED.recipe.parts.skirt_skirt));
    expect(flowRig(LOCKED.mesh, LOCKED.recipe, { hair: false }).strings).toHaveLength(0);
    expect(rigidityErrors('silk')).toHaveLength(1); expect(rigidityErrors(0.3)).toHaveLength(0);
    expect(rigidityParams('flowing').stiffness).toBeLessThan(rigidityParams('stiff').stiffness);
  });
  it('a curtain round the skirt, its vertices along it, the form leaving it out; a jog holds its links and keeps out of the legs', () => {
    const F = flowRig(FLOWING.mesh, FLOWING.recipe, { hair: false }); const sk = F.strings.filter((s) => s.part === 'skirt_skirt');
    expect(sk.length).toBeGreaterThanOrEqual(12); for (const st of sk) expect(st.carrier).toBe('pelvis');
    FLOWING.mesh.provenance.forEach((p, i) => { if (p.part === 'skirt_skirt') expect(F.skin.weights[i].reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9); });
    const fn = locomotionClips(motionPlan({ jog: true }), validateRig(FLOWING.recipe.rig)).clips.jog, K = 84;
    const out = simulateClip(F, Array.from({ length: K }, (_, k) => fn(k / K)), 0.7, { air: () => [0, -2.4, 0] });
    const sim = hairSimulation(F); const legs = F.form.map((c, ci) => [c, ci]).filter(([c]) => /^(thigh|shank)/.test(c.bone));
    const restD = sk.map((st) => st.rest.map((p) => F.form.map((c) => segD(p, c.a, c.b))));
    out.forEach((pose, i) => {
      if (i % 7) return; const { nodes } = rigNodesAt(F.R, pose); const caps = sim.caps(pose);
      sk.forEach((st, si) => st.joints.forEach((j, k) => {
        if (!k) return;
        expect(Math.abs(Math.hypot(...[0, 1, 2].map((a) => nodes[j][a] - nodes[st.joints[k - 1]][a])) - st.lengths[k - 1])).toBeLessThan(0.003);
        for (const [, ci] of legs) expect(segD(nodes[j], caps[ci].a, caps[ci].b), `jog ${i} ${j} in ${F.form[ci].bone}`).toBeGreaterThan(Math.min(rAt(caps[ci], nodes[j]), restD[si][k][ci]) - 0.02);
      }));
    });
  });
});
