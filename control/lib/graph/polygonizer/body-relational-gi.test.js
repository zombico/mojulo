// The gi's jacket on the realistic body (body-relational-gi.js), worn over the martial artist's trousers: closed and
// wound once; its skirt outside the trousers below the belt; the V open to the skin; wide sleeves whose hems open to the
// arm; the belt the jacket's, the trousers' sash left off; a stride and a sprint carry it without flinging a vertex (a
// spike grows an edge by tens of centimetres; a bent elbow's or a hip's own stretch by a few).
// (Beside the module, not in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { gaitPose } from './hero-stretch.js';
import { LOOSE_TOPS } from './body-relational-gi.js';

const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const centre = (P, st) => [0, 1, 2].map((k) => P.slots.reduce((s, sl) => s + st.points[sl][k], 0) / P.slots.length);

describe('the gi over the martial artist\'s trousers', () => {
  let r, mesh;
  beforeAll(() => { r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: ['martialPants', 'gi'] }) }).recipe; mesh = compileLayered(r); }, 300_000);

  it('a body, two sleeves, a collar, the flap\'s edge and a belt; all closed and wound once; the trousers\' sash left off', () => {
    for (const k of ['gi_body', 'gi_sleeveR', 'gi_sleeveL', 'giLapel', 'giFlap', 'giSash_body', 'giKnot', 'giTailR']) expect(r.parts[k], k).toBeTruthy();
    expect(Object.keys(r.parts).some((k) => /^gi_(torso|pelvis|upperArm|foreArm)/.test(k))).toBe(false);
    expect(r.parts.martialPantsSash_pelvis).toBeUndefined();
    expect(r.parts.martialPantsKnot).toBeUndefined();
    const A = auditLayered(mesh);
    for (const k of Object.keys(r.parts).filter((k) => k.startsWith('gi'))) { expect(A[k].windingErrors, k).toBe(0); expect(A[k].nonManifold, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0); }
  });

  it('its skirt outside the trousers from under the belt to the hem', () => {
    const B = r.parts.gi_body, belt = pointsOf(r.parts.giSash_body), under = Math.min(...belt.map((p) => p[2])) - 0.01;
    const rings = B.stations.slice(0, -1).map((st) => ({ st, c: centre(B, st) })), hem = Math.min(...rings.map((x) => x.c[2])) + 0.01;
    // (the ring's reach toward an angle: its polygon's edge the ray from its middle crosses, the outermost)
    const reach = ({ st, c }, a) => {
      const P = B.slots.map((sl) => st.points[sl]), dx = Math.cos(a), dy = Math.sin(a); let far = 0;
      for (let j = 0; j < P.length; j++) {
        const p = P[j], q = P[(j + 1) % P.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-12) continue;
        const wx = p[0] - c[0], wy = p[1] - c[1], t = (wx * ey - wy * ex) / den, u = (wx * dy - wy * dx) / den;
        if (t > 0 && u >= 0 && u <= 1) far = Math.max(far, t);
      }
      return far;
    };
    const trousers = Object.entries(r.parts).filter(([k]) => /^martialPants_/.test(k)).flatMap(([, P]) => pointsOf(P)).filter((q) => q[2] < under && q[2] > hem);
    expect(trousers.length).toBeGreaterThan(100);
    const out = trousers.filter((q) => { const g = rings.reduce((b, x) => (Math.abs(x.c[2] - q[2]) < Math.abs(b.c[2] - q[2]) ? x : b)); return Math.hypot(q[0] - g.c[0], q[1] - g.c[1]) > reach(g, Math.atan2(q[1] - g.c[1], q[0] - g.c[0])) + 0.002; });
    expect(out.length).toBe(0);
  });

  it('the V open to the skin: no jacket over the chest\'s middle between the crossing and the collar', () => {
    const T = r.parts.torso, z = (st) => centre(T, st)[2], S = T.stations;
    const at = (u) => { const i = S.findIndex((st) => st.u >= u); return z(S[Math.max(0, i)]); }, zV = at(LOOSE_TOPS.gi.vU), zTop = z(S[S.length - 1]);
    const chest = S.filter((st) => z(st) > zV + 0.05 && z(st) < zTop - 0.04).map((st) => st.points.front);
    expect(chest.length).toBeGreaterThan(3);
    // (the skin's front line down the middle, its depth at a height between its two points there)
    const line = S.map((st) => st.points.front).sort((p, q) => p[2] - q[2]), depth = (z) => { const i = line.findIndex((p) => p[2] >= z); if (i <= 0) return line[Math.max(0, i)][1]; const a = line[i - 1], b = line[i]; return a[1] + ((b[1] - a[1]) * (z - a[2])) / (b[2] - a[2]); };
    const lo = Math.min(...chest.map((p) => p[2])), hi = Math.max(...chest.map((p) => p[2]));
    const middle = pointsOf(r.parts.gi_body).filter((q) => Math.abs(q[0]) < 0.006 && q[2] >= lo && q[2] <= hi && q[1] > 0);
    expect(middle.length).toBeGreaterThan(3);
    for (const q of middle) expect(q[1]).toBeLessThan(depth(q[2]));
  });

  it('wide sleeves, each hem turned back in to the arm', () => {
    for (const S of ['R', 'L']) {
      const P = r.parts[`gi_sleeve${S}`], n = P.stations.length, rad = (st) => { const c = centre(P, st); return P.slots.reduce((s, sl) => s + Math.hypot(...st.points[sl].map((x, k) => x - c[k])), 0) / P.slots.length; };
      const hem = rad(P.stations[n - 2]), lining = rad(P.stations[n - 1]), A = r.parts[`foreArm${S}`], arm = rad(A.stations[Math.round(A.stations.length * LOOSE_TOPS.gi.sleeve.limit)]);
      expect(hem).toBeGreaterThan(arm + 0.03);
      expect(lining).toBeLessThan(hem * 0.7);
    }
  });

  // (5 cm since realistic laws 4: under the round-out the sprint stretched the sleeve's back over the bent elbow 3.2 cm, and
  // with the elbow stitched, its shared ring carrying the hinge's middle share, 4.8 cm (the sleeve whole and smooth there,
  // rendered); a spike is still tens of centimetres)
  it('a stride and a sprint carry it: no edge of the jacket grown by more than 5 cm', () => {
    const R = validateRig(r.rig), skin = bindLayered(mesh, r, R);
    const faces = mesh.faces.filter((t) => /^gi/.test(mesh.provenance[t[0]].part)), d = (X, a, b) => Math.hypot(X[a][0] - X[b][0], X[a][1] - X[b][1], X[a][2] - X[b][2]);
    for (const [gait, ph] of [['walk', 0.25], ['sprint', 0.25]]) {
      const P = skinLayered(mesh, skin, boneFrames(R, R.joints, rigNodesAt(R, gaitPose(R, gait)(ph)).nodes));
      let worst = 0; for (const t of faces) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) { worst = Math.max(worst, d(P, a, b) - d(mesh.vertices, a, b)); }
      expect(worst, gait).toBeLessThan(0.05);
    }
  });
});
