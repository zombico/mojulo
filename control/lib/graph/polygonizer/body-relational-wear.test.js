// An outfit card on the realistic body, its pieces worn by the tailor (body-relational-wear.js), one case per concept:
// a layered card (the suit: a shirt under a jacket, each a body and two sleeves, a stand collar, shoes, a belt with its
// buckle, the trims painted on the cloth; the jacket outside the shirt and clear of the belt; an open front each piece's own; all closed and wound once; a stride flinging nothing); a
// second skin (the traveler's knit top, paint on the authored body, made a close cloth under the jacket); a short sleeve
// (the casual tee's), its hem turned back in to the arm; a coat's skirt (the operative's) carried down from its body;
// a tailored front (a V, notch lapels, the tie, the right front over the left, buttons; double-breasted; a woman's,
// left over right, over a skirt; open, its lapels to the hem; its shape, the shoulder and the waist).
// (Beside the module, not in the critical tier: each case mints a realistic body.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered } from './station-loft-rig.js';
import { gaitPose } from './hero-stretch.js';
import { clearanceOver } from './body-relational-tailor.js';

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

  it('the jacket over the belt: at the belt\'s height every point of the jacket outside the band and its buckle', () => {
    const J = suit.parts.outer_body, belt = ['belt_bottom', 'beltBuckle_bottom'].map((k) => suit.parts[k]).filter(Boolean).flatMap(pointsOf), z = belt.reduce((t, q) => t + q[2], 0) / belt.length;
    const need = clearanceOver(belt), st = J.stations.reduce((b, x) => (Math.abs(centre(J, x)[2] - z) < Math.abs(centre(J, b)[2] - z) ? x : b)), c = centre(J, st), under = need([c[0], c[1], z]);
    for (const p of Object.values(st.points)) { const h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h); expect(r).toBeGreaterThan(under([h[0] / r, h[1] / r, 0])); }
  });

  it('an open jacket with a tail: its front open on the shirt above the waist and on the trousers below, each piece\'s own', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style: { id: 'open', language: { top: { family: 'woven', sleeve: 'long', hem: 'hip', collar: true }, bottom: { family: 'woven', leg: 'long' }, outer: { family: 'woven', sleeve: 'long', hem: 'tunic', open: true }, feet: 'shoes', tuck: true }, tones: { Outer: '#222222', Top: '#eeeeee', Bottom: '#555555' } } } }) }).recipe;
    const J = r.parts.outer_body, z = (k) => centre(J, J.stations.find((st) => st.id === k.split('-')[0]))[2], waist = centre(r.parts.torso, r.parts.torso.stations[0])[2];
    const bands = Object.entries(J.bandGroups || {}), has = (g, above) => bands.some(([k, row]) => row.includes(g) && (above ? z(k) > waist + 0.02 : z(k) < waist - 0.02));
    expect(has('Top', true)).toBe(true); expect(has('Bottom', false)).toBe(true);
    expect(has('Bottom', true)).toBe(false); expect(has('Top', false)).toBe(false);
  }, 300_000);

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

  it('a coat\'s skirt carried down from its body: no authored hull, close over the trousers, its hem an edge open beneath', () => {
    const r = card('operative'), C = r.parts.outer_torso;
    expect(Object.keys(r.parts).some((k) => /_skirt$/.test(k) && !/^belt/.test(k))).toBe(false);
    const S = C.stations, z = (st) => centre(C, st)[2], last = S[S.length - 1], hem = S[S.length - 2];
    // (run top-down, the turned lining last: inside the hem, above it)
    expect(z(S[0])).toBeGreaterThan(z(last));
    expect(radius(C, last)).toBeLessThan(0.4 * radius(C, hem));
    expect(z(last)).toBeGreaterThan(z(hem) + 0.1);
    // (an A, not a bell: at the hem no more than 9 cm past the trousers' reach at that height on either side)
    const legs = Object.entries(r.parts).filter(([k]) => /^bottom_leg[RL]$/.test(k)).flatMap(([, P]) => pointsOf(P)).filter((q) => Math.abs(q[2] - z(hem)) < 0.03);
    const xs = Object.values(hem.points).map((p) => p[0]), lx = legs.map((q) => q[0]);
    expect(Math.max(...xs) - Math.max(...lx)).toBeLessThan(0.09); expect(Math.max(...xs) - Math.max(...lx)).toBeGreaterThan(0.005);
    expect(Math.min(...lx) - Math.min(...xs)).toBeLessThan(0.09);
    const A = auditLayered(compileLayered(r)).outer_torso; expect(A.windingErrors).toBe(0); expect(A.boundaryEdges).toBe(0);
  }, 300_000);

  it('a tailored front: the V onto the shirt and the tie, notch lapels and collar one band, the right front over the left, two buttons, no stand collar; all closed', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style: 'business' } }) }).recipe;
    expect(r.parts.outerLapel_torso).toBeTruthy(); expect(r.parts.outerCollar_neck).toBeUndefined();
    expect(Object.keys(r.parts).filter((k) => /^outerButton\d_torso$/.test(k)).length).toBe(2);
    // (closed: the right front's edge down to the hem, the left's come out from under it below the last button)
    expect(r.parts.outerEdge_torso).toBeTruthy(); expect(r.parts.outerEdgeUnder_torso).toBeTruthy();
    // (the tie on the shirt, the jacket over it below the V: at the waist the jacket's front farther out than the tie)
    const tie = r.parts.tie_torso; expect(tie).toBeTruthy();
    const tz = Math.min(...pointsOf(tie).map((q) => q[2])) + 0.06, J0 = r.parts.outer_body, jst = J0.stations.reduce((b, st) => (Math.abs(centre(J0, st)[2] - tz) < Math.abs(centre(J0, b)[2] - tz) ? st : b));
    const tieFront = Math.max(...pointsOf(tie).filter((q) => Math.abs(q[2] - tz) < 0.01).map((q) => Math.abs(q[1] - centre(J0, jst)[1])));
    expect(Math.abs(jst.points.front[1] - centre(J0, jst)[1])).toBeGreaterThan(tieFront);
    // (in the V, at the chest, the jacket's front taken in under the shirt, and its faces there the shirt's)
    const J = r.parts.outer_body, T = r.parts.top_body, chest = (P) => P.stations.reduce((b, st) => (Math.abs(centre(P, st)[2] - 1.3) < Math.abs(centre(P, b)[2] - 1.3) ? st : b));
    const yJ = chest(J).points.front[1] - centre(J, chest(J))[1], yT = chest(T).points.front[1] - centre(T, chest(T))[1];
    expect(Math.abs(yJ)).toBeLessThan(Math.abs(yT));
    expect(Object.values(J.bandGroups).some((row) => row.includes('Top'))).toBe(true);
    const A = auditLayered(compileLayered(r));
    for (const k of Object.keys(r.parts).filter((k) => /^(outer|tie)/.test(k))) { expect(A[k].windingErrors, k).toBe(0); expect(A[k].nonManifold, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0); }
  }, 300_000);

  it('a double-breasted front: two rows of buttons, the right front square to the hem, no quarters cut away', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style: 'doublebreasted' } }) }).recipe;
    expect(Object.keys(r.parts).filter((k) => /^outerButton\d[RL]_torso$/.test(k)).length).toBe(6);
    expect(r.parts.outerEdge_torso).toBeTruthy(); expect(r.parts.outerEdgeUnder_torso).toBeUndefined();
    // (the edge on the wearer's left, past the left row of buttons)
    expect(Math.max(...pointsOf(r.parts.outerEdge_torso).map((q) => q[0]))).toBeLessThan(0.02);
  }, 300_000);

  it('a woman\'s suit closes her way, left front over right; a skirt under the jacket, the jacket over its hips', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: { type: 'outfit', style: 'skirtsuit' } }) }).recipe;
    // (at the button the left front's edge past the middle on her right; below it the quarter curves back to her left)
    const E = pointsOf(r.parts.outerEdge_torso), top = Math.max(...E.map((q) => q[2])), atTop = E.filter((q) => q[2] > top - 0.02);
    expect(atTop.reduce((t, q) => t + q[0], 0) / atTop.length).toBeGreaterThan(0);
    const J = r.parts.outer_body, K = r.parts.skirt_pelvis; expect(K).toBeTruthy();
    const zH = Math.min(...J.stations.map((st) => centre(J, st)[2])) + 0.03, reach = (P) => { const st = P.stations.reduce((b, x) => (Math.abs(centre(P, x)[2] - zH) < Math.abs(centre(P, b)[2] - zH) ? x : b)); const c = centre(P, st); return Math.max(...Object.values(st.points).map((p) => Math.hypot(p[0] - c[0], p[1] - c[1]))); };
    expect(reach(J)).toBeGreaterThan(reach(K));
    const A = auditLayered(compileLayered(r));
    for (const k of Object.keys(r.parts).filter((k) => /^(outer|skirt)/.test(k))) { expect(A[k].windingErrors, k).toBe(0); expect(A[k].boundaryEdges, k).toBe(0); }
  }, 300_000);

  it('a jacket\'s shape: structured shoulders squared out above the widest ring, a suppressed waist drawn in against a straight one', () => {
    const outer = { family: 'woven', sleeve: 'long', hem: 'tunic', open: false, fit: 'fitted', collar: true, front: 'single', lapel: 'notch', buttons: 2 };
    const mint = (o) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style: 'business', language: { outer: { ...outer, ...o } } } }) }).recipe.parts.outer_body;
    const A = mint({ shoulder: 'structured', waist: 'suppressed' }), B = mint({ shoulder: 'natural', waist: 'straight' });
    const ring = (P, z) => P.stations.reduce((b, st) => (Math.abs(centre(P, st)[2] - z) < Math.abs(centre(P, b)[2] - z) ? st : b));
    const side = (P, z) => Math.max(...Object.values(ring(P, z).points).map((p) => Math.abs(p[0])));
    const zs = B.stations.map((st) => centre(B, st)[2]), zTop = Math.max(...zs), zWide = zs.filter((z) => z > zTop - 0.2).reduce((b, z) => (side(B, z) > side(B, b) ? z : b));
    // (between the widest ring and the neck the structured shoulder reaches farther to the side)
    expect(side(A, zWide + 0.04)).toBeGreaterThan(side(B, zWide + 0.04) + 0.01);
    // (at the waist the suppressed jacket stands closer than the straight one)
    const zWaist = centre(B, ring(B, 1.04))[2];
    expect(radius(A, ring(A, zWaist))).toBeLessThan(radius(B, ring(B, zWaist)) - 0.002);
  }, 300_000);

  it('an open jacket: its lapels on down the fronts\' edges to the hem', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style: { id: 'open', language: { top: { family: 'knit', sleeve: 'long', hem: 'hip', fit: 'fitted' }, bottom: { family: 'woven', leg: 'long' }, outer: { family: 'woven', sleeve: 'long', hem: 'tunic', open: true, lapel: 'notch' }, feet: 'shoes', tuck: true } } } }) }).recipe;
    const J = r.parts.outer_body, L = pointsOf(r.parts.outerLapel_torso), zBot = Math.min(...J.stations.map((st) => centre(J, st)[2]));
    expect(Math.min(...L.map((q) => q[2]))).toBeLessThan(zBot + 0.02);
    expect(r.parts.outerEdge_torso).toBeUndefined();
  }, 300_000);

  it('a short sleeve: the casual tee\'s, its hem turned back in to the arm, no lid', () => {
    const r = card('casual'), S = r.parts.top_upperArmR; expect(S).toBeTruthy();
    const n = S.stations.length;
    expect(radius(S, S.stations[n - 1])).toBeLessThan(0.85 * radius(S, S.stations[n - 2]));
  }, 300_000);
});
