// Loose cloth on the realistic body (body-relational-drape.js): the martial artist's wide trousers fall from the hip as
// one tube a leg (no edge across the knee), held apart at the midline, gathered into a cuff at the ankle that a stride
// carries with the foot, a sash at the waist; the open variant falls to the floor over the foot. (Beside the module, not
// in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { gaitPose } from './hero-stretch.js';

const mint = (outfit) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit }) }).recipe;
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));

describe('the martial artist\'s wide trousers', () => {
  let r, mesh;
  beforeAll(() => { r = mint(['martialPants']); mesh = compileLayered(r); }, 300_000);

  it('one tube a leg, a cuff, a sash with its knot and tails; all closed and wound once', () => {
    for (const k of ['martialPants_pelvis', 'martialPants_legR', 'martialPants_legL', 'martialPantsCuff_legR', 'martialPantsSash_pelvis', 'martialPantsKnot', 'martialPantsTailR']) expect(r.parts[k], k).toBeTruthy();
    expect(Object.keys(r.parts).some((k) => /^martialPants_(thigh|shank)/.test(k))).toBe(false);
    const A = auditLayered(mesh);
    for (const k of Object.keys(r.parts).filter((k) => k.startsWith('martialPants'))) { expect(A[k].windingErrors, k).toBe(0); expect(A[k].nonManifold, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0); }
  });

  it('falls wide from the hip and stays on its own side of the middle', () => {
    const leg = pointsOf(r.parts.martialPants_legR), skin = pointsOf(r.parts.shankR);
    expect(leg.every((p) => p[0] > 0.002)).toBe(true);
    expect(pointsOf(r.parts.martialPants_legL).every((p) => p[0] < -0.002)).toBe(true);
    // wider than the shank's skin at the calf: the cloth hangs off it
    const at = (pts, z) => { const near = pts.filter((p) => Math.abs(p[2] - z) < 0.01); return Math.max(...near.map((p) => p[1])) - Math.min(...near.map((p) => p[1])); };
    const zCalf = Math.min(...skin.map((p) => p[2])) + 0.25;
    expect(at(leg, zCalf)).toBeGreaterThan(at(skin, zCalf) + 0.03);
  });

  it('a stride carries the cuff with the ankle (the leg\'s weights its own, thigh and shank)', () => {
    const R = validateRig(r.rig), skin = bindLayered(mesh, r, R), { nodes } = rigNodesAt(R, gaitPose(R, 'walk')(0.25)), P = skinLayered(mesh, skin, boneFrames(R, R.joints, nodes));
    const ids = (part) => mesh.provenance.map((p, v) => (p.part === part ? v : -1)).filter((v) => v >= 0);
    const cuff = ids('martialPantsCuff_legR').map((v) => P[v]), shank = ids('shankR').map((v) => P[v]);
    const low = shank.reduce((a, p) => (p[2] < a[2] ? p : a));
    const d = Math.min(...cuff.map((p) => Math.hypot(p[0] - low[0], p[1] - low[1], p[2] - low[2])));
    expect(d).toBeLessThan(0.08);
    // the cuff's caps ride with its ring, not the thigh (a cap left on the leg's bone throws a spike as the knee bends)
    const gap = (X) => { const leg = ids('martialPants_legR').map((v) => X[v]); return ids('martialPantsCuff_legR').map((v) => Math.min(...leg.map((q) => Math.hypot(X[v][0] - q[0], X[v][1] - q[1], X[v][2] - q[2])))); };
    const rest = gap(mesh.vertices), posed = gap(P);
    expect(Math.max(...posed.map((g, i) => Math.abs(g - rest[i])))).toBeLessThan(0.01);
  });
});

describe('the wide trousers falling to the floor', () => {
  it('its hem carried down over the foot to just above the ground, never under it', () => {
    const r = mint(['wideTrousers']), foot = [...pointsOf(r.parts.footR), ...pointsOf(r.parts.toesR)], ground = Math.min(...foot.map((p) => p[2]));
    const low = Math.min(...pointsOf(r.parts.wideTrousers_legR).map((p) => p[2]));
    expect(low).toBeGreaterThanOrEqual(ground);
    expect(low - ground).toBeLessThan(0.03);
    expect(r.parts.wideTrousersCuff_legR).toBeUndefined();
  }, 300_000);
});
