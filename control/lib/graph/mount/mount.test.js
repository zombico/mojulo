import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { gaitCycle, standPose, strideOf, swingPath, bump } from './gait.js';
import { gaitGates, shotGates, jumpGates, idleGates } from './gates.js';
import { restState, idleLayer, idleClip, grazeClip, herdOffset, IDLE_LAYERS, PHI } from './idle.js';
import { bodyMesh } from './body.js';
import { boneFrames, skinPose, skinMeasures } from './skin.js';
import { coatColor, COATS } from './coats.js';
import { hairGuides, hairCards } from './hair.js';
import { bodyField } from './body.js';
import { jumpClip } from './jump.js';
import { oneShot } from './motion.js';
import { MOUNT_BONES } from './pose.js';
import { GAITS, HIP } from './reference.js';
import { legRig, SWING_CLOSE } from './legs.js';
import { skinContext, implicitSkin, DRIVERS, jointAngle, bendJoint, correctiveKeys, correctiveWeights, applyCorrectives, fitCorrectives } from './correctives.js';

// The mount's machine gate, one case per procedure: a gait always on the ground (the walk: the girdles' swaying vault),
// a gait with a lead and one suspension (the canter: the constant vault, a flight at g), and the stylized register (the
// same mechanics on other legs, by dynamic similarity). The whole speed bands, both leads and both registers are swept
// in mount.deep.test.js. How it LOOKS is the eyes gate (scripts/mount-study.mjs, the contact sheet), never claimed here.
const DEG = 180 / Math.PI;
const gate = (B, g, o) => gaitGates(B, gaitCycle(B, g, o));
const failures = (r) => r.checks.filter((c) => !c.pass).map((c) => `${c.name}: ${c.saw} (want ${c.want})`);

describe('the mount: a horse', () => {
  const B = resolveMount('horse');

  it('stands as a horse stands: cannons plumb, the joints at their standing angles, no clamp', () => {
    const { fore, hind } = B.stand;
    expect(fore.clamped || hind.clamped).toBe(false);
    expect(Math.abs(fore.cannon * DEG + 90)).toBeLessThan(6);
    expect(Math.abs(hind.cannon * DEG + 90)).toBeLessThan(6);
    expect(fore.angles.shoulder * DEG).toBeGreaterThan(95); expect(fore.angles.shoulder * DEG).toBeLessThan(120);
    expect(fore.angles.elbow * DEG).toBeGreaterThan(125); expect(fore.angles.elbow * DEG).toBeLessThan(155);
    expect(hind.angles.stifle * DEG).toBeGreaterThan(130); expect(hind.angles.stifle * DEG).toBeLessThan(155);
    expect(hind.angles.hock * DEG).toBeCloseTo(150, 0);
    expect(B.share.fore).toBeGreaterThan(0.55); expect(B.share.fore).toBeLessThan(0.6);
  });

  it('the rig: parent-first, under the engines\' bone budget, every bone posed in every frame', () => {
    const seen = new Set();
    for (const b of MOUNT_BONES) { if (b.parent) expect(seen.has(b.parent), b.id).toBe(true); seen.add(b.id); }
    expect(MOUNT_BONES.length).toBeLessThanOrEqual(64);
    const f = standPose(B);
    for (const b of MOUNT_BONES) expect(f.bones[b.id].head.concat(f.bones[b.id].tail).every(Number.isFinite), b.id).toBe(true);
    expect(f.bones.saddle && f.bones.bit).toBeTruthy();                // the tack's sockets, there from the start
  });

  it('the walk: four beats, never airborne, the girdles vaulting; every machine check passes', () => {
    const r = gate(B, 'walk');
    expect(failures(r)).toEqual([]);
    expect(r.measured.aerial).toBe(0);
  });

  it('the canter: three beats on a lead, one suspension falling at g; the left lead mirrors the right', () => {
    const right = gate(B, 'canter'), left = gate(B, 'canter', { lead: 'left' });
    expect(failures(right)).toEqual([]);
    expect(failures(left)).toEqual([]);
    for (const [r, l] of [['LH', 'RH'], ['RF', 'LF']]) expect(left.measured.down[l]).toBeCloseTo(right.measured.down[r], 6);
  });

  it('from the front: the track narrows as it quickens, the walk sways toward its standing side, the trot holds its line', () => {
    const walk = gate(B, 'walk'), trot = gate(B, 'trot');
    const toeX = (g) => Math.abs(gaitCycle(B, g).poseAt(0).bones.hoofHL.tail[0]);
    expect(toeX('gallop')).toBeLessThan(toeX('trot'));
    expect(toeX('trot')).toBeLessThan(toeX('walk'));
    expect(walk.measured.lateral.sway).toBeGreaterThan(0.02);                 // a few centimetres at the walk
    expect(trot.measured.lateral.sway).toBeLessThan(walk.measured.lateral.sway / 3);   // the diagonals cancel
    expect(walk.measured.lateral.rollH).toBeGreaterThan(2);                   // the hip drops over the swinging hind
  });

  it('is deterministic: the same stride twice is the same numbers', () => {
    const a = gaitCycle(B, 'trot').poseAt(0.37), b = gaitCycle(resolveMount('horse'), 'trot').poseAt(0.37);
    expect(JSON.stringify(a.bones)).toBe(JSON.stringify(b.bones));
  });
});

describe('the stylized register: the same mechanics on its own legs', () => {
  const R = resolveMount('horse'), S = resolveMount('horse', { register: 'stylized' });

  it('strides by dynamic similarity: at the same Froude number, stride ∝ leg and frequency ∝ 1/√leg', () => {
    const vR = GAITS.trot.preferred, vS = vR * Math.sqrt(S.scale);
    const a = strideOf(R, 'trot', vR), b = strideOf(S, 'trot', vS);
    expect(b.L / a.L).toBeCloseTo(S.scale, 6);
    expect(b.f / a.f).toBeCloseTo(1 / Math.sqrt(S.scale), 6);
    expect(b.duty).toBeCloseTo(a.duty, 9);
  });

  it('its trot passes the same machine checks (its flight exaggerated by design, so not held to g)', () => {
    expect(failures(gate(S, 'trot'))).toEqual([]);
  });
});

describe('the swing\'s pieces', () => {
  it('swingPath leaves and arrives with the given velocities and stays between its ends when they are still', () => {
    const h = 1e-6;
    expect((swingPath(0, 2, 1, -3, h) - swingPath(0, 2, 1, -3, 0)) / h).toBeCloseTo(2, 3);
    expect((swingPath(0, 2, 1, -3, 1) - swingPath(0, 2, 1, -3, 1 - h)) / h).toBeCloseTo(-3, 3);
    for (let v = 0; v <= 1; v += 0.05) { const p = swingPath(0, 0, 1, 0, v); expect(p).toBeGreaterThanOrEqual(-1e-12); expect(p).toBeLessThanOrEqual(1 + 1e-12); }
  });

  it('bump is 0 at its ends and 1 at its peak', () => {
    expect(bump(0, 0.4)).toBe(0); expect(bump(1, 0.4)).toBe(0);
    expect(bump(0.4, 0.4)).toBeCloseTo(1, 9);
  });
});

describe('the one-shots: a change, a halt, a move off', () => {
  const B = resolveMount('horse'), stand = standPose(B);
  const shot = (o) => shotGates(B, oneShot(B, o), { stand });

  it('a change (trot to canter): the footfalls shift by the warp, its seams are the two cycles\' poses, every check passes', () => {
    const c = oneShot(B, { from: 'trot', to: 'canter' });
    expect(failures(shotGates(B, c, { stand }))).toEqual([]);
    expect(c.exit.phase).toBeCloseTo(0, 6);                                // it closes on a whole stride of the canter
    expect(c.rootAt(c.duration)).toBeGreaterThan(0);                      // the root travels: the clip carries it
  });

  it('a halt (walk to the stand): the last landings are the standing spots, the clip closes on the stand', () => {
    const c = oneShot(B, { from: 'walk', to: 'stand' });
    expect(failures(shotGates(B, c, { stand }))).toEqual([]);
    const end = c.poseAt(c.duration);
    expect(Object.values(end.contact).every(Boolean)).toBe(true);
  });

  it('a move off (the stand to the walk): the hooves leave their spots in the walk\'s order, a hind first', () => {
    const c = oneShot(B, { from: 'stand', to: 'walk' });
    expect(failures(shot({ from: 'stand', to: 'walk' }))).toEqual([]);
    const first = ['LF', 'RF', 'LH', 'RH'].map((id) => [id, c.stances[id][0].off]).sort((a, b) => a[1] - b[1]);
    expect(first[0][0][1]).toBe('H');
  });
});

describe('the jump', () => {
  const B = resolveMount('horse'), stand = standPose(B);

  it('an upright from the canter to the canter: a flight at g over the rail, every leg clear, the seams the canter\'s', () => {
    const c = jumpClip(B, { fence: 1.1 });
    expect(failures(jumpGates(B, c, { stand }))).toEqual([]);
    const f = c.poseAt(c.flight.apex);
    expect(Object.values(f.contact).some(Boolean)).toBe(false);              // airborne at the apex
    expect(f.body.z).toBeGreaterThan(1.1 + 0.5);                              // the body well over the rail
  });

  it('the tuck folds at the stifle and the hock, not the hip: the hip in its range, in the air the stifle no closer than a swing\'s', () => {
    const rig = legRig(B), c = jumpClip(B, { fence: 1.1 });
    expect(rig.hipFlex({ pair: 'hind', side: 1, x: B.hind.hoofX }, stand.body, B.stand.hind.angles.femur, B.hind.hoofX)).toBeCloseTo(0, 9);
    let hip = -Infinity, stifle = 0;
    for (let i = 0; i <= 240; i++) {
      const f = c.poseAt(c.duration * i / 240);
      for (const [k, side] of [['LH', -1], ['RH', 1]]) {
        const L = f.legs[k];
        hip = Math.max(hip, rig.hipFlex({ pair: 'hind', side, x: L.plane.xh }, f.body, L.solve.angles.femur, L.plane.xh) * DEG);
        const t = c.duration * i / 240;
        if (t > c.flight.launch && t < c.flight.touchdown) stifle = Math.max(stifle, L.solve.stifleFlex);   // (the tuck: in the air)
      }
    }
    expect(hip).toBeLessThanOrEqual(HIP.flex + 0.5);
    expect(hip).toBeGreaterThan(HIP.flex - 2 * HIP.knee);                     // and it does tuck: the hip near its range
    expect(stifle).toBeLessThanOrEqual(Math.PI - SWING_CLOSE.stifle + 1e-9);
  });

  it('a higher fence flies higher and longer; a spread one longer still', () => {
    const lo = jumpClip(B, { fence: 0.8 }), hi = jumpClip(B, { fence: 1.3 }), ox = jumpClip(B, { fence: 1.1, spread: 1.2 }), up = jumpClip(B, { fence: 1.1 });
    expect(hi.flight.vz).toBeGreaterThan(lo.flight.vz);
    expect(hi.flight.distance).toBeGreaterThan(lo.flight.distance);
    expect(ox.flight.distance).toBeGreaterThan(up.flight.distance);
  });
});

describe('at rest', () => {
  const B = resolveMount('horse');

  it('resting a hind: its toe planted where it stood, its hip dropped, the other hind carrying it', () => {
    const sq = restState(B), r = restState(B, { restHind: 'L', rest: 1 });
    expect(r.bones.hoofHL.tail).toEqual(sq.bones.hoofHL.tail);              // the toe never moves
    expect(r.bones.femurL.head[2]).toBeLessThan(r.bones.femurR.head[2]);   // the left hip lower
    const ext = (f, id) => f.legs[id].distal.pastern - f.legs[id].solve.cannon;
    expect(ext(r, 'RH')).toBeGreaterThan(ext(sq, 'RH'));                   // the right fetlock sinks under the weight
  });

  it('grazing: the muzzle meets the grass, every hoof where it stood', () => {
    const g = restState(B, { graze: 1 }), sq = restState(B);
    expect(g.points.muzzle[2]).toBeCloseTo(0.03, 2);
    for (const id of ['hoofFL', 'hoofFR', 'hoofHL', 'hoofHR']) expect(g.bones[id].tail).toEqual(sq.bones[id].tail);
    expect(failures(idleGates(B, grazeClip(B)))).toEqual([]);
  });

  it('a layer loops exactly; the layers\' loops step by φ; a herd is never in step', () => {
    expect(failures(idleGates(B, idleLayer(B, 'weight'), { loop: true }))).toEqual([]);
    expect(IDLE_LAYERS.ears / IDLE_LAYERS.tail).toBeCloseTo(PHI, 9);
    expect(IDLE_LAYERS.head / IDLE_LAYERS.ears).toBeCloseTo(PHI, 9);
    const offs = Array.from({ length: 12 }, (_, i) => herdOffset(i, 1)).sort((a, b) => a - b);
    for (let i = 1; i < offs.length; i++) expect(offs[i] - offs[i - 1]).toBeGreaterThan(0.02);
  });
});

describe('the body', () => {
  const B = resolveMount('horse'), m = bodyMesh(B, { cells: 48 }), rest = boneFrames(B, standPose(B));

  it('is one closed skin, every vertex on at most four of the rig\'s bones, its weights summing to one', () => {
    expect(m.stats.open).toBe(0);
    const bones = new Set(MOUNT_BONES.map((b) => b.id));
    for (const w of m.weights) {
      expect(w.length).toBeGreaterThan(0); expect(w.length).toBeLessThanOrEqual(4);
      expect(Math.abs(w.reduce((s, [, x]) => s + x, 0) - 1)).toBeLessThan(1e-9);
      for (const [bone] of w) expect(bones.has(bone), bone).toBe(true);
    }
  });

  it('a vertex never follows the other side\'s limbs', () => {
    for (let i = 0; i < m.vertices.length; i++) {
      const sides = new Set(m.weights[i].map(([b]) => (/^(scapula|humerus|radius|cannon|pastern|hoof|femur|tibia)/.test(b) ? b.slice(-1) : null)).filter(Boolean));
      expect(sides.size).toBeLessThanOrEqual(1);
    }
  });

  it('skinned into the stand it is its rest; into a trot it keeps its volume and most of its edges', () => {
    const still = skinPose(m, rest, boneFrames(B, standPose(B)));
    expect(Math.max(...still.map((v, i) => Math.hypot(v[0] - m.vertices[i][0], v[1] - m.vertices[i][1], v[2] - m.vertices[i][2])))).toBeLessThan(1e-9);
    const s = skinMeasures(m, skinPose(m, rest, boneFrames(B, gaitCycle(B, 'trot').poseAt(0.25))));
    expect(Math.abs(s.volume - 1)).toBeLessThan(0.06);
    expect(s.stretch.p05).toBeGreaterThan(0.8); expect(s.stretch.p95).toBeLessThan(1.3);
  });

  it('a coat is a card: its points, its markings', () => {
    const p = [0, 0, 1];
    expect(coatColor('bay', 'points', p)).toBe(COATS.bay.points);
    expect(coatColor('chestnut', 'mane', p)).toBe(COATS.chestnut.mane);
    const sock = m.stand.bones.hoofHL.head;                                   // just over the hoof of the left hind
    expect(coatColor('bay', 'points', [sock[0], sock[1], sock[2] + 0.03], { stand: m.stand, markings: { sock: ['LH'] } })).toBe('#f2efe8');
    expect(coatColor('bay', 'points', [-sock[0], sock[1], sock[2] + 0.03], { stand: m.stand, markings: { sock: ['LH'] } })).toBe(COATS.bay.points);
  });
});

describe('the hair', () => {
  const B = resolveMount('horse');

  it('its guides: a mane along the crest falling to the off side, a forelock, a tail round the dock, each rooted on the skin', () => {
    const g = hairGuides(B), { field } = bodyField(B);
    for (const kind of ['mane', 'forelock', 'tail']) expect(g.some((x) => x.kind === kind), kind).toBe(true);
    for (const x of g) expect(Math.abs(field(x.root)), x.id).toBeLessThan(0.002);
    for (const x of g.filter((y) => y.kind === 'mane')) expect(x.dir[0]).toBeGreaterThan(0);          // the off (right) side
  });

  it('its cards: a two-sided ribbon of quads along every strand, a guide\'s cards side by side', () => {
    const g = hairGuides(B), strands = g.map((x) => Array.from({ length: x.n }, (_, i) => [x.root[0] + x.dir[0] * x.len * i / (x.n - 1), x.root[1] + x.dir[1] * x.len * i / (x.n - 1), x.root[2] + x.dir[2] * x.len * i / (x.n - 1)]));
    const c = hairCards(g, strands);
    expect(c.quads.length).toBe(g.reduce((s, x) => s + x.cards.length * (x.n - 1), 0));
    expect(c.twoSided.every(Boolean)).toBe(true);
  });
});

// the folds: the posed field (the masses carried, re-blended), a span (a muscle between two bones), a joint bent alone,
// the keys' weights and their bind space; one driver, a small skin (how much nearer the oracle the keys bring it, over
// the clips' poses, is mount.deep.test.js's)
describe('the folds', () => {
  const B = resolveMount('horse'), m = bodyMesh(B, { cells: 36 }), ctx = skinContext(B, m), F = ctx.F;
  const elbow = DRIVERS.find((d) => d.id === 'elbowR');

  it('the posed field at the stand is the field; a span keeps its volume as it stretches', () => {
    const at = F.posed(ctx.rest, ctx.rest);
    for (const v of m.vertices.slice(0, 300)) expect(Math.abs(at(v) - F.field(v))).toBeLessThan(1e-12);
    // the triceps, the scapula to the elbow's point: the elbow bent one way it stretches and thins, the other it shortens and bulges, its volume kept
    const q = F.prims.find((p) => p.span?.[0] === 'scapulaR' && p.span[1] === 'radiusR');
    expect(q).toBeTruthy();
    const spanAt = (a) => F.posed(ctx.rest, bendJoint(ctx.rest, elbow, a)).spans[F.prims.indexOf(q)];
    const long = spanAt(0.4), short = spanAt(-0.4), e = short;
    expect(long.r[0]).toBeGreaterThan(q.r[0] * 1.02); expect(long.r[1]).toBeLessThan(q.r[1]);       // stretched: thinner
    expect(short.r[0]).toBeLessThan(q.r[0] * 0.98); expect(short.r[1]).toBeGreaterThan(q.r[1]);     // shortened: it bulges
    for (const s2 of [long, short]) expect(s2.r[0] * s2.r[1] * s2.r[2]).toBeCloseTo(q.r[0] * q.r[1] * q.r[2], 12);
    // its poles each where its own bone carried them
    const lo = q.c.map((x, i) => x - q.ax[0][i] * q.r[0]), loP = e.c.map((x, i) => x - e.ax[0][i] * e.r[0]);
    expect(Math.hypot(...lo.map((x, i) => x - loP[i]))).toBeLessThan(1e-12);   // the scapula did not move
  });

  it('a joint bent alone: its angle is the bend, only its subtree moves', () => {
    for (const a of [-0.6, 0.3, 1.1]) {
      const pose = bendJoint(ctx.rest, elbow, a);
      expect(Math.abs(jointAngle(ctx.rest, pose, elbow) - a)).toBeLessThan(1e-9);
      expect(pose.humerusR).toBe(ctx.rest.humerusR);
      expect(pose.radiusR).not.toBe(ctx.rest.radiusR);
      expect(Math.hypot(...pose.radiusR.h.map((x, i) => x - ctx.rest.radiusR.h[i]))).toBeLessThan(1e-12);   // about its own head
      expect(Math.abs(jointAngle(ctx.rest, pose, DRIVERS.find((d) => d.id === 'shoulderR')))).toBeLessThan(1e-12);
    }
  });

  it('the oracle at the stand is the stand', () => {
    const x = implicitSkin(ctx, ctx.rest, m.vertices);
    expect(Math.max(...x.map((p, i) => Math.hypot(p[0] - m.vertices[i][0], p[1] - m.vertices[i][1], p[2] - m.vertices[i][2])))).toBeLessThan(2e-3);
  });

  it('a key: in bind space (added before skinning it lands the oracle\'s correction), weighted piecewise in its angle', () => {
    const corpus = [bendJoint(ctx.rest, elbow, 1.2), bendJoint(ctx.rest, elbow, -0.3)];
    const set = correctiveKeys(ctx, { drivers: [elbow], corpus, fractions: [1] });
    expect(set.drivers[0].keys.map((k) => k.angle)).toEqual([-0.3, 1.2].map((a) => expect.closeTo(a, 9)));
    // at a key's angle the key alone at weight one, and LBS with it is the oracle (to its sparsity floor)
    const pose = corpus[0], w = correctiveWeights(set, ctx.rest, pose);
    expect(w).toEqual([{ driver: 'elbowR', key: 1, w: expect.closeTo(1, 9) }]);
    const corrected = applyCorrectives(ctx, set, pose), or = implicitSkin(ctx, pose, skinPose(m, ctx.rest, pose), {});
    const region = new Set(set.drivers[0].keys[1].deltas.map(([i]) => i));
    let off = 0; for (const i of region) off = Math.max(off, Math.hypot(...corrected[i].map((x, j) => x - or[i][j])));
    expect(off).toBeLessThan(0.02 * B.scale);
    // halfway there, half the key; at the stand nothing, and nothing added
    expect(correctiveWeights(set, ctx.rest, bendJoint(ctx.rest, elbow, 0.6))[0].w).toBeCloseTo(0.5, 9);
    expect(correctiveWeights(set, ctx.rest, ctx.rest)).toEqual([]);
    const still = applyCorrectives(ctx, set, ctx.rest), lbs = skinPose(m, ctx.rest, ctx.rest);
    expect(still).toEqual(lbs);
    // refit on its own key poses it stays where it was (the poses are what the key was made from)
    const fit = fitCorrectives(ctx, set, corpus, { lambda: 0.05 });
    expect(fit.drivers[0].keys[1].deltas.length).toBe(set.drivers[0].keys[1].deltas.length);
  });
});

// the tack: fitted to this body (each piece's surface a few millimetres proud of the skin at the stand, the seat on the
// back behind the withers, the bit at the mouth's corners), and riding it: no piece under the rendered skin in the
// poses that fold it most (the take-off's crouch, the gallop's reach, grazing); every pose of the clips is the deep tier's
describe('the tack', () => {
  it('fits this horse and rides it', async () => {
    const { tackPieces, tackSkin, tackGates } = await import('./tack.js'), { correctiveCorpus } = await import('./correctives.js');
    const B = resolveMount('horse'), m = bodyMesh(B, { cells: 48 }), pcs = tackPieces(B), F = bodyField(B), names = pcs.map((p) => p.name);
    for (const n of ['pad', 'saddle', 'flapR', 'girth', 'leatherL', 'ironR', 'crownpiece', 'browband', 'noseband', 'throatlash', 'cheekL', 'bitRingR', 'reins']) expect(names).toContain(n);
    // the pad's underside 3 mm proud; the saddle's whole underside over the back, between the withers and the loin
    const pad = pcs.find((p) => p.name === 'pad'), under = pad.vertices.slice(0, pad.vertices.length / 2).map((v) => F.field(v));
    expect(Math.min(...under)).toBeGreaterThan(0.0015); expect(Math.max(...under)).toBeLessThan(0.006);
    const seat = pcs.find((p) => p.name === 'saddle').vertices.map((v) => v[1]);
    expect(Math.max(...seat)).toBeLessThan(B.trunk.withers[0] + 0.02); expect(Math.min(...seat)).toBeGreaterThan(B.trunk.loin[0]);
    const rest = boneFrames(B, standPose(B)), corpus = correctiveCorpus(B, { phases: 4, jumpSamples: 12 });
    const hard = ['jump', 'gallop', 'grazing'].map((w) => corpus.find((c) => c.label.startsWith(w)).frames);
    const g = tackGates(m, pcs, tackSkin(pcs, m), hard, { rest, skinAt: (pose) => skinPose(m, rest, pose) });
    expect(g.checks.filter((c) => !c.pass).map((c) => c.saw)).toEqual([]);
  }, 120000);
});
