/**
 * BODY-RELATIONAL GI — the martial artist's JACKET on the realistic body, loose over the wide trousers
 * (body-relational-drape.js): wrapped left over right, a V at the chest, wide sleeves open at the forearm, a skirt over
 * the hips, belted at the waist with the cloth bloused over the belt.
 *
 *   the base    the tee's cloth field (body-relational-garment.js `fieldGarment`) over the torso, the pelvis from the
 *               hips up (`hipU`) and the arms down the forearm (`sleeve.limit`), so every ring keeps the skin's station,
 *               slot and weights
 *   the BODY    the pelvis's piece and the torso's one tube (the drape's `oneLeg`), from its hem to the collar:
 *               - above the chest (`chestU`) the field's own cloth, close over the shoulders
 *               - below it the FALL (each slot the larger of its own, and the `slack` eased in over 10 cm, and the
 *                 ring above's let down by `taper`), the
 *                 cloth hanging from the chest, BLOUSED out over the belt (`blouse` at most, gone `blouseLen` above it)
 *               - at the BELT (`belt` high, `beltDrop` under the pelvis's top ring) cinched to what is under it
 *               - below it the SKIRT carried straight down past the hip to `hem` under the crotch, every ring `clear` of
 *                 what is under it (the trousers' cloth, else the skin), folds deepening to the hem; its weights the
 *                 pelvis's, the thigh's shared in toward each side and down; its hem TURNED (the cloth folded back up
 *                 inside to the crotch), so it opens as a skirt does and no lid closes it
 *   the WRAP    a V from the collar (`vTop` each side of the middle) to the crossing (`vU` on the torso): the cloth inside
 *               it taken under the skin, which shows; one COLLAR band lying on the cloth (`<id>Lapel`): up the right
 *               edge, round the back of the neck standing, down the left edge, over the crossing and on to the right
 *               waist (`cross`), left over right; the over-panel's edge on down the skirt (`<id>Flap`)
 *   the SLEEVES the upper arm's and the forearm's pieces draped as the trousers' legs are (`sleeve`: the fall, a flare
 *               to the hem, folds) and made one tube (`<id>_sleeve<R|L>`), the hem turned back in to the arm
 *   the BELT    the drape's sash over the jacket (`<id>Sash_body`, its knot and tails); the trousers' own left off
 *
 *   giJacket(recipe, R, build, map, spec, { id, under }) → { parts, tones }   (`under`: the parts the jacket is worn
 *               over, the trousers, cleared below the belt)
 *   LOOSE_TOPS  the words: `gi`
 *
 * The drape is the REST shape, carried by the bones as the skin is (no cloth simulation). Pure; deterministic.
 */
import { fieldGarment } from './body-relational-garment.js';
import { drapeLeg, oneLeg, sashOn, LOOSE_TONES } from './body-relational-drape.js';
import { ringSlots, mixW, four } from './body-relational-resample.js';

export const LOOSE_TOPS = Object.freeze({
  gi: Object.freeze({
    ease: 0.01, slack: 0.012, taper: 0.12, chestU: 2,
    blouse: 0.022, blouseLen: 0.11, belt: 0.045, beltDrop: 0.008,
    hipU: 2, hem: 0.07, clear: 0.008, skirtSlack: 0.02, folds: 10, fold: 0.004,
    vU: 1.45, vTop: 0.075, cross: 0.06, lapel: Object.freeze({ w: 0.042, t: 0.007 }),
    sleeve: Object.freeze({ limit: 0.6, slack: 0.022, taper: 0.06, flare: 0.015, margin: 0.004, folds: 6, fold: 0.005, hem: 'fall' }),
  }),
});

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (v) => Math.hypot(...v);
const unitv = (v) => { const l = len(v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ease3 = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const pts = (P) => P.stations.flatMap((st) => Object.values(st.points));

/** a ring's weights mixed (each slot's), held to four bones: a cap's, so it rides with its ring */
function ringW(w) {
  const m = {}; for (const x of Object.values(w)) for (const [b, v] of Object.entries(x)) m[b] = (m[b] ?? 0) + v;
  const n = Object.keys(w).length; return four(mixW(Object.fromEntries(Object.entries(m).map(([b, v]) => [b, v / n])), {}, 0));
}

/** The gi's jacket (see the head of this file). */
export function giJacket(recipe, R, build, map, spec = 'gi', { id = 'gi', under = {} } = {}) {
  const F = typeof spec === 'string' ? LOOSE_TOPS[spec] : spec;
  const { parts } = fieldGarment(recipe, R, build, map, { id, covers: null, on: ['torso', 'pelvis', 'upperArm', 'foreArm'], limit: { foreArm: F.sleeve.limit }, window: { pelvis: [F.hipU, Infinity] }, ease: F.ease, looser: 3, reach: 0.05, taut: true, group: 'Top' });
  const T = parts[`${id}_torso`], P = parts[`${id}_pelvis`], skinT = recipe.parts.torso, skinP = recipe.parts.pelvis;
  if (!T || !P || !skinT || !skinP) return { parts: {}, tones: {} };
  const slots = T.slots, N = slots.length, ctr = (pp) => mean(slots.map((sl) => pp[sl]));
  // the levels, off the skin: the crotch, the belt, the chest, the V's crossing, the collar, the hem
  const zOf = (Q, st) => mean(Q.slots.map((sl) => st.points[sl]))[2];
  const zAtU = (Q, u) => { const S = Q.stations; for (let i = 1; i < S.length; i++) if (u <= S[i].u + 1e-9) { const a = S[i - 1].u, t = S[i].u > a ? (u - a) / (S[i].u - a) : 0; return zOf(Q, S[i - 1]) + (zOf(Q, S[i]) - zOf(Q, S[i - 1])) * Math.max(0, Math.min(1, t)); } return zOf(Q, S[S.length - 1]); };
  const zCrotch = zOf(skinP, skinP.stations[0]), zBelt = zOf(skinP, skinP.stations[skinP.stations.length - 1]) - F.beltDrop;
  const zBeltTop = zBelt + F.belt / 2, zBeltBot = zBelt - F.belt / 2, zChest = zAtU(skinT, F.chestU), zV = zAtU(skinT, F.vU), zHem = zCrotch - F.hem;

  // THE BODY: the pelvis's rings and the torso's one tube, each ring its points, its weights and (the torso's) its skin
  const M = oneLeg(P, T), nT = T.stations.length, from = M.stations.length - nT;
  const wOf = (st, sl) => M.bind.blend[`${st.id}.${sl}`] ?? M.bind.blend[st.id] ?? { [M.bind.bone]: 1 };
  const skinSt = (sid) => skinT.stations.find((s) => s.id === sid) ?? null;
  let rings = M.stations.map((st, i) => ({ points: { ...st.points }, w: Object.fromEntries(slots.map((sl) => [sl, wOf(st, sl)])), skin: i >= from ? skinSt(T.stations[i - from].id) : null, skirt: 0 }));
  // the SKIRT's rings: the hip's carried straight down to the hem, the thigh's share in toward each side and down
  const base = rings[0], z0 = ctr(base.points)[2], n = Math.max(2, Math.ceil((z0 - zHem) / 0.025)), skirt = [];
  for (let k = n; k >= 1; k--) {
    const f = k / n, dz = (z0 - zHem) * f;
    const w = Object.fromEntries(slots.map((sl) => { const x = base.points[sl][0], a = ease3((Math.abs(x) - 0.02) / 0.06); return [sl, four(mixW(base.w[sl], { [`thigh${x >= 0 ? 'R' : 'L'}`]: 1 }, 0.55 * a * f))]; }));
    skirt.push({ points: Object.fromEntries(slots.map((sl) => { const p = base.points[sl]; return [sl, [p[0], p[1], p[2] - dz]]; })), w, skin: null, skirt: f });
  }
  rings = [...skirt, ...rings];

  // what the jacket is worn over (the trousers' cloth, the skin of the hips and the thighs), for the belt and the skirt
  const below = [...Object.values(under), ...['pelvis', 'thighR', 'thighL'].map((k) => recipe.parts[k]).filter(Boolean)].flatMap(pts).filter((q) => q[2] < zBeltTop + 0.03);
  const needAt = (c) => { const near = below.filter((q) => Math.abs(q[2] - c[2]) < 0.02); return (dh) => { let m = 0; for (const q of near) { const vx = q[0] - c[0], vy = q[1] - c[1], pr = vx * dh[0] + vy * dh[1]; if (pr > m && Math.abs(vx * dh[1] - vy * dh[0]) < 0.025) m = pr; } return m; }; };
  // (the blouse's profile over the belt: its overhang just above the belt, gone `blouseLen` up)
  const bump = (h) => (h < 0 ? 0 : h < 0.02 ? 0.6 + 0.4 * ease3(h / 0.02) : 1 - ease3((h - 0.02) / (F.blouseLen - 0.02)));

  // THE DRAPE, from the collar down
  let prev = null, zPrev = null;
  for (let i = rings.length - 1; i >= 0; i--) {
    const rg = rings[i], c = ctr(rg.points), z = c[2], need = needAt(c), fall = [];
    rg.points = Object.fromEntries(slots.map((sl, j) => {
      const p = rg.points[sl], d = unitv(sub(p, c)), r = len(sub(p, c)), dh = unitv([d[0], d[1], 0]);
      const fold = (k) => k * F.fold * Math.sin((2 * Math.PI * F.folds * j) / N);
      let Rj, Rf;
      if (z > zChest) Rf = Rj = r;
      else if (z > zBeltTop) { Rf = Math.max(r + F.slack * ease3((zChest - z) / 0.1), prev ? prev[j] - F.taper * (zPrev - z) : 0); Rj = Rf + F.blouse * bump(z - zBeltTop) + fold(0.5 * ease3((zChest - z) / 0.1)); }
      else {
        const under0 = need(dh), cinch = under0 > 0 ? under0 + 0.003 : r - F.ease / 2;
        if (z >= zBeltBot) Rf = Rj = cinch;
        else {
          Rf = Math.max(r + F.skirtSlack, under0 + F.clear, prev && zPrev < zBeltBot ? prev[j] - F.taper * 0.5 * (zPrev - z) : 0);
          Rj = cinch + (Rf - cinch) * ease3((zBeltBot - z) / 0.03) + fold(1 + 1.5 * rg.skirt);
        }
      }
      fall.push(Rf);
      return [sl, add(c, scl(d, Rj)).map(r6)];
    }));
    prev = fall; zPrev = z;
  }

  // THE WRAP: the collar's path off the draped cloth, then the V taken under the skin
  const C = rings.map((rg) => ctr(rg.points)), hw = (z) => F.vTop * Math.max(0, Math.min(1, (z - zV) / (C[C.length - 1][2] - zV)));
  const nearest = (z) => C.reduce((b, c, i) => (Math.abs(c[2] - z) < Math.abs(C[b][2] - z) ? i : b), 0);
  // (the point on a ring's front where it crosses x = xs off its middle)
  const edge = (i, xs) => {
    const c = C[i], Q = slots.map((sl) => rings[i].points[sl]);
    for (let j = 0; j < N; j++) {
      const a = Q[j], b = Q[(j + 1) % N]; if (a[1] - c[1] <= 0 && b[1] - c[1] <= 0) continue;
      const fa = a[0] - c[0] - xs, fb = b[0] - c[0] - xs; if (fa === 0) return a;
      if (fa * fb < 0) { const t = fa / (fa - fb); return a.map((x, k) => x + (b[k] - x) * t); }
    }
    return null;
  };
  const torsoIx = rings.map((rg, i) => (rg.skin ? i : -1)).filter((i) => i >= 0), top = rings.length - 1;
  const right = torsoIx.filter((i) => C[i][2] > zV + 0.03).map((i) => edge(i, hw(C[i][2]))).filter(Boolean);
  const left = torsoIx.filter((i) => C[i][2] > zV).map((i) => edge(i, -hw(C[i][2]))).filter(Boolean).reverse();
  const angle = (p) => { const a = Math.atan2(p[1] - C[top][1], p[0] - C[top][0]); return a > Math.PI / 2 ? a - 2 * Math.PI : a; };
  const inV = (p, c, z) => p[1] - c[1] > 0 && Math.abs(p[0] - c[0]) < hw(z);
  const collar = slots.map((sl) => rings[top].points[sl]).filter((p) => !inV(p, C[top], C[top][2])).sort((a, b) => angle(b) - angle(a));
  const on = []; for (let z = zV - 0.012; z > zBeltTop + 0.004; z -= 0.012) { const e = edge(nearest(z), F.cross * ((zV - z) / (zV - zBeltTop))); if (e) on.push(e); }
  const lapelPath = [...right, ...collar, ...left, ...on], overFrom = right.length + collar.length;
  const flapPath = []; for (let z = zBeltBot - 0.004; z > zHem + 0.006; z -= 0.015) { const e = edge(nearest(z), F.cross + 0.03 * ((zBeltBot - z) / (zBeltBot - zHem))); if (e) flapPath.push(e); }
  for (const i of torsoIx) {
    const rg = rings[i], c = C[i];
    if (c[2] <= zV) continue;
    for (const sl of slots) { const p = rg.points[sl]; if (!inV(p, c, c[2])) continue; const d = unitv(sub(p, c)); rg.points[sl] = sub(rg.skin.points[sl], scl(d, 0.003)).map(r6); }
  }

  // THE HEM TURNED: a ring a quarter of the hem's, up at the crotch, inside. The body runs from the collar down to it,
  // its cap's pole back toward the opening: the loft winds the whole tube by its first band and a cap outward from its
  // ring, which a fold turned back on itself keeps only so (the fold's own band faces in)
  const hemC = C[0], lin = { points: Object.fromEntries(slots.map((sl) => { const p = rings[0].points[sl]; return [sl, add([hemC[0], hemC[1], zCrotch + 0.01], scl(sub(p, hemC), 0.25)).map(r6)]; })), w: rings[skirt.length].w };
  const all = [...rings.slice().reverse(), lin], cs = all.map((rg) => ctr(rg.points)), rad = (i) => slots.reduce((s, sl) => s + len(sub(all[i].points[sl], cs[i])), 0) / N;
  const blend = {}; all.forEach((rg, i) => { for (const sl of slots) blend[`st${i}.${sl}`] = rg.w[sl]; });
  const L = all.length - 1; blend.back = ringW(all[0].w); blend.tip = ringW(lin.w);
  const body = { ...M, garment: true, group: 'Top', stations: all.map((rg, i) => ({ id: `st${i}`, u: i, points: rg.points })),
    caps: { back: add(cs[0], scl(unitv(sub(cs[0], cs[1])), rad(0) / 3)).map(r6), tip: add(cs[L], scl(unitv(sub(cs[L - 1], cs[L])), rad(L) / 3)).map(r6) },
    bind: { bone: M.bind.bone, blend } };

  const out = { [`${id}_body`]: body };
  // THE SLEEVES: draped as a leg is, one tube, the hem turned back in to the arm
  for (const S of ['R', 'L']) {
    const U = parts[`${id}_upperArm${S}`], A = parts[`${id}_foreArm${S}`]; if (!U || !A) continue;
    const rest = { ...A.stations[A.stations.length - 1].points }, restC = mean(Object.values(rest));
    drapeLeg([U, A], S === 'R' ? 1 : -1, F.sleeve);
    const sv = oneLeg(U, A), last = sv.stations[sv.stations.length - 1], lc = mean(sv.slots.map((sl) => last.points[sl])), prevC = mean(sv.slots.map((sl) => sv.stations[sv.stations.length - 2].points[sl]));
    const axis = unitv(sub(lc, prevC)), linC = sub(lc, scl(axis, 0.03));
    // (the arm's slots on the forearm's ring: the sleeve's taken round at the upper arm's, so each found by its share of the turn)
    const rs = A.slots, at = (j) => rest[rs[Math.round((j * rs.length) / sv.slots.length) % rs.length]];
    const linPts = Object.fromEntries(sv.slots.map((sl, j) => { const q = at(j), d = unitv(sub(q, restC)); return [sl, add(linC, scl(d, Math.max(0.01, len(sub(q, restC)) - 0.004))).map(r6)]; }));
    const id2 = `st${sv.stations.length}`, lw = {}; for (const sl of sv.slots) { lw[sl] = sv.bind.blend[`${last.id}.${sl}`] ?? { [sv.bind.bone]: 1 }; sv.bind.blend[`${id2}.${sl}`] = lw[sl]; }
    const linR = sv.slots.reduce((s, sl) => s + len(sub(linPts[sl], linC)), 0) / sv.slots.length;
    sv.stations = [...sv.stations, { id: id2, u: (last.u ?? 0) + 0.01, points: linPts }];
    sv.caps = { ...sv.caps, tip: add(linC, scl(axis, linR / 3)).map(r6) };
    sv.bind.blend.tip = ringW(lw);
    out[`${id}_sleeve${S}`] = { ...sv, garment: true, group: 'Top' };
  }

  // THE COLLAR and THE FLAP: ribbons lying on the cloth
  const near = (p) => C[nearest(p[2])];
  const lapel = ribbon(lapelPath, near, { ...F.lapel, over: { from: overFrom, by: 0.003 } });
  if (lapel) out[`${id}Lapel`] = { ...lapel, group: 'TopFold', bind: bindRibbon(lapel, body) };
  const flap = ribbon(flapPath, near, { w: 0.014, t: 0.004 });
  if (flap) out[`${id}Flap`] = { ...flap, group: 'TopFold', bind: bindRibbon(flap, body) };
  // THE BELT over the jacket
  const beltAt = cs.slice(0, L).reduce((b, c, i) => (Math.abs(c[2] - zBelt) < Math.abs(cs[b][2] - zBelt) ? i : b), 0);
  Object.assign(out, sashOn(body, out, id, { at: beltAt, seg: 'body', width: F.belt }));
  return { parts: out, tones: { Sash: LOOSE_TONES.Sash } };
}

/** a ribbon's bind off the cloth under it: each station (and each cap) the weights of the cloth's point nearest its
 * middle, all four of its corners alike (each corner its own nearest had parted a thin ribbon's faces in a stride) */
function bindRibbon(rib, P) {
  const own = { [P.bind.bone]: 1 }, src = P.stations.flatMap((st) => Object.entries(st.points).map(([sl, p]) => [p, P.bind.blend?.[`${st.id}.${sl}`] ?? own]));
  const nearest = (q) => src.reduce((b, s) => { const d = (s[0][0] - q[0]) ** 2 + (s[0][1] - q[1]) ** 2 + (s[0][2] - q[2]) ** 2; return d < b[0] ? [d, s[1]] : b; }, [Infinity, own])[1];
  const blend = {};
  for (const st of rib.stations) { const w = nearest(mean(Object.values(st.points))); for (const sl of rib.slots) blend[`${st.id}.${sl}`] = w; }
  for (const [k, q] of Object.entries(rib.caps)) blend[k] = nearest(q);
  return { bone: P.bind.bone, blend };
}

/** a RIBBON along `path` lying on the cloth (`w` across it, `t` thick, its centre `t`/2 off the surface, and `over.by`
 * more from the path's point `over.from` on, so a panel's edge lies over the one it crosses; its outside the horizontal
 * out from the trunk's middle `near(p)` there): the path resampled every 12 mm and smoothed; a box section on
 * ringSlots(4), its caps a hair past its ends */
function ribbon(path, near, { w, t, over = null }) {
  if (path.length < 2) return null;
  // (resampled by length, every 12 mm, then smoothed twice, its ends kept)
  const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + len(sub(path[i], path[i - 1])));
  const total = cum[cum.length - 1], K = Math.max(2, Math.round(total / 0.012)), along = [];
  for (let k = 0; k <= K; k++) { const s = (total * k) / K; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0; along.push(path[i - 1].map((x, q) => x + (path[i][q] - x) * f)); }
  let P = along; for (let it = 0; it < 2; it++) P = P.map((p, i) => (i === 0 || i === P.length - 1 ? p : p.map((x, q) => 0.25 * P[i - 1][q] + 0.5 * x + 0.25 * P[i + 1][q])));
  const names = ringSlots(4), corner = [[1, 1], [1, -1], [-1, -1], [-1, 1]], overAt = over ? (cum[over.from] ?? total) / total : 2;
  const stations = P.map((p, i) => {
    const tn = unitv(sub(P[Math.min(i + 1, P.length - 1)], P[Math.max(i - 1, 0)])), c = near(p), nn = unitv([p[0] - c[0], p[1] - c[1], 0]), a = unitv(cross(tn, nn));
    const m = add(p, scl(nn, t / 2 + 0.002 + (over ? over.by * ease3((i / K - overAt) / 0.08) : 0)));
    return { id: `st${i}`, u: i, points: Object.fromEntries(names.map((nm, j) => [nm, add(m, add(scl(a, (corner[j][0] * w) / 2), scl(nn, (corner[j][1] * t) / 2))).map(r6)])) };
  });
  const mid = (st) => mean(Object.values(st.points)), d0 = unitv(sub(mid(stations[1]), mid(stations[0]))), d1 = unitv(sub(mid(stations[stations.length - 1]), mid(stations[stations.length - 2])));
  return { layer: 1, closure: 'closed', slots: names, stations, caps: { back: sub(mid(stations[0]), scl(d0, 0.001)).map(r6), tip: add(mid(stations[stations.length - 1]), scl(d1, 0.001)).map(r6) } };
}
