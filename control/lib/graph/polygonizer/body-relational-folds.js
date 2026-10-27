/**
 * THE CLOTH'S FOLDS on the realistic body (realistic laws 8): the folds a game draws, not a simulation's. A few broad
 * ridges where cloth gathers, shaped to read at a glance and to keep reading as the body moves (a ridge rides the cloth's
 * own weights, so a bend closes the crescents it already shows), never a ripple everywhere. Each a ridge OUT from the
 * cloth (no point is taken in, so nothing worn under it is let through), its crease side sharp and its other side soft
 * (light rakes off the soft side and the crease holds a line of shade), its size the cloth's weight (`FOLD_CLOTH`).
 *
 * The motifs, each where the body makes it:
 *   - CRESCENTS inside the elbow and behind the knee: the sleeve and the trouser leg crushed on the bend's inner side,
 *     two or three curved ridges about the joint, their horns toward the limb's sides;
 *   - STACKS over a boot's top and a sleeve's cuff: the cloth that has nowhere to go piled in rolls, each rolled a
 *     little off true round the limb;
 *   - BLOUSING above a belt: the shirt let out over it in a soft roll, vertical gathers under it, the cloth under the
 *     belt itself flat (a belt cinches).
 *
 *   FOLD_CLOTH                       each cloth weight's ridge: its height, its width, how many
 *   foldCloth(parts, { joints, belts, boots, order })   in place: each garment tube of `parts` refined where a motif lies
 *       (rings inserted, their weights mixed from their neighbours) and its ridges raised; a piece worn under another
 *       there is left (the outer one carries the fold)
 *
 * Deterministic: the rolls' turns from the part's name, no dice. (`beltPts` the belts' points: a garment blouses over a
 * belt only when it runs under it.)
 */
import { mixW } from './body-relational-resample.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (v) => Math.hypot(...v);
const unitv = (v) => { const l = len(v) || 1; return v.map((x) => x / l); };

/** the cloth's weight by the garment's role: a knit shirt folds small and soft, canvas trousers in fewer, sharper
 * ridges, a heavy outer layer broad, leather broadest and fewest. `h` a ridge's height (m), `w` its crease side's width
 * (its soft side twice it), `n` the ridges a crescent or a stack takes */
export const FOLD_CLOTH = Object.freeze({
  knit: { h: 0.006, w: 0.006, n: 3 },
  canvas: { h: 0.009, w: 0.008, n: 3 },
  heavy: { h: 0.011, w: 0.011, n: 2 },
  leather: { h: 0.008, w: 0.014, n: 2 },
});
const weightOf = (group = '') => (/^(Leather|Strap|Belt)/.test(group) ? 'leather' : /^(Outer|Coat|Cape|Cloak)/.test(group) ? 'heavy' : /^(Bottom|Skirt)/.test(group) ? 'canvas' : 'knit');
/** the rings a fold needs: one at least every `step` (m) where it lies */
const STEP = 0.004;
/** an integer hash in [0, 1) */
const hash = (s, k) => { let h = 2166136261; for (const c of `${s}:${k}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h / 4294967296; };
const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));

/** a ridge's profile across it at `d` (m) from its crest: the crease side (d < 0) `w` wide, the soft side 2`w` */
const ridge = (d, w) => Math.exp(-((d / (d < 0 ? w : 2 * w)) ** 2));

/** each station's middle and its length along the tube from the first (m) */
function runOf(P) {
  const C = P.stations.map((st) => mean(P.slots.map((sl) => st.points[sl]))), L = [0];
  for (let i = 1; i < C.length; i++) L.push(L[i - 1] + len(sub(C[i], C[i - 1])));
  return { C, L };
}

/** rings inserted into `P` wherever `want(length)` and its neighbours lie more than STEP apart, each interpolated from
 * its two neighbours (points, `u`, weights); a pair a band is painted on (`bandGroups`) is left whole. In place */
function refine(P, want) {
  const { L } = runOf(P), S = P.stations, out = [], blend = P.bind?.blend, own = P.bind ? { [P.bind.bone]: 1 } : null;
  for (let i = 0; i < S.length; i++) {
    out.push(S[i]);
    if (i + 1 >= S.length) continue;
    const a = S[i], b = S[i + 1], gap = L[i + 1] - L[i];
    if (gap <= STEP * 1.5 || P.bandGroups?.[`${a.id}-${b.id}`] || !want((L[i] + L[i + 1]) / 2, gap)) continue;
    const n = Math.ceil(gap / STEP) - 1;
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1), id = `${a.id}f${k}`;
      out.push({ id, u: r6((a.u ?? i) + ((b.u ?? i + 1) - (a.u ?? i)) * t), points: Object.fromEntries(P.slots.map((sl) => [sl, a.points[sl].map((x, q) => r6(x + (b.points[sl][q] - x) * t))])) });
      if (blend) for (const sl of P.slots) blend[`${id}.${sl}`] = mixW(blend[`${a.id}.${sl}`] ?? own, blend[`${b.id}.${sl}`] ?? own, t);
    }
  }
  P.stations = out;
}

/** each ring point's place for a motif: its length along the tube, its turn round it from `toward` (radians, 0 on it) */
function lay(P) {
  const { C, L } = runOf(P);
  return P.stations.map((st, i) => {
    const ax = unitv(sub(C[Math.min(C.length - 1, i + 1)], C[Math.max(0, i - 1)]));
    return { L: L[i], C: C[i], ax, pts: P.slots.map((sl) => { const p = st.points[sl], r = sub(p, C[i]), radial = sub(r, ax.map((x) => x * dot(r, ax))); return { sl, p, d: unitv(radial) }; }) };
  });
}
/** a point's turn from `toward` round the tube's axis `ax` (0 … π) */
const turnFrom = (d, toward, ax) => { const t = unitv(sub(toward, ax.map((x) => x * dot(toward, ax)))); return Math.acos(Math.max(-1, Math.min(1, dot(d, t)))); };

/**
 * The folds on the garment tubes of `parts` (in place). `joints`: { elbowR, elbowL, kneeR, kneeL, wristR, wristL }
 * (points), `belts`: [[zLo, zHi]] the belts' heights round the trunk, `boots`: { R, L } a boot's top height, `order`: the
 * garments in the order worn (a later one over an earlier).
 */
export function foldCloth(parts, { joints = {}, belts = [], beltPts = [], boots = {}, order = [] } = {}) {
  const tubes = Object.entries(parts).filter(([k, P]) => P.garment && P.layer === 1 && Array.isArray(P.stations) && P.stations.length > 2 && /_(body|torso|pelvis|arm[RL]|leg[RL])$/.test(k));
  // (a garment worn over this one at the same segment carries the fold there)
  const rank = (k) => order.indexOf(k.split('_')[0]), seg = (k) => k.split('_').pop();
  const outer = (k) => tubes.some(([j]) => j !== k && seg(j) === seg(k) && rank(j) > rank(k));
  for (const [k, P] of tubes) {
    if (outer(k)) continue;
    const F = FOLD_CLOTH[weightOf(P.group)], side = k.slice(-1), s = seg(k), motifs = [];
    const { C, L } = runOf(P), at = (q) => { let b = 0; C.forEach((c, i) => { if (len(sub(c, q)) < len(sub(C[b], q))) b = i; }); return L[b]; };
    // CRESCENTS on the bend's inner side: the elbow's front, the knee's back
    const bend = /^arm/.test(s) ? joints[`elbow${side}`] : /^leg/.test(s) ? joints[`knee${side}`] : null;
    if (bend) motifs.push({ kind: 'crescent', at: at(bend), toward: /^arm/.test(s) ? [0, 1, 0] : [0, -1, 0], span: 1.4, gap: F.w * 3, n: F.n, curve: F.w * 4.5 });
    // STACKS: over the boot's top, at the sleeve's cuff
    if (/^leg/.test(s) && boots[side] !== undefined && C.some((c) => c[2] < boots[side] + 0.06)) motifs.push({ kind: 'stack', at: L[C.reduce((b, c, i) => (Math.abs(c[2] - (boots[side] + 0.03)) < Math.abs(C[b][2] - (boots[side] + 0.03)) ? i : b), 0)], gap: F.w * 3, n: F.n });
    if (/^arm/.test(s) && joints[`wrist${side}`]) motifs.push({ kind: 'stack', at: at(joints[`wrist${side}`]) - F.w * 4, gap: F.w * 2.6, n: Math.max(1, F.n - 1) });
    // BLOUSING above each belt the trunk's cloth runs under
    // (only cloth the belt is worn OVER blouses: a jacket over a belt is not gathered by it)
    const under = ([zLo, zHi]) => { const z = (zLo + zHi) / 2, i = C.reduce((b, c, j) => (Math.abs(c[2] - z) < Math.abs(C[b][2] - z) ? j : b), 0), c = C[i];
      const rc = P.slots.reduce((t, sl) => t + Math.hypot(P.stations[i].points[sl][0] - c[0], P.stations[i].points[sl][1] - c[1]), 0) / P.slots.length;
      const near = beltPts.filter((q) => q[2] >= zLo - 0.002 && q[2] <= zHi + 0.002); if (!near.length) return true;
      return rc < near.reduce((t, q) => t + Math.hypot(q[0] - c[0], q[1] - c[1]), 0) / near.length; };
    if (/^(body|torso)$/.test(s)) for (const [zLo, zHi] of belts) if (C.some((c) => c[2] > zHi + 0.01) && C.some((c) => c[2] < zHi) && under([zLo, zHi])) motifs.push({ kind: 'blouse', zLo, zHi });
    if (!motifs.length) continue;
    // the extent each motif reaches along the tube (m)
    const reach = (M) => (M.kind === 'blouse' ? null : [M.at - (M.n + 1) * M.gap - M.curve * 1.5 - 0.01, M.at + (M.n + 1) * M.gap + 0.01]);
    const zOf = (Lm) => { let i = 1; while (i < L.length - 1 && L[i] < Lm) i++; const f = (Lm - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return C[i - 1][2] + (C[i][2] - C[i - 1][2]) * Math.max(0, Math.min(1, f)); };
    refine(P, (Lm) => motifs.some((M) => { if (M.kind === 'blouse') { const z = zOf(Lm); return z > M.zLo - 0.06 && z < M.zHi + 0.05; } const [a, b] = reach(M); return Lm > a && Lm < b; }));
    const R = lay(P);
    for (const ring of R) for (const pt of ring.pts) {
      let h = 0;
      for (const M of motifs) {
        if (M.kind === 'crescent') {
          // (each ridge's crest bowed along the limb by its turn from the inner side: a crescent, its horns away from the joint)
          const th = turnFrom(pt.d, M.toward, ring.ax), fall = Math.max(0, 1 - (th / M.span) ** 2) ** 1.5;
          if (fall <= 0) continue;
          for (let q = 0; q < M.n; q++) { const crest = M.at + (q - (M.n - 1) / 2) * M.gap + M.curve * (th / M.span) ** 2 * (q < (M.n - 1) / 2 ? -1 : 1); h = Math.max(h, F.h * fall * (1 - 0.18 * Math.abs(q - (M.n - 1) / 2)) * ridge(ring.L - crest, F.w)); }
        } else if (M.kind === 'stack') {
          // (each roll round the whole limb, a little off true: its crest wanders along it with the turn)
          const th = Math.atan2(pt.d[0], pt.d[1]);
          for (let q = 0; q < M.n; q++) { const ph = hash(k, q) * Math.PI * 2, crest = M.at + (q - (M.n - 1) / 2) * M.gap + F.w * 0.8 * Math.sin(2 * th + ph), lob = 0.7 + 0.3 * Math.cos(3 * th + ph * 1.7); h = Math.max(h, F.h * lob * ridge(ring.L - crest, F.w)); }
        } else {
          // (the roll over the belt's top, the gathers falling from it, flat under the belt itself)
          const z = ring.C[2], th = Math.atan2(pt.d[0], pt.d[1]), ph = hash(k, 'blouse') * Math.PI * 2;
          const roll = ridge(z - (M.zHi + 0.012), 0.01) * F.h * 1.6;
          const gathers = Math.max(0, Math.cos(11 * th + ph)) ** 2 * F.h * (ramp(z, M.zHi + 0.004, M.zHi + 0.014) * (1 - ramp(z, M.zHi + 0.02, M.zHi + 0.05)) + (1 - ramp(z, M.zLo - 0.06, M.zLo - 0.004)) * ramp(z, M.zLo - 0.06, M.zLo - 0.03));
          if (z > M.zLo - 0.003 && z < M.zHi + 0.003) continue;
          h = Math.max(h, roll + gathers);
        }
      }
      if (h > 1e-5) { const st = P.stations[R.indexOf(ring)]; st.points[pt.sl] = pt.p.map((x, q) => r6(x + pt.d[q] * h)); }
    }
  }
  return parts;
}
