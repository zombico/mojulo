// hero-xr-hands — the hero's hands as the headset plays them: the grip space sits in the hand where WebXR says it does
// (the fist's centre, −Z through the fist toward the thumb, +X out of the right hand's back, +Y up toward the arm); the
// curl table, played as the page plays a rig clip (head' + q·(v − restHead), nlerp between samples), lands a digit's tip
// where the rig's own kinematics put it between the samples; the digits compose; the left hand mirrors the right.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { xrHands, gripFrame, PRESENT } from './hero-xr-hands.js';
import { gearMounts, gearPackParts, gearRestPoint } from './hero-gear.js';
import { DEFAULT_LIGHT } from './vexar.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'realistic' }) }).recipe.rig);
const DZ = 0.05;
const H = xrHands(R, { dz: DZ });
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => a.map((v) => v / len(a));
const turn = (q, v) => { const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; };
const nlerp = (a, b, t) => { const s = dot(a, b) + a[3] * b[3] < 0 ? -1 : 1, q = a.map((v, i) => v + (s * b[i] - v) * t), l = Math.hypot(...q); return q.map((v) => v / l); };
const raise = (p) => [p[0], p[1], p[2] + DZ];
/** a digit's tip by the table at `angle` (degrees), the way the page plays it */
const tipByTable = (S, d, angle) => {
  const D = H[S].digits[d], f = Math.min(1, Math.max(0, (angle - D.lo) / (D.hi - D.lo))) * (D.k - 1), i0 = Math.min(D.k - 2, Math.floor(f)), t = f - i0, n = D.bones.length;
  const j = n - 1, o0 = (i0 * n + j) * 7, o1 = ((i0 + 1) * n + j) * 7;
  const q = nlerp(D.b.slice(o0, o0 + 4), D.b.slice(o1, o1 + 4), t), head = [0, 1, 2].map((c) => D.b[o0 + 4 + c] + (D.b[o1 + 4 + c] - D.b[o0 + 4 + c]) * t);
  const bone = R.bones[R.boneIndex[D.bones[j]]];
  const v = sub(raise(R.joints[bone.tail]), raise(R.joints[bone.head]));
  const r = turn(q, v); return [head[0] + r[0], head[1] + r[1], head[2] + r[2]];
};

describe('the hero’s hands in the headset', () => {
  it('both hands, five digits a hand, three bones a digit, the hand words from the rig', () => {
    for (const S of ['R', 'L']) {
      expect(Object.keys(H[S].digits)).toEqual(['thumb', 'index', 'middle', 'ring', 'little']);
      for (const D of Object.values(H[S].digits)) { expect(D.bones).toHaveLength(3); expect(D.b).toHaveLength(D.k * 3 * 7); expect(D.hi).toBeGreaterThan(D.lo); }
      expect(H[S].poses.fist.index).toBeGreaterThan(H[S].poses.open.index);
    }
  });

  it('the grip space sits where WebXR puts it: the fist’s centre, −Z toward the thumb, +X the right hand’s back, +Y up the arm', () => {
    for (const S of ['R', 'L']) {
      const G = H[S].grip, J = R.joints, at = (j) => J[`${j}${S}`];
      // orthonormal and right-handed
      for (const a of ['x', 'y', 'z']) expect(len(G[a])).toBeCloseTo(1, 5);
      expect(dot(G.x, G.y)).toBeCloseTo(0, 5); expect(dot(G.y, G.z)).toBeCloseTo(0, 5); expect(dot(G.z, G.x)).toBeCloseTo(0, 5);
      const c = [G.x[1] * G.y[2] - G.x[2] * G.y[1], G.x[2] * G.y[0] - G.x[0] * G.y[2], G.x[0] * G.y[1] - G.x[1] * G.y[0]];
      c.forEach((v, i) => expect(v).toBeCloseTo(G.z[i], 5));
      // +Y up the arm (the elbow's side of the hand), −Z toward the thumb's side of the fist
      expect(dot(G.y, unit(sub(at('elbow'), at('wrist'))))).toBeGreaterThan(0.6);
      expect(dot(mul3(G.z, -1), unit(sub(at('indexMcp'), at('littleMcp'))))).toBeGreaterThan(0.9);
      // +X: the back of the right hand, the palm of the left (the fingers close away from the back)
      const fist = rigNodesAt(R, { [`fingers${S}`]: 'fist' }).nodes, toPalm = unit(sub(fist[`middleTip${S}`], at('middleMcp')));
      expect(dot(G.x, toPalm) * (S === 'R' ? -1 : 1)).toBeGreaterThan(0.3);
      // the origin within the closed fingers: a few centimetres in front of the knuckles, raised by dz
      expect(len(sub(G.o, raise(at('middleMcp'))))).toBeLessThan(0.06);
      expect(G.o[2]).toBeCloseTo(gripFrame(R, S).o[2] + DZ, 6);
    }
  });

  it('the left hand mirrors the right (across the figure’s midplane)', () => {
    const m = (v) => [-v[0], v[1], v[2]], A = H.R.grip, B = H.L.grip;
    m(A.o).forEach((v, i) => expect(B.o[i]).toBeCloseTo(v, 4));
    m(A.y).forEach((v, i) => expect(B.y[i]).toBeCloseTo(v, 4));
    m(A.z).forEach((v, i) => expect(B.z[i]).toBeCloseTo(v, 4));
    // a mirror flips handedness, and the left's +X is its palm: so the axis mirrors without the sign flip a reflection adds
    m(A.x).forEach((v, i) => expect(B.x[i]).toBeCloseTo(-v, 4));
  });

  it('the table lands a tip where the rig puts it, between the samples as on them', () => {
    let worst = 0;
    for (const S of ['R', 'L']) for (const d of ['thumb', 'index', 'little']) {
      const D = H[S].digits[d];
      for (const u of [0, 0.5 / (D.k - 1), 0.37, 1]) {
        const a = D.lo + (D.hi - D.lo) * u, n = rigNodesAt(R, { [`fingers${S}`]: { [d]: a } }).nodes;
        worst = Math.max(worst, len(sub(tipByTable(S, d, a), raise(n[`${d}Tip${S}`]))));
      }
    }
    expect(worst).toBeLessThan(0.002);   // two millimetres, mid-sample
  });

  it('a digit turns its own bones only: a fist is the five tables at once', () => {
    const n = rigNodesAt(R, { fingersR: 'fist' }).nodes;
    for (const d of ['thumb', 'index', 'middle', 'ring', 'little']) expect(len(sub(tipByTable('R', d, H.R.poses.fist[d]), raise(n[`${d}TipR`])))).toBeLessThan(1e-3);
  });

  it('is deterministic; a rig with no digits has no hands to draw', () => {
    expect(JSON.stringify(xrHands(R, { dz: DZ }))).toBe(JSON.stringify(H));
    expect(xrHands({ joints: {}, bones: [], boneIndex: {} })).toBeNull();
  });
});

function mul3(a, s) { return a.map((v) => v * s); }

describe('the hands ride the hero’s figure only where a headset plays', () => {
  // (the hero's own resolve is the layered kind's, minutes for a realistic body: stood in here, the seam is what is tested;
  // what the kind adds is xrHands on its rig, above)
  it('heroFigure asks the hero’s resolve for the hands only for a headset, and hands them over on the figure', async () => {
    const { heroFigure } = await import('../worlds/world-scene.js');
    const { WORLD_KINDS } = await import('../worlds/world-kinds.js');
    const was = WORLD_KINDS.layered.resolve, asked = [];
    WORLD_KINDS.layered.resolve = async (m, ctx) => { asked.push(ctx); return { figures: { body: { rig: true, bones: [], parts: [], clips: { idle: {} }, ...(ctx.xrHands ? { xrHands: H } : {}), embodies: 'body', preview: {} } } }; };
    try {
      const spec = { hero: { cast: 'male' } };
      const plain = await heroFigure('hero', spec), withHands = await heroFigure('hero', spec, { hands: true });
      expect(asked[0].xrHands).toBeUndefined();
      expect(asked[1].xrHands).toBe(true);
      expect(plain.xrHands).toBeUndefined();
      expect(withHands.xrHands).toBe(H);
    } finally { WORLD_KINDS.layered.resolve = was; }
  });
});

describe('what the hands hold, re-held for the headset', () => {
  // (the gear's mounts on the same rig: the hero door's words, placed at rest as the pack places them)
  const hero = heroRecord({ cast: 'male', form: 'realistic', gear: { right: { item: 'pistol' }, left: { item: 'sword', style: 'historical' } } });
  const mounts = gearMounts(hero, R), HG = xrHands(R, { dz: DZ, gear: mounts });
  const affine = (r, p) => [0, 1, 2].map((i) => r[4 * i] * p[0] + r[4 * i + 1] * p[1] + r[4 * i + 2] * p[2] + r[4 * i + 3]);
  const rot = (r, v) => [0, 1, 2].map((i) => r[4 * i] * v[0] + r[4 * i + 1] * v[1] + r[4 * i + 2] * v[2]);
  const rigid = (r) => {
    const c = [0, 1, 2].map((j) => [r[j], r[4 + j], r[8 + j]]);
    for (const a of c) expect(len(a)).toBeCloseTo(1, 5);
    expect(dot(c[0], c[1])).toBeCloseTo(0, 5); expect(dot(c[1], c[2])).toBeCloseTo(0, 5);
    const det = c[0][0] * (c[1][1] * c[2][2] - c[1][2] * c[2][1]) - c[1][0] * (c[0][1] * c[2][2] - c[0][2] * c[2][1]) + c[2][0] * (c[0][1] * c[1][2] - c[0][2] * c[1][1]);
    expect(det).toBeCloseTo(1, 5);
  };
  const restOf = (G, q) => raise(gearRestPoint(G, q));

  it('the item’s triangles are the ones the pack appends to the hand’s part', () => {
    const packed = gearPackParts(mounts, { dz: DZ, light: DEFAULT_LIGHT });
    expect(HG.R.item.tris).toBe(packed[mounts.findIndex((G) => G.slot === 'right')].tris.length);
    expect(HG.L.item.tris).toBe(packed[mounts.findIndex((G) => G.slot === 'left')].tris.length);
  });

  it('a gun is presented: its grip in the fist, its bore along the hand raked toward the thumb, a shot from its muzzle', () => {
    const G = mounts.find((g) => g.slot === 'right'), I = HG.R.item, g = HG.R.grip;
    expect(I.hold).toBe('firearm');
    rigid(I.rehold);
    // the item's grip anchor lands on the grip space's origin
    affine(I.rehold, restOf(G, G.o)).forEach((v, i) => expect(v).toBeCloseTo(g.o[i], 5));
    const d = I.muzzle.d, a = PRESENT * Math.PI / 180;
    expect(dot(d, g.y.map((v) => -v))).toBeCloseTo(Math.cos(a), 5);
    expect(dot(d, g.z.map((v) => -v))).toBeCloseTo(Math.sin(a), 5);
    // the muzzle is the tip socket carried by the same move, ahead of the hand along the bore
    affine(I.rehold, restOf(G, G.sockets.tip.origin)).forEach((v, i) => expect(v).toBeCloseTo(I.muzzle.p[i], 5));
    expect(dot(sub(I.muzzle.p, g.o), d)).toBeGreaterThan(0.05);
    rot(I.rehold, [G.M[0][2], G.M[1][2], G.M[2][2]]).forEach((v, i) => expect(v).toBeCloseTo(d[i], 5));
  });

  it('a blade comes out of the fist past the thumb, along the grip’s −Z', () => {
    const G = mounts.find((g) => g.slot === 'left'), I = HG.L.item, g = HG.L.grip;
    expect(I.hold).toBe('blade');
    expect(I.muzzle).toBeUndefined();
    rigid(I.rehold);
    affine(I.rehold, restOf(G, G.o)).forEach((v, i) => expect(v).toBeCloseTo(g.o[i], 5));
    const tip = affine(I.rehold, restOf(G, G.sockets.tip.origin)), out = sub(tip, g.o);
    expect(dot(unit(out), g.z.map((v) => -v))).toBeGreaterThan(0.99);
    expect(len(out)).toBeGreaterThan(0.5);   // an arming sword's blade
  });

  it('an empty hand holds nothing; anything but a blade or a gun keeps the hero’s own hold', () => {
    expect(H.R.item).toBeUndefined();
    const bow = gearMounts(heroRecord({ cast: 'male', form: 'realistic', gear: { left: { item: 'bow' } } }), R);
    const I = xrHands(R, { dz: DZ, gear: bow }).L.item;
    expect(I.hold).toBe('bow');
    expect(I.rehold).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]);
  });
});

describe('where the hands strike', () => {
  it('the fist strikes with its knuckles, past the hand’s knuckle line; a held blade from its guard to its tip, out past the thumb', () => {
    for (const S of ['R', 'L']) {
      const along = unit(sub(R.joints[`middleMcp${S}`], R.joints[`wrist${S}`]));
      expect(dot(sub(H[S].fist, raise(R.joints[`middleMcp${S}`])), along)).toBeGreaterThan(0);
      expect(len(sub(H[S].fist, raise(R.joints[`middleMcp${S}`])))).toBeLessThan(0.06);
    }
    const hero = heroRecord({ cast: 'male', form: 'realistic', gear: { right: { item: 'sword', style: 'historical' } } });
    const B = xrHands(R, { dz: DZ, gear: gearMounts(hero, R) }).R, g = B.grip, bl = B.item.blade;
    expect(len(sub(bl.a, g.o))).toBeLessThan(0.15);   // the guard just past the fist
    expect(dot(unit(sub(bl.b, bl.a)), g.z.map((v) => -v))).toBeGreaterThan(0.99);
    expect(len(sub(bl.b, bl.a))).toBeGreaterThan(0.5);
    expect(xrHands(R, { dz: DZ, gear: gearMounts(heroRecord({ cast: 'male', form: 'realistic', gear: { right: { item: 'pistol' } } }), R) }).R.item.blade).toBeUndefined();
  });
});
