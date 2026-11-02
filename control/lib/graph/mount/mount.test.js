import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { gaitCycle, standPose, strideOf, swingPath, bump } from './gait.js';
import { gaitGates, shotGates, jumpGates, idleGates } from './gates.js';
import { restState, idleLayer, idleClip, grazeClip, herdOffset, IDLE_LAYERS, PHI } from './idle.js';
import { bodyMesh } from './body.js';
import { boneFrames, skinPose, skinMeasures } from './skin.js';
import { coatColor, COATS } from './coats.js';
import { jumpClip } from './jump.js';
import { oneShot } from './motion.js';
import { MOUNT_BONES } from './pose.js';
import { GAITS } from './reference.js';

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
