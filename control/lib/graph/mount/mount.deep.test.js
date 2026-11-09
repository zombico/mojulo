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

// the tack over every pose the clips make, against the body as the export renders it (LBS and its correctives)
describe('the mount\'s tack', () => {
  it('no piece under the rendered skin in any pose', async () => {
    const { tackPieces, tackSkin, tackGates } = await import('./tack.js'), { skinContext, correctiveCorpus, correctiveKeys, fitCorrectives, applyCorrectives, bindDeltas } = await import('./correctives.js');
    const { bodyMesh: mesh } = await import('./body.js'), { boneFrames: bf } = await import('./skin.js');
    const B = resolveMount('horse'), m = mesh(B, { cells: 40 }), ctx = skinContext(B, m), corpus = correctiveCorpus(B, { phases: 8, jumpSamples: 12 }).map((c) => c.frames);
    const set = fitCorrectives(ctx, correctiveKeys(ctx, { corpus }), corpus.filter((_, i) => i % 2 === 0)), pcs = tackPieces(B);
    const rest = bf(B, standPose(B)), g = tackGates(m, pcs, tackSkin(pcs, m), corpus, { rest, skinAt: (pose) => applyCorrectives(ctx, set, pose), deltaAt: (pose) => bindDeltas(set, rest, pose) });
    expect(g.checks.filter((c) => !c.pass).map((c) => c.saw)).toEqual([]);
  }, 900000);
});

// the rider seated (the realistic hero, minted: some forty seconds): the sit bones on the saddle's seat, the knee at the
// halt's angle, the balls of the feet on the irons (hung round the barrel), the knees outside the horse
describe('the rider on the mount', () => {
  it('sits the classical seat at the halt', async () => {
    const { heroRecord, expandLayeredManifest } = await import('../../mcp/tools/layered.js');
    const { validateRig, rigNodesAt } = await import('../polygonizer/station-loft-rig.js');
    const { tackPieces } = await import('./tack.js'), { ridingGeometry, riderSeat, riderPose, RIDER_MODES, KNEE } = await import('./rider.js');
    const { bodyField } = await import('./body.js'), { boneFrames: bf } = await import('./skin.js');
    const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe, H = { R: { ...validateRig(recipe.rig), reach: 'clamp' } };
    const B = resolveMount('horse'), F = bodyField(B), rest = bf(B, standPose(B)), geo = ridingGeometry(tackPieces(B, { reins: false }).anchors, rest, rest);
    const cal = riderSeat(H, geo, (p) => F.field(p)), r = riderPose(H, cal, geo, RIDER_MODES.sit), n = rigNodesAt(H.R, r.pose).nodes, R = H.R;
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const S of ['R', 'L']) {
      const L = R.legs[S], a = n[L.hip].map((x, i) => x - n[L.knee][i]), b = n[L.hock].map((x, i) => x - n[L.knee][i]);
      expect(Math.abs(Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b))) * 180 / Math.PI - KNEE)).toBeLessThan(2);
      expect(d(n[L.toeBase], r.contacts.irons[S])).toBeLessThan(0.02);
      expect(F.field(n[L.knee])).toBeGreaterThan(0);
    }
    // the sit bones: the pelvis hub a sit bone's depth over the seat, upright
    expect(Math.abs(n.pelvisHub[2] - (geo.seat[2] + 0.1))).toBeLessThan(0.02);
    expect(n.headTop[2] - n.pelvisHub[2]).toBeGreaterThan(0.75);
    // the head held up in every seat (the rider sees where it goes), within what the neck extends; the arms by the rule:
    // the upper arm where the seat sets it, the forearm aimed at the bit (the elbow, the fist and the bit near one line)
    const { NECK } = await import('./rider.js');
    for (const [name, mode] of Object.entries(RIDER_MODES)) {
      const q = riderPose(H, cal, geo, mode), nn = rigNodesAt(H.R, q.pose).nodes, u = nn.headTop.map((x, i) => x - nn.headBase[i]);
      expect(Math.atan2(u[1], u[2]) * 180 / Math.PI, name).toBeLessThan(NECK.tilt + 1);
      expect(q.pose.neck.pitch).toBeLessThanOrEqual(NECK.neck); expect(q.pose.head.pitch).toBeLessThanOrEqual(NECK.head);
      for (const S of ['R', 'L']) {
        // (the posed forearm itself: the elbow is a hinge, so it points at the bit within its plane's reach)
        const e = nn[`elbow${S}`], f1 = nn[`wrist${S}`].map((x, i) => x - e[i]), f2 = geo.bits[S].map((x, i) => x - e[i]);
        // (not over the fence: the fold's hands press on the crest, the release that breaks the line by design)
        if (name !== 'fold') expect(Math.acos(Math.min(1, (f1[0] * f2[0] + f1[1] * f2[1] + f1[2] * f2[2]) / (Math.hypot(...f1) * Math.hypot(...f2)))) * 180 / Math.PI, `${name} ${S}`).toBeLessThan(20);
        expect(d(e, q.contacts.elbows[S])).toBeLessThan(0.03);
      }
    }
  }, 600000);
});

// a character put on the horse (the rider is a function: here the realistic hero, any the studio makes would do): its
// clips keyed on the horse's own keys under the same names, its sit bones on the seat's socket, the reins from the bits
// to its fists
describe('a character on the mount', () => {
  it('rides the trot on the horse\'s keys, the reins in its fists', async () => {
    const { heroRecord, expandLayeredManifest } = await import('../../mcp/tools/layered.js');
    const { validateRig, rigNodesAt } = await import('../polygonizer/station-loft-rig.js');
    const { tackPieces } = await import('./tack.js'), { riderSeat, rideCharacter, rideSockets, reinRig, ridingGeometry } = await import('./rider.js');
    const { mountClips } = await import('./export.js'), { bodyField } = await import('./body.js'), { boneFrames: bf } = await import('./skin.js');
    const { ischOf } = await import('../polygonizer/hero-rest.js');
    const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic' }) }).recipe, H = { R: { ...validateRig(recipe.rig), reach: 'clamp' } };
    const B = resolveMount('horse'), F = bodyField(B), rest = bf(B, standPose(B)), anchors = tackPieces(B, { reins: false }).anchors;
    const cal = riderSeat(H, ridingGeometry(anchors, rest, rest), (p) => F.field(p)), clips = mountClips(B, { names: ['trot'], ridden: true });
    const rc = rideCharacter(B, H, clips, { anchors, cal, rest }), r = rc.trot;
    expect(r.K).toBe(Math.round(clips.trot.s * 30));
    const sockets = rideSockets(anchors, rest, cal), d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    for (const k of [0, Math.floor(r.K / 2)]) {
      const n = rigNodesAt(H.R, r.poses[k]).nodes, seat = sockets.keys(r.targets[k], r.geos[k], bf(B, clips.trot.at(clips.trot.s * k / r.K)))[1].h;
      // (the sit bones: the pelvis hub's offset, turned with the pelvis; within a couple of centimetres of the socket)
      const isch = ischOf(H.R), hub = n.pelvisHub, sb = [hub[0] + isch[0], hub[1] + isch[1], hub[2] + isch[2]];
      expect(d(sb, seat)).toBeLessThan(0.04);
      const reins = reinRig(anchors.bits, r.fists[0], 0.9), keys = reins.keys(r.geos[k].bits, r.fists[k]);
      expect(d(keys[0].h, r.geos[k].bits.R)).toBeLessThan(1e-9);
    }
  }, 600000);
});

// getting on and off (rider.js mountKeys / mountPose, a game's mount and dismount): from standing on the ground at the near
// shoulder (mountStand) to the halt's riding pose exactly, and back; the near foot in the let-down iron while it springs
// up; and the game's poses lowered by a pack's lift land where they were solved (mount/game.js lowered)
describe('a character getting on and off', () => {
  it('stands at the near side, ends in the riding pose, and comes down to stand again', async () => {
    const { heroRecord, expandLayeredManifest } = await import('../../mcp/tools/layered.js');
    const { validateRig, rigNodesAt } = await import('../polygonizer/station-loft-rig.js');
    const { tackPieces } = await import('./tack.js'), { riderSeat, riderPose, mountPose, mountKeys, mountStand, ridingGeometry, RIDER_MODES, MOUNTING } = await import('./rider.js');
    const { bodyField } = await import('./body.js'), { boneFrames: bf } = await import('./skin.js'), { carriageOf, riddenFrame } = await import('./ridden.js');
    const { lowered } = await import('./game.js');
    const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic' }) }).recipe, H = { R: { ...validateRig(recipe.rig), reach: 'clamp' } };
    const B = resolveMount('horse'), rest = bf(B, standPose(B)), anchors = tackPieces(B, { reins: false }).anchors;
    const near = (q) => Math.hypot(q.c[0] - anchors.seat[0], q.c[1] - anchors.seat[1], q.c[2] - anchors.seat[2]) < 1 + (q.R ?? 0), F = bodyField(B, { only: near });
    const cal = riderSeat(H, ridingGeometry(anchors, rest, rest), (p) => F.field(p));
    const geo = ridingGeometry(anchors, bf(B, riddenFrame(standPose(B), carriageOf(standPose(B)))), rest), st = mountStand(geo);
    const R = H.R, toes = (n) => ['R', 'L'].map((S) => n[R.legs[S].toeBase]), d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (const way of ['mount', 'dismount']) {
      const keys = mountKeys(H, cal, geo, way), standU = way === 'mount' ? 0 : 1 - 1e-9, rideU = way === 'mount' ? 1 : 0;
      // standing: the hub over the stand point, both toes on the ground
      const n0 = rigNodesAt(R, mountPose(H, cal, geo, way, standU, { keys }).pose).nodes;
      expect(d2(n0.pelvisHub, st.at)).toBeLessThan(0.03);
      for (const t of toes(n0)) expect(Math.abs(t[2] - R.joints[R.legs.R.toeBase][2])).toBeLessThan(0.03);
      // riding: the halt's riding pose itself
      expect(mountPose(H, cal, geo, way, rideU, { keys }).pose).toEqual(riderPose(H, cal, geo, RIDER_MODES.sit).pose);
    }
    // getting on: the near foot in the let-down iron while it springs (a fifth to three fifths of the way)
    const keys = mountKeys(H, cal, geo, 'mount'), iron = riderPose(H, cal, geo, RIDER_MODES.sit).contacts.irons.L;
    for (const u of [0.25, 0.42, 0.55]) {
      const n = rigNodesAt(R, mountPose(H, cal, geo, 'mount', u, { keys }).pose).nodes, t = n[R.legs.L.toeBase];
      expect(Math.hypot(t[0] - iron[0], t[1] - iron[1], t[2] - (iron[2] - MOUNTING.letDown))).toBeLessThan(0.06);
    }
    // a pose lowered by a pack's lift lands, lifted, where it was solved
    const p = riderPose(H, cal, geo, RIDER_MODES.sit).pose, a = rigNodesAt(R, p).nodes, b = rigNodesAt(R, lowered(p, 0.07)).nodes;
    for (const j of ['pelvisHub', 'headTop', R.legs.L.toeBase, 'wristR']) for (let q = 0; q < 3; q++) expect(b[j][q] + (q === 2 ? 0.07 : 0)).toBeCloseTo(a[j][q], 5);
  }, 600000);
});
