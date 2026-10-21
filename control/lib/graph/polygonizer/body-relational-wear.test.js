// An outfit card on the realistic body, its pieces worn by the tailor (body-relational-wear.js), one case per concept:
// a layered card (the suit: a shirt under a jacket, each a body and two sleeves, a stand collar, shoes, a belt with its
// buckle, the trims painted on the cloth; the jacket outside the shirt; all closed and wound once; a stride flinging nothing); a
// second skin (the traveler's knit top, paint on the authored body, made a close cloth under the jacket); a short sleeve
// (the casual tee's), its hem turned back in to the arm.
// (Beside the module, not in the critical tier: each case mints a realistic body.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { gaitPose } from './hero-stretch.js';

const card = (style) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style } }) }).recipe;
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const centre = (P, st) => [0, 1, 2].map((k) => P.slots.reduce((s, sl) => s + st.points[sl][k], 0) / P.slots.length);
const radius = (P, st) => { const c = centre(P, st); return P.slots.reduce((s, sl) => s + Math.hypot(...st.points[sl].map((x, k) => x - c[k])), 0) / P.slots.length; };

describe('an outfit card worn by the tailor', () => {
  let suit, mesh;
  beforeAll(() => { suit = card('suit'); mesh = compileLayered(suit); }, 300_000);

  it('the suit: a shirt and a jacket each a body and two sleeves, stand collars, shoes, a belt and its buckle, the trims painted on; the authored pieces gone', () => {
    for (const k of ['top_body', 'top_armR', 'outer_body', 'outer_armL', 'topCollar_neck', 'outerCollar_neck', 'shoes_footR', 'belt_bottom', 'beltBuckle_bottom', 'bottom_pelvis', 'bottom_legR']) expect(suit.parts[k], k).toBeTruthy();
    expect(Object.keys(suit.parts).some((k) => /^(topSleeve|topCuff|outerSleeve|bottomSeat|bottomLeg)_/.test(k))).toBe(false);
    // (the expander's trims painted on the cloth's faces, moved there by the pieces' aliases)
    const trimmed = new Set(mesh.faces.map((t, fi) => (/^(top|outer|bottom)/.test(mesh.provenance[t[0]].part) ? mesh.groups[fi] : null)).filter(Boolean));
    expect([...trimmed].some((g) => /^(Trim|Waistband|Collar)$/.test(g)), [...trimmed].join(',')).toBe(true);
    const A = auditLayered(mesh);
    for (const k of Object.keys(suit.parts).filter((k) => /^(top|outer|bottom|belt|shoes)/.test(k))) { expect(A[k].windingErrors, k).toBe(0); expect(A[k].nonManifold, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0); }
  });

  it('the jacket over the shirt: at every height they share, its rings wider', () => {
    const J = suit.parts.outer_body, T = suit.parts.top_body;
    const byZ = (P) => P.stations.map((st) => ({ z: centre(P, st)[2], r: radius(P, st) }));
    const shirt = byZ(T), jacket = byZ(J), lo = Math.max(Math.min(...shirt.map((x) => x.z)), Math.min(...jacket.map((x) => x.z))) + 0.02, hi = Math.min(Math.max(...shirt.map((x) => x.z)), Math.max(...jacket.map((x) => x.z))) - 0.04;
    const inside = jacket.filter((j) => j.z > lo && j.z < hi).filter((j) => { const s = shirt.reduce((b, x) => (Math.abs(x.z - j.z) < Math.abs(b.z - j.z) ? x : b)); return j.r < s.r + 0.0015; });
    expect(inside.length).toBe(0);
  });

  it('a stride flings nothing: no edge of what the suit is made of grown by more than 3 cm', () => {
    const R = validateRig(suit.rig), skin = bindLayered(mesh, suit, R), P = skinLayered(mesh, skin, boneFrames(R, R.joints, rigNodesAt(R, gaitPose(R, 'walk')(0.25)).nodes));
    const d = (X, a, b) => Math.hypot(X[a][0] - X[b][0], X[a][1] - X[b][1], X[a][2] - X[b][2]);
    let worst = 0; for (const t of mesh.faces) { if (!/^(top|outer|bottom|belt)/.test(mesh.provenance[t[0]].part)) continue; for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) worst = Math.max(worst, d(P, a, b) - d(mesh.vertices, a, b)); }
    expect(worst).toBeLessThan(0.03);
  });

  it('a second skin: the traveler\'s knit top made close cloth, the belly covered between the trousers and the jacket', () => {
    const r = card('traveler'), skin = Object.keys(r.parts).filter((k) => /^skinTop_/.test(k));
    expect(skin.length).toBeGreaterThan(0);
    const T = r.parts.torso, cloth = Object.entries(r.parts).filter(([k]) => /^(skinTop|outer|bottom)_/.test(k)).flatMap(([, P]) => pointsOf(P));
    const belly = T.stations.map((st) => st.points.front).filter((p) => p[2] > 1.06 && p[2] < 1.2);
    expect(belly.length).toBeGreaterThan(2);
    for (const p of belly) expect(cloth.some((q) => Math.abs(q[0] - p[0]) < 0.02 && Math.abs(q[2] - p[2]) < 0.02 && q[1] > p[1]), `${p}`).toBe(true);
  }, 300_000);

  it('a stylism on the realistic body: lowered to an outfit build, worn by the tailor, its pauldrons on the cloth', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', stylism: { genre: 'fantasy', silhouette: 'wedge', register: 'heroic' } }) }).recipe;
    expect(Object.keys(r.parts).some((k) => /^outer_(body|torso)$/.test(k))).toBe(true);
    expect(Object.keys(r.parts).some((k) => /^adorn\./.test(k))).toBe(true);
  }, 300_000);

  it('a waist wrap on a heavy figure under a long coat: a band on the coat\'s own girth, never through it', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', physique: 'heavyset', stylism: { genre: 'modern', silhouette: 'bell', canon: 'western' } }) }).recipe;
    const coat = Object.entries(r.parts).find(([k]) => /^outer_(body|torso)$/.test(k))?.[1], sash = Object.entries(r.parts).find(([k]) => /^sash_/.test(k))?.[1];
    expect(coat).toBeTruthy(); expect(sash).toBeTruthy();
    expect(sash.stations.length).toBe(2);
    const z = centre(sash, sash.stations[0])[2], ring = coat.stations.reduce((b, st) => (Math.abs(centre(coat, st)[2] - z) < Math.abs(centre(coat, b)[2] - z) ? st : b));
    expect(radius(sash, sash.stations[0])).toBeGreaterThan(radius(coat, ring) - 0.004);
  }, 300_000);

  it('a short sleeve: the casual tee\'s, its hem turned back in to the arm, no lid', () => {
    const r = card('casual'), S = r.parts.top_upperArmR; expect(S).toBeTruthy();
    const n = S.stations.length;
    expect(radius(S, S.stations[n - 1])).toBeLessThan(0.85 * radius(S, S.stations[n - 2]));
  }, 300_000);
});
