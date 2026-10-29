/**
 * AUTHORED JACKET — the jacket as built (body-relational-jacket.js, the realistic body's; docs/garment-principles.md,
 * "a jacket opens") on the GAME BODY, the authored and the tiered hero, where the outer garment was a closed tube with its
 * opening painted on it. Run from the kit hook (authored-kit.js) when the outfit names a jacket's CONSTRUCTION
 * (`tailoring.jacket`: `zip`, `open`, `rib`, `pockets`, `epaulettes`, `collar: 'shirt'`):
 *
 *   the OPENING  each of the jacket's own pieces on the trunk (`outer_torso`, `outerTail_pelvis`) and its collar opened at
 *                the centre front (`openFront`: a C in section, two real edges), by one gap down the whole jacket: a
 *                zip's, or worn open, widening up the chest. The pieces keep their names and their stations' ids (what was
 *                placed on them, and the dials, find them), their trims carried across the opening (`bandGroups` read
 *                round the ring from the front edge)
 *   its PIECES   the zip down the front, the rib waistband and cuffs, the flapped pockets, the shirt collar's points, the
 *                epaulettes (`zipDown`, `jacketPieces`), laid on a VIEW of the jacket as the realistic body makes it: its
 *                trunk pieces one tube (`oneTube`, the tail and the body) opened as the pieces are, each sleeve one tube
 *
 *   authoredJacket(recipe, cloth, J, { read }) → { parts, carriers }   `parts` the opened pieces (by their own names) and
 *       the new ones; `carriers` each new piece's body part, for the dials (authored-kit.js followDials); `read` the
 *       garments under the jacket as they are read (authored-kit.js readOf: rings put between the game body's sparse ones)
 * The game body's ring is ring12: it is opened to `ARC` points a side (the realistic body's 25 would be a hundred points
 * round a twelve-sided cloth). Weights by ring (`rings`). Pure and deterministic.
 */
import { openFront, zipDown, jacketPieces, JACKET } from './body-relational-jacket.js';
import { oneTube, cinchWaist, clearanceOver } from './body-relational-tailor.js';
import { denseRead } from './authored-tailoring.js';

/** the opened ring's points a side (its slots 4·ARC − 2) */
export const ARC = 10;
/** the jacket's own pieces on the game body, by their role: the trunk (top to bottom: the body, then its tail), the
 * sleeves (the upper arm's, the forearm's), the collar */
const BODY = ['outer_torso', 'outerTail_pelvis'], SLEEVE = (S) => [`outerSleeve_upperArm${S}`, `outerCuff_foreArm${S}`], COLLAR = 'outerCollar_neck';

const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const middle = (st) => mean(Object.values(st.points));

/** a piece opened (openFront) with its TRIMS carried over: each band's groups (one a half-ring slot, front to back) read
 * for the opened ring by place round it from the front edge, the outer face's and the inner face's alike */
function opened(P, gap) {
  const O = openFront(P, { gap, arc: ARC }), half = P.slots.length / 2, N = O.slots.length, H = N / 2, m = ARC;
  if (!P.bandGroups) return O;
  const at = (k) => Math.min(half - 1, Math.round((k < m ? 1 - k / Math.max(1, m - 1) : (k - m) / Math.max(1, H - 1 - m)) * (half - 1)));
  return { ...O, bandGroups: Object.fromEntries(Object.entries(P.bandGroups).map(([band, G]) => [band, Array.from({ length: H }, (_, k) => G[at(k)])])) };
}

/** The jacket on the game body (see the head of this file). `cloth` the recipe's garments by name. */
export function authoredJacket(recipe, cloth, J, { read = (P) => P } = {}) {
  const parts = {}, carriers = {};
  const body = BODY.filter((k) => cloth[k]);
  if (!J || !body.length) return { parts, carriers };
  if (J.cloth) for (const [k, P] of Object.entries(cloth)) if (/^outer[A-Z]?\w*_/.test(k)) parts[k] = { ...P, cloth: J.cloth };
  if (!(J.zip || J.open)) return { parts, carriers };
  const own = (k) => parts[k] ?? cloth[k];
  // THE OPENING: one gap down the whole jacket (its trunk pieces' height): a zip's, or open, widening up the chest
  const zs = body.flatMap((k) => own(k).stations.map((st) => middle(st)[2])), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const gapAt = J.open ? (z) => 0.07 + 0.08 * Math.max(0, Math.min(1, (z - z0) / (z1 - z0))) : () => JACKET.zipGap;
  for (const k of body) parts[k] = opened(own(k), gapAt);
  if (cloth[COLLAR]) parts[COLLAR] = opened(own(COLLAR), () => gapAt(z1));
  // THE VIEW the pieces are laid on: the trunk one tube (its tail's rings below the body's, then the body's) opened as its
  // pieces are, each sleeve one tube; every other garment as worn (under the jacket)
  // (from the pieces as worn, before they were opened)
  const trunk = body.length === 2 ? oneTube(cloth.outerTail_pelvis, cloth.outer_torso) : cloth[body[0]];
  const view = Object.fromEntries(Object.entries(cloth).filter(([k]) => !/^outer[A-Z]?\w*_/.test(k)).map(([k, P]) => [k, read(P)]));
  view.outer_body = { ...openFront(trunk, { gap: gapAt, arc: ARC }), garment: true, group: trunk.group };
  for (const S of ['R', 'L']) { const [a, b] = SLEEVE(S).map((k) => cloth[k]); if (a) view[`outer_arm${S}`] = b ? oneTube(a, b) : a; }
  const made = {};
  if (J.zip && !J.open) Object.assign(made, zipDown(view.outer_body, 'outerZip', { group: 'Buckle', tape: view.outer_body.group ?? 'Outer' }));
  // (the shoulders, where the epaulettes start: each upper arm's first ring, the rig not yet made where the dress is)
  const joints = Object.fromEntries(['R', 'L'].filter((S) => recipe.parts[`upperArm${S}`]).map((S) => [`shoulder${S}`, middle(recipe.parts[`upperArm${S}`].stations[0])]));
  Object.assign(made, jacketPieces(view, 'outer_body', J, { ...recipe, rig: { ...(recipe.rig || {}), joints: { ...(recipe.rig?.joints || {}), ...joints } } }, { gapAt, gathered: {}, rings: true, around: 24 }));
  // (each new piece's body part: a cuff its forearm's, the rest the trunk's at its height)
  const zTorso = Math.min(...(recipe.parts.torso?.stations ?? []).map((st) => middle(st)[2]));
  for (const [k, P] of Object.entries(made)) {
    parts[k] = P;
    const cuff = /cuff([RL])$/.exec(k);
    carriers[k] = cuff ? `foreArm${cuff[1]}` : mean(P.stations.flatMap((st) => Object.values(st.points)))[2] >= zTorso ? 'torso' : 'pelvis';
  }
  return { parts, carriers };
}

/** THE FIT of a jacket on the game body: its ease over what it is worn over (m): a layer's step and a tailored jacket's
 * wearing ease, about 2.5 cm of girth over the shirt */
export const FIT = Object.freeze({ trunk: 0.0075, sleeve: 0.006 });
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** a SLEEVE brought onto what it is worn over, in place: each ring's points along their own radial (square to the arm),
 * never closer than `gap` past the farthest thing under them within a slab of the ring and a lane of the ray, never
 * farther than they stood */
function fitSleeve(P, under, gap) {
  const C = P.stations.map((st) => middle(st));
  P.stations.forEach((st, i) => {
    const a0 = C[Math.max(0, i - 1)], a1 = C[Math.min(C.length - 1, i + 1)], ax = sub(a1, a0), l = Math.hypot(...ax) || 1, a = ax.map((v) => v / l), c = C[i];
    const near = under.filter((q) => Math.abs(dot(sub(q, c), a)) < 0.01);
    for (const sl of P.slots) {
      const v = sub(st.points[sl], c), along = dot(v, a), o = v.map((x, k) => x - a[k] * along), r = Math.hypot(...o) || 1e-9, d = o.map((x) => x / r);
      let reach = 0; for (const q of near) { const w = sub(q, c), pr = dot(w, d), lat = Math.hypot(...w.map((x, k) => x - a[k] * dot(w, a) - d[k] * pr)); if (pr > reach && lat < 0.012) reach = pr; }
      if (!reach) continue;
      const to = reach + gap; if (to < r) st.points[sl] = c.map((x, k) => Math.round((x + a[k] * along + d[k] * to) * 1e6) / 1e6);
    }
  });
  return P;
}
/**
 * THE JACKET FITTED (the game body's: the outer layer's pieces on the trunk and the arms, a coat's skirt and a panel aside),
 * brought in onto what it is worn over: its trunk pieces level (cinchWaist over the whole piece), its sleeves square to the
 * arm, each `FIT` past the garments worn before it there and the skin, read densified; never let out. The silhouette is the
 * cut's, the belt's and the layers', not the ease's (docs/garment-principles.md). → { name: piece }, the pieces refitted
 */
export function fitJacket(recipe, cloth) {
  const out = {}, names = Object.keys(cloth), order = (k) => names.indexOf(k);
  const before = (k, re) => names.filter((n) => order(n) < order(k) && re.test(n)).map((n) => cloth[n]);
  const skin = (ks) => ks.map((k) => recipe.parts[k]).filter(Boolean);
  for (const k of BODY.filter((n) => cloth[n])) {
    const under = [...before(k, /_(torso|pelvis)$/), ...skin(['torso', 'pelvis'])].map(denseRead).flatMap(pointsOf);
    out[k] = cinchWaist(structuredClone(cloth[k]), under, { zw: -1e9, zb: -1e9, zt: 1e9 }, { gap: FIT.trunk, band: 0.012 });
  }
  for (const S of ['R', 'L']) for (const k of SLEEVE(S).filter((n) => cloth[n])) {
    const under = [...before(k, new RegExp(`_(upperArm|foreArm)${S}$`)), ...skin([`upperArm${S}`, `foreArm${S}`])].map(denseRead).flatMap(pointsOf);
    out[k] = fitSleeve(structuredClone(cloth[k]), under, FIT.sleeve);
  }
  return out;
}

/** THE SLEEVES' SEAM at the shoulder (on copies → { name: piece }). Each tube is closed at the shoulder by a cap pinched
 * past its first ring, and the skin's reached farther over the shoulder's dome than any sleeve's: the dome showed through
 * every layer there, painted as the shirt (a white patch on a suit's shoulder). So each sleeve that starts on the arm's
 * first ring takes its cap out past the skin's own by its own ease there, the layers nesting at the dome as they do down
 * the arm; and a sleeve worn under another takes the outer's colour on its cap and its first bands, where the two ends meet */
export function sleeveSeams(recipe, cloth) {
  const out = {}, names = Object.keys(cloth);
  for (const S of ['R', 'L']) {
    const arm = recipe.parts[`upperArm${S}`];
    const sleeves = names.filter((n) => new RegExp(`^\\w+_upperArm${S}$`).test(n) && cloth[n].garment && Array.isArray(cloth[n].stations));
    if (!sleeves.length) continue;
    const radius = (st) => { const c = middle(st), ps = Object.values(st.points); return ps.reduce((t, p) => t + Math.hypot(...sub(p, c)), 0) / ps.length; };
    for (const n of sleeves) {
      const P = cloth[n];
      if (!arm?.caps?.back || P.stations[0].id !== arm.stations[0].id) continue;
      const cb = middle(arm.stations[0]), d = sub(arm.caps.back, cb), l = Math.hypot(...d) || 1, e = Math.max(0, radius(P.stations[0]) - radius(arm.stations[0])) + 0.002;
      out[n] = { ...P, caps: { ...P.caps, back: arm.caps.back.map((v, k) => Math.round((v + (d[k] / l) * e) * 1e6) / 1e6) } };
    }
    const g = cloth[sleeves[sleeves.length - 1]].group;
    for (const n of sleeves.slice(0, -1)) {
      const P = out[n] ?? cloth[n], half = P.slots.length / 2, ids = P.stations.map((st) => st.id), bands = { ...(P.bandGroups || {}) };
      for (let i = 0; i < Math.min(2, ids.length - 1); i++) bands[`${ids[i]}-${ids[i + 1]}`] = Array(half).fill(g);
      out[n] = { ...P, bandGroups: bands, capGroups: { ...(P.capGroups || {}), back: g } };
    }
  }
  return out;
}

/** THE SHOULDER SOCKETS UNDER A SLEEVE. The tiered body's shoulder is a socket of its own between the trunk and the arm
 * (its ball, its cone and its web), which no garment covers and which is painted as the shirt: a white patch at a suit's
 * shoulders, the tee's green under a flight jacket. Each takes the outermost sleeve's colour on its side, so the shoulder
 * reads as the jacket over it, as a realistic jacket's one cloth over the shoulder does. → { name: part } */
export function shoulderUnderJacket(recipe, cloth) {
  const out = {}, names = Object.keys(cloth);
  for (const S of ['R', 'L']) {
    const sleeve = names.filter((n) => new RegExp(`_upperArm${S}$`).test(n) && cloth[n].garment).pop();
    if (!sleeve) continue;
    for (const k of [`shoulderBall${S}`, `shoulderCone${S}`, `shoulderWeb${S}`]) {
      const P = recipe.parts[k]; if (!P || P.group === 'Skin') continue;
      const { bandGroups: _b, capGroups: _c, ...rest } = P;
      out[k] = { ...rest, group: cloth[sleeve].group ?? P.group };
    }
  }
  return out;
}

/** the shirt's collar on its neckline (m): its stand over the neckline at the front and at the back, how far it goes on
 * down under it, and how far off the neck it stands */
export const STAND = Object.freeze({ front: 0.026, back: 0.03, tuck: 0.012, ease: 0.005 });
/**
 * THE SHIRT'S COLLAR STOOD ON ITS NECKLINE (the game body's; on a copy → { name: piece }). The collar was a level band
 * up the neck's first third, and the shirt's neckline tilts 7 cm from the front up to the back: at the back the collar
 * stood no higher than the shirt's own top, and the jacket over the shirt hid it all round the neck. Its rings now
 * follow the neckline round: from `STAND.tuck` under it to its stand over it (lower in front, higher behind), each point
 * `STAND.ease` off the neck at its own height. Its stations, its slots, its weights and its trims are kept; its caps in
 * the neck.
 */
export function standCollar(recipe, cloth) {
  const C = cloth.topCollar_neck, shirt = cloth.top_torso, neck = recipe.parts.neck;
  if (!C?.stations || !shirt?.stations || !neck?.stations) return {};
  const N = denseRead(neck), NC = N.stations.map(middle).sort((a, b) => a[2] - b[2]), reach = clearanceOver(pointsOf(N), 0.008);
  const cAt = (z) => { if (z <= NC[0][2]) return NC[0]; for (let i = 1; i < NC.length; i++) if (NC[i][2] >= z) { const f = (z - NC[i - 1][2]) / (NC[i][2] - NC[i - 1][2] || 1); return NC[i - 1].map((v, k) => v + (NC[i][k] - v) * f); } return NC[NC.length - 1]; };
  // (the neckline: the shirt's top ring, its height by its angle round the neck)
  const top = Object.values(shirt.stations[shirt.stations.length - 1].points), c0 = cAt(mean(top)[2]);
  const line = top.map((p) => [Math.atan2(p[1] - c0[1], p[0] - c0[0]), p[2]]).sort((a, b) => a[0] - b[0]);
  const zAt = (t) => {
    const i = line.findIndex(([a]) => a >= t), [a0, z0] = i <= 0 ? [line[line.length - 1][0] - 2 * Math.PI, line[line.length - 1][1]] : line[i - 1], [a1, z1] = i < 0 ? [line[0][0] + 2 * Math.PI, line[0][1]] : line[i];
    return z0 + (z1 - z0) * ((t - a0) / (a1 - a0 || 1));
  };
  const n = C.stations.length, cb = middle(C.stations[0]);
  const stations = C.stations.map((st, i) => ({ ...st, points: Object.fromEntries(C.slots.map((sl) => {
    const p = st.points[sl], h = [p[0] - cb[0], p[1] - cb[1]], l = Math.hypot(...h) || 1, d = [h[0] / l, h[1] / l], t = Math.atan2(d[1], d[0]);
    const z = zAt(t) - STAND.tuck + (STAND.tuck + STAND.front + (STAND.back - STAND.front) * (1 - d[1]) / 2) * (i / (n - 1)), c = cAt(z);
    const r = (reach([c[0], c[1], z])(d) || Math.hypot(p[0] - c[0], p[1] - c[1])) + STAND.ease;
    return [sl, [c[0] + d[0] * r, c[1] + d[1] * r, z].map((v) => Math.round(v * 1e6) / 1e6)];
  })) }));
  const ends = [stations[0], stations[n - 1]].map(middle);
  return { topCollar_neck: { ...C, stations, caps: { back: cAt(ends[0][2] - 0.004).map((v) => Math.round(v * 1e6) / 1e6), tip: cAt(ends[1][2]).map((v) => Math.round(v * 1e6) / 1e6) } } };
}
