// vegetation/palm — palms: lignification WITHOUT a cambium, stacked in time.
//
// A palm is the corner of the two-dial space where lignin is high and cambium is zero (lignin without cambium):
//   · ESTABLISHMENT: the seedling builds the stem's full girth at the base before the trunk elongates; from then on
//     the diameter is fixed and there are no rings.
//   · SUSTAINED LIGNIFICATION (Rich 1987): every internode keeps thickening and lignifying its fibre walls for decades,
//     so the trunk is a STACK of internodes whose stiffness and density rise with their age — soft under the crown,
//     dense at the base, denser at the periphery than at the centre. Greenhill with d fixed: h_crit ∝ E^(1/3), so a
//     palm raises its height ceiling by stiffening, not by thickening.
//   · NO REACTION WOOD: reaction wood is laid in new rings, and a palm lays none. A lean is frozen into the trunk; only
//     the apex turns back up (apical gravitropism), which draws the curved coconut trunk.
//   · The CROWN is a cohort: one frond per node on a phyllotactic spiral, its insertion angle set by its age, its droop
//     an elastica (mechanics.js); dead fronds fall (coconut) or stay as a skirt (Washingtonia).
//   · The TRUNK'S SURFACE is the phyllotaxis: scar rings, or persistent leaf bases in a rhombic lattice whose spirals
//     (parastichies) come in consecutive Fibonacci numbers — the plant's chirality, legible.
// Deterministic: mulberry32 dice from the seed.
import { elastica, G } from './mechanics.js';
import { mulberry32, vec, rot } from './grow.js';
import { blobTris } from './tree-mesh.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';
const { add, sub, mul, dot, cross, len, unit } = vec;
const UP = [0, 0, 1]; const DEG = Math.PI / 180;
function perp(d) { const a = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]; return unit(cross(a, d)); }

// ── buckling of a column whose stiffness and weight vary along it (Rayleigh–Ritz) ──────────────────────────
// Clamped base, free top, self-weight q(z) plus a top load P (the crown). Modes y = (z/H)^(k+1), k = 1..K.
//   λ = min_a (aᵀ K a)/(aᵀ G a),  K_ij = ∫ EI y_i'' y_j'' dz,  G_ij = ∫ N(z) y_i' y_j' dz,  N(z) = P + ∫_z^H q
// λ is the factor on the loads at which the column buckles: the safety factor against self-buckling.
export function ritzBuckling({ H, EI, q, P = 0, K = 6, n = 600 }) {
  const zs = [...Array(n + 1)].map((_, i) => (H * i) / n); const w = zs.map((_, i) => (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * (H / n / 3));
  const N = new Float64Array(n + 1); let acc = P; N[n] = P; for (let i = n - 1; i >= 0; i--) { acc += 0.5 * (q(zs[i]) + q(zs[i + 1])) * (H / n); N[i] = acc; }
  const d1 = (k, z) => ((k + 1) * dmath.pow(z / H, k)) / H, d2 = (k, z) => ((k + 1) * k * dmath.pow(z / H, k - 1)) / (H * H);
  const Km = [...Array(K)].map(() => new Float64Array(K)), Gm = [...Array(K)].map(() => new Float64Array(K));
  for (let i = 0; i <= n; i++) { const z = zs[i], ei = EI(z); for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) { Km[a][b] += w[i] * ei * d2(a + 1, z) * d2(b + 1, z); Gm[a][b] += w[i] * N[i] * d1(a + 1, z) * d1(b + 1, z); } }
  return smallestGeneralizedEig(Km, Gm);
}
function smallestGeneralizedEig(A, B) {
  const n = A.length; const L = [...Array(n)].map(() => new Float64Array(n));          // B = L Lᵀ
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let s = B[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]; L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-300)) : s / L[j][j]; }
  const solveL = (M) => { const X = [...Array(n)].map(() => new Float64Array(n)); for (let c = 0; c < n; c++) for (let i = 0; i < n; i++) { let s = M[i][c]; for (let k = 0; k < i; k++) s -= L[i][k] * X[k][c]; X[i][c] = s / L[i][i]; } return X; };
  const Y = solveL(A); const Yt = [...Array(n)].map((_, i) => Float64Array.from({ length: n }, (_, j) => Y[j][i])); const C = solveL(Yt);  // C = L⁻¹ A L⁻ᵀ
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) { const m = 0.5 * (C[i][j] + C[j][i]); C[i][j] = C[j][i] = m; }
  for (let sweep = 0; sweep < 80; sweep++) {                                               // Jacobi
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += C[i][j] ** 2; if (off < 1e-24) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(C[p][q]) < 1e-300) continue; const th = (C[q][q] - C[p][p]) / (2 * C[p][q]); const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)); const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const a = C[k][p], b = C[k][q]; C[k][p] = c * a - s * b; C[k][q] = s * a + c * b; }
      for (let k = 0; k < n; k++) { const a = C[p][k], b = C[q][k]; C[p][k] = c * a - s * b; C[q][k] = s * a + c * b; }
    }
  }
  return Math.min(...[...Array(n)].map((_, i) => C[i][i]));
}

// ── species ─────────────────────────────────────────────────────────────────────────────────────────────────────
// E(age) = E0 + (E∞ − E0)(1 − e^(−age/τ)) GPa, for the stem's effective (periphery-weighted) modulus, EI/(πR⁴/4); ρ is the
// WET density (young palm tissue is 90–95% water), since it is weight that loads the stem. Coconut from cocowood: green MOE at
// the periphery 5.3 GPa at the top → 8.6 GPa at the base (González & Nguyen 2016); Iriartea reaches 31 GPa (Rich 1987).
export const PALMS = {
  coconut: {
    label: 'coconut (Cocos): scar rings, a seaward curve', estYears: 4, rate: 0.5, frondsPerYear: 13, frondLife: 2.5, frondLen: 5.0,
    rEst: 0.14, bole: { r: 0.23, h: 0.8 }, E: { E0: 2.5, Einf: 8.5, tau: 15 }, rho: { rho0: 950, rhoInf: 1150 }, frondMass: 11, nutMass: 45,
    divergence: 141, divJitter: 2.5, blade: 'pinnate', leaflets: 110, leafletLen: 0.95, leafletAngle: 62, leafletTilt: -18, leafletDroop: 0.35,
    insert: [8, 115], frondB: [4, 20], scars: 'rings', dead: 'shed', lean: 16, trop: 0.07, nuts: true,
    trunk: [138, 132, 124], scar: [96, 90, 84], frond: [84, 128, 56], frondOld: [150, 150, 70], deadFrond: [150, 120, 80],
  },
  date: {
    label: 'date palm (Phoenix): the leaf-base lattice', estYears: 6, rate: 0.3, frondsPerYear: 20, frondLife: 5, frondLen: 4.0,
    rEst: 0.17, bole: { r: 0.24, h: 0.5 }, E: { E0: 2.0, Einf: 8, tau: 20 }, rho: { rho0: 950, rhoInf: 1150 }, frondMass: 6, nutMass: 0,
    divergence: 137.5, divJitter: 2.5, blade: 'pinnate', leaflets: 85, leafletLen: 0.55, leafletAngle: 40, leafletTilt: 28, leafletDroop: 0.05,
    insert: [10, 95], frondB: [0.4, 2.2], scars: 'boots', bootLife: 16, dead: 'shed', lean: 4, trop: 0.12, nuts: false,
    trunk: [124, 108, 90], scar: [92, 76, 60], frond: [96, 124, 96], frondOld: [150, 150, 110], deadFrond: [150, 124, 90],
  },
  washingtonia: {
    label: 'fan palm (Washingtonia robusta): the petticoat of dead fronds', estYears: 5, rate: 0.45, frondsPerYear: 14, frondLife: 2.8, frondLen: 1.2,
    rEst: 0.3, bole: { r: 0.42, h: 0.6 }, E: { E0: 2.0, Einf: 8, tau: 20 }, rho: { rho0: 950, rhoInf: 1150 }, frondMass: 5, nutMass: 0,
    divergence: 137.5, divJitter: 2.5, blade: 'fan', fanRadius: 0.7, fanSpan: 250, fanSegs: 22, insert: [12, 80], frondB: [0.3, 1.2], scars: 'rings-faint',
    dead: 'skirt', skirtYears: 16, lean: 3, trop: 0.12, nuts: false,
    trunk: [132, 124, 112], scar: [110, 102, 94], frond: [110, 150, 92], frondOld: [150, 160, 100], deadFrond: [176, 152, 110],
  },
  // Corner's model is a tree fern's too: one axis and a crown of big leaves, no cambium. A thin fibrous trunk that climbs
  // a few centimetres a year, arching fronds, the old stipe bases kept on the trunk; dead fronds fall (a hanging skirt of
  // fronds this wide reads as a palm's).
  treefern: {
    label: 'tree fern (Cyathea): a thin fibrous trunk, a crown of arching fronds', estYears: 3, rate: 0.14, frondsPerYear: 12, frondLife: 1.6, frondLen: 2.6,
    rEst: 0.09, bole: { r: 0.16, h: 0.4 }, E: { E0: 1.5, Einf: 6, tau: 12 }, rho: { rho0: 900, rhoInf: 1050 }, frondMass: 1.2, nutMass: 0,
    divergence: 137.5, divJitter: 2.5, blade: 'pinnate', leaflets: 70, leafletLen: 0.42, leafletAngle: 70, leafletTilt: -8, leafletDroop: 0.3,
    insert: [20, 110], frondB: [1.2, 6], scars: 'boots', bootLife: 40, dead: 'shed', lean: 3, trop: 0.1, nuts: false,
    trunk: [74, 58, 44], scar: [52, 40, 30], frond: [92, 142, 58], frondOld: [120, 140, 70], deadFrond: [128, 96, 62],
  },
};

const E_of = (sp, age) => sp.E.E0 + (sp.E.Einf - sp.E.E0) * (1 - dmath.exp(-Math.max(0, age) / sp.E.tau));
const rho_of = (sp, age) => sp.rho.rho0 + (sp.rho.rhoInf - sp.rho.rho0) * (1 - dmath.exp(-Math.max(0, age) / sp.rho.tau || 0));
export { E_of };

/**
 * Grow a palm for `years`. Returns { sp, nodes (trunk, base → apex), fronds, nuts, hand, years }.
 *   node: { pos, dir, s (arc length), born, phi (phyllotactic azimuth, radians), r }
 * `sustained: false` freezes E at E0 (the counterfactual). `reaction: true` gives it a dicot's reaction wood (another).
 */
export function growPalm(specIn, { years = 30, seed = 1, lean = null, leanAz = 0, hand = 1, sustained = true, reaction = false } = {}) {
  const sp = typeof specIn === 'string' ? { ...PALMS[specIn] } : specIn; sp.rho.tau = sp.rho.tau || sp.E.tau;
  const rng = mulberry32((seed * 2654435761) >>> 0); const L = lean ?? sp.lean;
  const nodes = []; const perFrond = 1 / sp.frondsPerYear;
  let d = unit([dmath.sin(L * DEG) * dmath.cos(leanAz * DEG), dmath.sin(L * DEG) * dmath.sin(leanAz * DEG), dmath.cos(L * DEG)]);
  let pos = [0, 0, 0]; let s = 0; let k = 0; let phiAcc = 0;
  const Eage = (n, now) => (sustained ? E_of(sp, now - n.born) : sp.E.E0) * 1e9;
  const Mprev = new Map();
  for (let y = 1; y <= years; y++) {
    for (let f = 0; f < sp.frondsPerYear; f++) {
      const born = y - 1 + f * perFrond; const growing = y > sp.estYears;
      const h = growing ? (sp.rate / sp.frondsPerYear) * (0.8 + 0.4 * rng()) : 0.004;
      // apical gravitropism: the apex turns toward vertical at `trop` radians per metre grown
      if (h > 0.01) { const ax = cross(d, UP); const a = Math.min(dmath.acos(Math.min(1, d[2])), sp.trop * h); if (len(ax) > 1e-9 && a > 0) d = unit(rot(d, unit(ax), a)); }
      d = unit(add(d, mul([rng() - 0.5, rng() - 0.5, 0], 0.004)));
      pos = add(pos, mul(d, h)); s += h;
      phiAcc += hand * (sp.divergence + (sp.divJitter || 0) * (rng() + rng() + rng() - 1.5)) * DEG;
      nodes.push({ pos: [...pos], dir: [...d], s, born, phi: phiAcc, h }); k++;
    }
    // self-weight under the crown: this year's EXTRA moment bends each internode (older tissue is locked in its
    // grown shape; stiffness is that internode's age-stiffness). No reaction wood: nothing pulls it back — unless asked.
    const alive = nodes.filter((n) => y - n.born < sp.frondLife).length; const crownMass = alive * sp.frondMass + (sp.nuts ? sp.nutMass : 0);
    const top = nodes[nodes.length - 1].pos;
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i], base = nodes[i - 1].pos; const r = rAt(sp, n.s); const A = Math.PI * r * r, I = Math.PI * dmath.pow(r, 4) / 4;
      // distal mass and its horizontal centroid: the trunk above + the crown at the apex
      let m = crownMass, mx = crownMass * top[0], my = crownMass * top[1];
      for (let j = i; j < nodes.length; j++) { const q = nodes[j]; const mm = rho_of(sp, y - q.born) * A * q.h; m += mm; mx += mm * q.pos[0]; my += mm * q.pos[1]; }
      const Mv = [-(my - m * base[1]) * G, (mx - m * base[0]) * G, 0]; const Mm = len(Mv);
      const dM = Math.max(0, Mm - (Mprev.get(i) || 0)); Mprev.set(i, Mm);
      const th = Math.min(0.2, (dM * n.h) / (Eage(n, y) * I));
      if (th > 1e-9) { const axn = unit(Mv); for (let j = i; j < nodes.length; j++) { nodes[j].pos = add(base, rot(sub(nodes[j].pos, base), axn, th)); nodes[j].dir = unit(rot(nodes[j].dir, axn, th)); } d = unit(rot(d, axn, th)); }
      if (reaction && y - n.born >= 1) {                     // the counterfactual: a dicot's reaction wood straightens the old stem
        const err = dmath.acos(Math.min(1, n.dir[2])); const fix = Math.min(err, 0.02 * n.h * 10); const ax = cross(n.dir, UP);
        if (err > 1e-4 && len(ax) > 1e-9) { const axn = unit(ax); for (let j = i; j < nodes.length; j++) { nodes[j].pos = add(base, rot(sub(nodes[j].pos, base), axn, fix)); nodes[j].dir = unit(rot(nodes[j].dir, axn, fix)); } d = unit(rot(d, axn, fix)); }
      }
    }
  }
  const now = years; const fronds = []; const nuts = [];
  for (const [i, n] of nodes.entries()) {
    const age = now - n.born;
    const dead = age >= sp.frondLife; if (dead && !(sp.dead === 'skirt' && age < sp.frondLife + sp.skirtYears)) continue;
    fronds.push({ i, age, dead, len: sp.frondLen * Math.min(1, 0.3 + 0.7 * n.born / (sp.estYears + 3)) * (0.9 + 0.2 * rng()) });
    if (sp.nuts && !dead && age > 0.9 && age < 1.8 && i % 3 === 0) nuts.push({ i, age });
  }
  return { sp, nodes, fronds, nuts, hand, years, seed };
}
/** Trunk radius at arc length s: established girth, swollen at the bole, a touch slimmer under the crown. */
export function rAt(sp, s) { return sp.rEst + (sp.bole.r - sp.rEst) * dmath.exp(-s / sp.bole.h); }

// ── geometry ────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The trunk as a tube (parallel transport). `sides`, and `stride` (rings every n nodes) set its detail. With `tex`
 * ({ key, length, color }: a palmTrunkTexture) its sides are quads carrying uv into that texture (u round, v = s /
 * length) in the texture's mean colour, for a consumer that cannot draw it.
 */
export function palmTrunkTris(palm, { sides = 16, stride = 4, color = null, crownCut = 0.5, tex = null } = {}) {
  const { nodes, sp } = palm; const pts = [[0, 0, 0], ...nodes.filter((_, i) => i % stride === 0).map((n) => n.pos)];
  const last = nodes[nodes.length - 1]; if (pts[pts.length - 1] !== last.pos) pts.push(last.pos);
  // the trunk stops just under the crown's spear
  const ss = [0]; for (let i = 1; i < pts.length; i++) ss.push(ss[i - 1] + len(sub(pts[i], pts[i - 1])));
  const T = pts.map((_, i) => unit(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])));
  let N = perp(T[0]); const tris = []; let prev = null;
  for (let i = 0; i < pts.length; i++) {
    N = unit(sub(N, mul(T[i], dot(N, T[i])))); const B = cross(T[i], N); const r = rAt(sp, ss[i]) * (i === pts.length - 1 ? 0.8 : 1);
    const ring = [...Array(sides)].map((_, j) => { const a = (2 * Math.PI * j) / sides; return add(pts[i], add(mul(N, r * dmath.cos(a)), mul(B, r * dmath.sin(a)))); });
    if (prev && tex) {
      const v0 = ss[i - 1] / tex.length, v1 = ss[i] / tex.length; const mid = mul(add(pts[i], pts[i - 1]), 0.5);
      for (let j = 0; j < sides; j++) {
        const j2 = (j + 1) % sides; const q = [prev[j], prev[j2], ring[j2], ring[j]]; const c = mul(add(add(q[0], q[1]), add(q[2], q[3])), 0.25);
        let n = unit(cross(sub(q[1], q[0]), sub(q[3], q[0]))); if (dot(n, sub(c, mid)) < 0) n = mul(n, -1);
        tris.push({ q, uv: [[j / sides, v0], [(j + 1) / sides, v0], [(j + 1) / sides, v1], [j / sides, v1]], n, c: tex.color, key: tex.key, kind: 'bark' });
      }
    } else if (prev) { const c = color || sp.trunk; for (let j = 0; j < sides; j++) { const j2 = (j + 1) % sides; tris.push({ p: [prev[j], prev[j2], ring[j2]], c, kind: 'trunk', s: ss[i] }, { p: [prev[j], ring[j2], ring[j]], c, kind: 'trunk', s: ss[i] }); } }
    prev = ring;
  }
  return tris;
}
/** The top frame of the trunk: where the crown sits, and the axes the phyllotactic azimuths are measured in. */
function crownFrame(palm) { const n = palm.nodes[palm.nodes.length - 1]; const t = n.dir; const u = perp(t); return { top: n.pos, t, u, w: cross(t, u) }; }
/**
 * Fronds. `detail`: 'leaflets' (L3: each pinna a quad), 'v' (L2: two strips per frond), 'strip' (L1), 'star' (L0: one
 * quad per frond). A frond's age sets its insertion (upright spear → hanging) and its bending number (it droops as it
 * ages); the rachis is the elastica for that B.
 */
export function frondTris(palm, { detail = 'leaflets' } = {}) {
  const { sp, nodes } = palm; const F = crownFrame(palm); const tris = []; const rng = mulberry32(palm.seed * 7 + 3);
  for (const fr of palm.fronds) {
    const n = nodes[fr.i]; const life = sp.frondLife; const a = Math.min(1, fr.age / life);
    let insert = sp.insert[0] + (sp.insert[1] - sp.insert[0]) * dmath.pow(a, 0.6);          // degrees from the trunk axis
    let B = sp.frondB[0] + (sp.frondB[1] - sp.frondB[0]) * a;
    if (fr.dead) { insert = 168 - 6 * rng(); B = 0.2; }                                        // a skirt frond hangs against the trunk
    const dirH = unit(add(mul(F.u, dmath.cos(n.phi)), mul(F.w, dmath.sin(n.phi))));           // its azimuth around the apex
    const theta0 = (90 - insert) * DEG;                                                       // elevation above the plane ⟂ trunk
    const e = elastica({ B, theta0, n: 30 }); const Lf = fr.len;
    const base = add(n.pos, mul(dirH, rAt(sp, n.s) * 0.8));
    const P = e.pts.filter((_, k) => k % 2 === 0).map(([x, y]) => add(base, add(mul(dirH, x * Lf), mul(F.t, y * Lf))));
    const col = fr.dead ? sp.deadFrond : mix(sp.frond, sp.frondOld, a * 0.8);
    const side = unit(cross(F.t, dirH));
    if (detail === 'star') { const tip = P[P.length - 1], mid = P[Math.floor(P.length / 2)]; const w = sp.blade === 'fan' ? sp.fanRadius : Lf * 0.12;
      tris.push({ p: [base, add(mid, mul(side, w)), tip], c: col, kind: 'leaf' }, { p: [base, tip, add(mid, mul(side, -w))], c: col, kind: 'leaf' }); continue; }
    // the rachis / petiole
    for (let k = 0; k < P.length - 1; k++) { const w = 0.03 * (1 - k / P.length); tris.push({ p: [add(P[k], mul(side, w)), add(P[k], mul(side, -w)), P[k + 1]], c: mix(col, [120, 110, 70], 0.4), kind: 'leaf' }); }
    if (sp.blade === 'fan') { fanBlade(tris, P[P.length - 1], unit(sub(P[P.length - 1], P[P.length - 2])), side, sp, col, fr.dead, detail); continue; }
    const tan = (k) => unit(sub(P[Math.min(P.length - 1, k + 1)], P[Math.max(0, k - 1)]));
    if (detail === 'leaflets') {
      const nl = sp.leaflets;
      for (let q = 0; q < nl; q++) {
        const u = 0.12 + (0.88 * q) / nl; const kf = u * (P.length - 1); const k0 = Math.floor(kf), k1 = Math.min(P.length - 1, k0 + 1); const at = add(P[k0], mul(sub(P[k1], P[k0]), kf - k0));
        const t = tan(k0); const nrm = unit(cross(t, side)); const ll = sp.leafletLen * dmath.pow(dmath.sin(Math.PI * Math.min(0.98, (u - 0.05) / 0.95)), 0.55) * (fr.dead ? 0.7 : 1);
        for (const sg of [1, -1]) {
          const ang = sp.leafletAngle * DEG, tilt = sp.leafletTilt * DEG;
          let ld = unit(add(mul(t, dmath.cos(ang)), mul(add(mul(side, sg * dmath.cos(tilt)), mul(nrm, dmath.sin(tilt))), dmath.sin(ang))));
          const tip = add(add(at, mul(ld, ll)), [0, 0, -sp.leafletDroop * ll * (0.5 + a)]);
          const wv = mul(t, 0.028); const mid = add(add(at, mul(ld, ll * 0.5)), [0, 0, -sp.leafletDroop * ll * (0.5 + a) * 0.35]);
          tris.push({ p: [at, add(mid, wv), tip], c: col, kind: 'leaf' }, { p: [at, add(at, wv), add(mid, wv)], c: col, kind: 'leaf' });
        }
      }
    } else {
      // V-strips (L2) or one flat strip (L1): the pinnae as a sheet each side of the rachis
      const sides = detail === 'v' ? [1, -1] : [0]; const step = detail === 'v' ? 1 : 2;
      for (let k = 0; k + step < P.length; k += step) {
        const u0 = k / (P.length - 1), u1 = (k + step) / (P.length - 1); const w0 = sp.leafletLen * 0.6 * dmath.sin(Math.PI * Math.min(0.98, u0 + 0.05)), w1 = sp.leafletLen * 0.6 * dmath.sin(Math.PI * Math.min(0.98, u1 + 0.05));
        const t = tan(k); const nrm = unit(cross(t, side)); const tilt = sp.leafletTilt * DEG;
        for (const sg of sides) {
          const dv = sg === 0 ? side : unit(add(mul(side, sg * dmath.cos(tilt)), mul(nrm, dmath.sin(tilt))));
          const drop = [0, 0, -sp.leafletDroop * 0.6]; const ww = sg === 0 ? 2 : 1;
          const a0 = sg === 0 ? add(P[k], mul(dv, -w0)) : P[k], b0 = sg === 0 ? add(P[k + step], mul(dv, -w1)) : P[k + step];
          const a1 = add(add(P[k], mul(dv, w0 * (ww === 2 ? 1 : 1))), mul(drop, w0)), b1 = add(add(P[k + step], mul(dv, w1)), mul(drop, w1));
          tris.push({ p: [a0, b0, b1], c: col, kind: 'leaf' }, { p: [a0, b1, a1], c: col, kind: 'leaf' });
        }
      }
    }
  }
  return tris;
}
function fanBlade(tris, at, dir, side, sp, col, dead, detail) {
  // a costapalmate fan: plicate segments radiating from the hastula over `fanSpan` degrees, tips drooping
  const segs = detail === 'leaflets' ? sp.fanSegs : detail === 'v' ? Math.ceil(sp.fanSegs / 2) : 6; const R = sp.fanRadius * (dead ? 0.85 : 1);
  const up = unit(cross(side, dir)); const span = sp.fanSpan * DEG;
  let prev = null;
  for (let q = 0; q <= segs; q++) {
    const a = -span / 2 + (span * q) / segs; const rd = unit(add(add(mul(dir, dmath.cos(a) * 0.8), mul(side, dmath.sin(a))), mul(up, 0.35 * dmath.cos(a))));
    const fold = (q % 2 ? 0.06 : -0.06) * R;                                                 // the pleats
    const mid = add(add(at, mul(rd, R * 0.6)), mul(up, fold)); const tip = add(add(at, mul(rd, R)), [0, 0, -R * (dead ? 0.6 : 0.28) * Math.abs(dmath.sin(a) + 0.2)]);
    if (prev) { tris.push({ p: [at, prev.mid, mid], c: col, kind: 'leaf' }, { p: [prev.mid, prev.tip, tip], c: col, kind: 'leaf' }, { p: [prev.mid, tip, mid], c: col, kind: 'leaf' }); }
    prev = { mid, tip };
  }
}
/** Coconut bunches: a few nuts under the youngest mature fronds. */
export function nutTris(palm) {
  const tris = []; const F = crownFrame(palm);
  for (const nu of palm.nuts) { const n = palm.nodes[nu.i]; const dirH = unit(add(mul(F.u, dmath.cos(n.phi)), mul(F.w, dmath.sin(n.phi))));
    for (let k = 0; k < 6; k++) { const c = add(add(n.pos, mul(dirH, 0.32 + 0.1 * (k % 3))), [0.1 * dmath.cos(k * 2.1), 0.1 * dmath.sin(k * 2.1), -0.35 - 0.12 * Math.floor(k / 3)]); for (const t of blobTris(c, 0.12, [118, 108, 50], { detail: 0 })) tris.push(t); } }
  return tris;
}
export function palmTris(palm, { detail = 'leaflets', sides = 16, stride = 2, tex = null } = {}) {
  return [...palmTrunkTris(palm, { sides, stride, tex }), ...frondTris(palm, { detail }), ...(detail === 'leaflets' || detail === 'v' ? nutTris(palm) : [])];
}
/** The palm's LOD ladder, mirroring the tree's. With `tex` (a palmTrunkTexture) the near levels' trunks wear it. */
export function palmLadder(palm, { tex = null } = {}) {
  return { L3: palmTris(palm, { detail: 'leaflets', sides: 14, stride: 2, tex }), L2: palmTris(palm, { detail: 'v', sides: 8, stride: 6, tex }), L1: palmTris(palm, { detail: 'strip', sides: 5, stride: 14 }), L0: palmTris(palm, { detail: 'star', sides: 4, stride: 40 }) };
}

// ── the trunk's surface is the phyllotaxis ────────────────────────────────────────────────────────────────
/** Nearest-neighbour index offsets in the (R·φ, s) lattice of the frond bases: the parastichy numbers and their hand. */
export function parastichies(palm, { at = 0.5 } = {}) {
  const { nodes, sp } = palm; const i0 = Math.floor(nodes.length * at); const R = rAt(sp, nodes[i0].s); const out = [];
  for (let k = 1; k < 80 && i0 + k < nodes.length; k++) {
    let dphi = (nodes[i0 + k].phi - nodes[i0].phi) % (2 * Math.PI); if (dphi > Math.PI) dphi -= 2 * Math.PI; if (dphi < -Math.PI) dphi += 2 * Math.PI;
    out.push({ k, du: R * dphi, dv: nodes[i0 + k].s - nodes[i0].s, d: dmath.hypot(R * dphi, nodes[i0 + k].s - nodes[i0].s) });
  }
  out.sort((a, b) => a.d - b.d); const [a, b] = out;
  return { numbers: [a.k, b.k].sort((x, y) => x - y), hands: { [a.k]: Math.sign(a.du), [b.k]: Math.sign(b.du) }, internode: nodes[i0 + 1].s - nodes[i0].s, circumference: 2 * Math.PI * R };
}
function hash2(i, j, s) { let h = (i * 374761393 + j * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
/**
 * The trunk surface as a function of (φ around, s up): { color, height (m, outward) }. Coconut: an oblique scar ring
 * per frond (higher where the petiole sat), weathering greyer with age. Date: persistent leaf-base stubs in the
 * phyllotactic lattice (each node's Voronoi cell, cut square), shed below `bootLife` years to scarred trunk.
 */
export function trunkSurface(palm) {
  const { nodes, sp, years } = palm; const S = nodes.map((n) => n.s);
  const idxAt = (s) => { let lo = 0, hi = S.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m + 1; else hi = m; } return lo; };
  return (phi, s) => {
    const i = idxAt(s); const R = rAt(sp, s); let best = null, second = null;
    for (let j = Math.max(0, i - 40); j < Math.min(nodes.length, i + 40); j++) {
      let dphi = (phi - nodes[j].phi) % (2 * Math.PI); if (dphi > Math.PI) dphi -= 2 * Math.PI; if (dphi < -Math.PI) dphi += 2 * Math.PI;
      const du = R * dphi, dv = s - S[j]; const dd = du * du + (dv * 1.6) ** 2; const c = { j, du, dv, dd };
      if (!best || dd < best.dd) { second = best; best = c; } else if (!second || dd < second.dd) second = c;
    }
    const n = nodes[best.j]; const age = years - n.born; const h = n.h || 0.03; let height = 0; let c = sp.trunk;
    const weather = Math.min(1, age / 25);
    if (sp.scars === 'boots' && age < sp.bootLife && age > sp.frondLife) {
      // a leaf-base stub: its Voronoi cell in the phyllotactic lattice (edge where the two nearest bases tie), cut flat
      // on top, the fibre mat showing between stubs — the lattice's spirals are the parastichies
      const d1 = Math.sqrt(best.dd), d2 = Math.sqrt(second.dd); const t = Math.max(0, (d2 - d1) / (d2 + d1));
      height = 0.05 * Math.min(1, t * 3.2) + 0.006 * vnoise(phi * 30, s * 50, 5);
      c = mix([62, 50, 40], mix(sp.scar, sp.trunk, 0.6), Math.min(1, t * 3.2));
      if (best.dv > 0 && t > 0.25) c = mix(c, [150, 128, 100], 0.35);                            // the cut face catches light
    } else {
      // a scar ring per node, all the way round (the leaf base clasped the stem), oblique: higher where the petiole sat
      let ring = null; for (let j = Math.max(0, i - 3); j < Math.min(nodes.length, i + 3); j++) { const dv = s - (S[j] + 0.3 * (nodes[j].h || h) * dmath.cos(phi - nodes[j].phi)); if (!ring || Math.abs(dv) < Math.abs(ring.dv)) ring = { j, dv }; }
      const hr = nodes[ring.j].h || h; const wv = Math.max(0.003, 0.12 * hr * (sp.scars === 'rings-faint' ? 0.6 : 1));
      const g = dmath.exp(-((ring.dv / wv) ** 2)); height = -0.006 * g * (sp.scars === 'rings-faint' ? 0.5 : 1);
      const w2 = Math.min(1, (years - nodes[ring.j].born) / 25);
      c = mix(mix(sp.trunk, [168, 164, 156], w2 * 0.5), sp.scar, g * 0.8);
      c = mix(c, [110, 104, 96], 0.25 * vnoise(phi * 60, s * 8, 3));                           // fibre streaks along the stem
    }
    return { color: c, height };
  };
}

// ── palm wood is dots, not rings ──────────────────────────────────────────────────────────────────────────
/**
 * Palm wood at a point (x, y) of the section at arc height s, radius R: vascular bundles on a jittered grid whose
 * density rises toward the periphery, each bundle's fibre cap darker with its lignification age (sustained), in a
 * parenchyma ground that also darkens with age. No formation time, so no rings. Returns [r,g,b].
 */
const bornCache = new WeakMap();
export function palmWoodAt(palm, s, x, y, z = 0, { footprint = 0 } = {}) {
  const { sp, years, nodes } = palm; const R = rAt(sp, s); const rho = dmath.hypot(x, y) / R; if (rho > 1) return null;
  let memo = bornCache.get(palm); if (!memo || memo.s !== s) { let born = 0; for (const n of nodes) { if (n.s >= s) { born = n.born; break; } } memo = { s, born }; bornCache.set(palm, memo); }
  const age = years - memo.born;
  const lig = 1 - dmath.exp(-age / sp.E.tau); const periph = rho * rho;
  const density = 1 + 5 * periph; const cell = 0.009 / Math.sqrt(density);                   // bundle spacing, m
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell); let near = Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const cx = (gx + dx + 0.2 + 0.6 * hash2(gx + dx, gy + dy, 1)) * cell, cy = (gy + dy + 0.2 + 0.6 * hash2(gx + dx, gy + dy, 2)) * cell + 0.0006 * dmath.sin(z * 9 + gx); near = Math.min(near, dmath.hypot(x - cx, y - cy)); }
  const rb = cell * (0.22 + 0.12 * lig * (0.4 + 0.6 * periph));
  const ground = mix([222, 200, 160], [176, 142, 100], lig * (0.3 + 0.7 * periph));
  const bundle = mix([150, 110, 70], [58, 36, 24], lig * (0.4 + 0.6 * periph));
  const cover = Math.min(1, (Math.PI * rb * rb) / (cell * cell));
  if (footprint > cell * 0.8) return mix(ground, bundle, cover);                              // past a pixel: the mean
  return near < rb ? bundle : ground;
}
/** Bundle darkness sampled in annuli and at two heights: the gate that palm wood darkens outward and downward. */
export function palmWoodProfile(palm, s, bins = 5, samples = 4000) {
  const R = rAt(palm.sp, s); const rng = mulberry32(99); const out = [];
  for (let b = 0; b < bins; b++) { let dark = 0, nS = 0; for (let k = 0; k < samples / bins; k++) { const r = R * ((b + rng()) / bins) * 0.999, a = rng() * 2 * Math.PI; const c = palmWoodAt(palm, s, r * dmath.cos(a), r * dmath.sin(a)); if (!c) continue; dark += 1 - (c[0] + c[1] + c[2]) / 765; nS++; } out.push(+(dark / nS).toFixed(3)); }
  return out;
}
