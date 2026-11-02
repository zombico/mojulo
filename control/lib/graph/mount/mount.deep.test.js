import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { gaitCycle } from './gait.js';
import { gaitGates, shotGates, jumpGates, idleGates } from './gates.js';
import { idleLayer, idleClip, grazeClip, IDLE_LAYERS } from './idle.js';
import { jumpClip } from './jump.js';
import { oneShot } from './motion.js';
import { standPose } from './gait.js';
import { GAITS } from './reference.js';
import { REGISTERS } from './cards.js';
import { simulateHair } from './hair.js';
import { bodyMesh } from './body.js';
import { skinContext, correctiveKeys, correctiveCorpus, fitCorrectives, correctiveGates } from './correctives.js';

// The deep sweep: every gait at both ends of its speed band, on both leads where it has one, in every register, held to
// the machine gate (the joint ranges are the preferred speed's, so they are checked in mount.test.js, not here).
describe('the mount at its speed bands\' ends', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register });
    for (const [gait, spec] of Object.entries(GAITS)) for (const v of spec.speed) for (const lead of spec.symmetric ? ['right'] : ['right', 'left']) {
      it(`${register} ${gait} at ${v} m/s, ${lead} lead`, () => {
        const r = gaitGates(B, gaitCycle(B, gait, { speed: v * Math.sqrt(B.scale), lead }));
        expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
  }
});

// every one-shot, every register, both leads where a canter or gallop is in it, held to the one-shot machine gate
const SHOTS = [['stand', 'walk'], ['walk', 'trot'], ['trot', 'walk'], ['trot', 'canter'], ['canter', 'trot'], ['canter', 'gallop'], ['gallop', 'canter'], ['walk', 'stand'], ['trot', 'stand']];
describe('the mount\'s one-shots', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register }), stand = standPose(B);
    for (const [from, to] of SHOTS) for (const lead of [from, to].some((g) => GAITS[g] && !GAITS[g].symmetric) ? ['right', 'left'] : ['right']) {
      it(`${register} ${from} → ${to}, ${lead} lead`, () => {
        const r = shotGates(B, oneShot(B, { from, to, lead }), { stand });
        expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
  }
});

// the jump over uprights of three heights and an oxer, both leads (the realistic register: the stylized one's jump is a
// recorded gap, its margins a centimetre or two short at the rail and the ground)
describe('the mount\'s jumps', () => {
  const B = resolveMount('horse'), stand = standPose(B);
  for (const [fence, spread] of [[0.8, 0], [1.1, 0], [1.3, 0], [1.1, 1.2]]) for (const lead of ['right', 'left']) {
    it(`${fence} m${spread ? ` × ${spread} m` : ''}, ${lead} lead`, () => {
      const r = jumpGates(B, jumpClip(B, { fence, spread, lead }), { stand });
      expect(r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
    });
  }
});

// every idle layer as its own loop, the layers together, and grazing, in every register
describe('the mount at rest', () => {
  for (const register of Object.keys(REGISTERS)) {
    const B = resolveMount('horse', { register });
    for (const name of Object.keys(IDLE_LAYERS)) {
      it(`${register} layer ${name}`, () => {
        expect(idleGates(B, idleLayer(B, name, { seed: 3 }), { loop: true }).checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
      });
    }
    it(`${register} every layer together, and grazing`, () => {
      for (const clip of [idleClip(B, { seed: 3 }), grazeClip(B, { seed: 3 })]) expect(idleGates(B, clip).checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
    });
  }
});

// the hair's swing through a cycle: its strands keep their lengths, the loop closes on itself exactly, nothing falls through
// the ground
describe('the mount\'s hair', () => {
  const B = resolveMount('horse');
  for (const gait of ['trot', 'gallop']) {
    it(`through a ${gait} stride`, () => {
      const c = gaitCycle(B, gait), h = simulateHair(B, (t) => c.poseAt(t / c.T), { t0: 0, t1: c.T, fps: 60, loop: true });
      let err = 0, low = Infinity;
      for (const S of h.strands) S.forEach((s, gi) => { const g = h.guides[gi], seg = g.len / (g.n - 1); for (let i = 1; i < s.length; i++) { err = Math.max(err, Math.abs(Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1], s[i][2] - s[i - 1][2]) - seg) / seg); low = Math.min(low, s[i][2]); } });
      expect(err).toBeLessThan(1e-9);
      expect(low).toBeGreaterThan(0);
      const a = h.strands[0], b = h.strands[h.strands.length - 1];
      expect(Math.max(...a.flatMap((s, gi) => s.map((p, i) => Math.hypot(p[0] - b[gi][i][0], p[1] - b[gi][i][1], p[2] - b[gi][i][2]))))).toBeLessThan(1e-9);
    });
  }
});

// the folds: the one-joint keys refit over the clips' poses (every other one), held to the machine gate on the poses the
// fit never saw: nearer the oracle than LBS (median and worst), the volume no worse, an absent corrective adding nothing
describe('the mount\'s folds', () => {
  it('the correctives on held-out poses', () => {
    const B = resolveMount('horse'), ctx = skinContext(B, bodyMesh(B, { cells: 40 }));
    const corpus = correctiveCorpus(B, { phases: 8, jumpSamples: 12 }), train = corpus.filter((_, i) => i % 2 === 0), test = corpus.filter((_, i) => i % 2 === 1);
    const set = fitCorrectives(ctx, correctiveKeys(ctx, { corpus: corpus.map((c) => c.frames) }), train.map((c) => c.frames));
    const g = correctiveGates(ctx, set, test.map((c) => c.frames));
    expect(g.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw}`)).toEqual([]);
  }, 600000);
});

// the hair baked for an engine: a transition's swing picks up the hair as the gait it leaves had it (its first key near
// that gait's loop at the entry phase, where a cold start hangs it still), and the chains follow the strands they ride
describe('the mount\'s baked hair', () => {
  it('a transition starts the hair in motion; the chains follow their strands', async () => {
    const { gaitCycle: cyc } = await import('./gait.js'), { oneShot: shot } = await import('./motion.js'), { boneFrames: bf } = await import('./skin.js');
    const { hairRig, bakeHairClip, hairJointKeys } = await import('./hair-bake.js'), { mountClips } = await import('./export.js');
    const B = resolveMount('horse'), rig = hairRig(B), c = mountClips(B, { names: ['trot-canter'] })['trot-canter'];
    const sh = shot(B, { from: 'trot', to: 'canter' }), tr = cyc(B, 'trot'), T = 1 / tr.f, K = Math.round(c.s * 30) + 1, S = bakeHairClip(B, rig, c, K);
    const n = 60, loop = simulateHair(B, (t) => tr.poseAt(t / T), { t0: 0, t1: T, fps: n / T, loop: true }).strands[Math.round(sh.entry.phase * n) % n];
    let sum = 0, cnt = 0;
    S[0].forEach((st, gi) => st.forEach((p, i) => { sum += Math.hypot(...p.map((x, q) => x - loop[gi][i][q])); cnt++; }));
    expect(sum / cnt).toBeLessThan(0.02);
    const tip = (k) => S[k].map((st) => st[st.length - 1]);
    expect(Math.max(...tip(0).map((p, i) => Math.hypot(...p.map((x, q) => x - tip(1)[i][q]))))).toBeGreaterThan(0.01);   // moving at its first key
    // each strand point skinned on its chain against the simulated one: the heads exact, the points between near
    const rest = bf(B, standPose(B)), errs = [];
    for (let k = 0; k < K; k += 6) {
      const keys = hairJointKeys(rig, S[k], bf(B, c.at(c.s * k / (K - 1))), rest);
      rig.rest.forEach((st, gi) => st.forEach((v, i) => { const [[j]] = rig.skin([gi, i]), J = rig.joints[j], d = v.map((x, q) => x - J.head[q]), R = keys[j].R; errs.push(Math.hypot(...[0, 1, 2].map((a) => keys[j].h[a] + R[a][0] * d[0] + R[a][1] * d[1] + R[a][2] * d[2] - S[k][gi][i][a]))); }));
    }
    errs.sort((a, b) => a - b);
    expect(errs[Math.floor(errs.length * 0.5)]).toBeLessThan(0.01);
    expect(errs[Math.floor(errs.length * 0.95)]).toBeLessThan(0.035);
  }, 300000);
});
