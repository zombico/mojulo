/**
 * statue-figure — the reusable "statue" primitive: a posed, robed human FIGURE
 * (from the figure polygonizer) returned as verdigris {corners, fill} faces in a
 * NORMALISED frame (feet at z=0, body centred at x=y=0, total height = 1), so a
 * landmark can scale it onto a pedestal with one uniform factor.
 *
 * The Statue of Liberty composition, distilled from the 0625 liberty-pose spikes:
 *   • pose      — right arm overhead (raw shoulder pitch; the friendly aim caps at
 *                 head height), left forearm cradling the tablet, contrapposto.
 *                 Requires figure-vajra LIMITS.shoulder ≈ 180 (overhead reach).
 *   • robe      — full-length shoulder drape + pelvis bell + a DIAGONAL folded SASH
 *                 (fit:'sash', the himation) over it.
 *   • verdigris — every baked face luminance-remapped onto copper-green (keeps shading).
 *   • props     — gilded TORCH (lathe: handle → brazier → bulbous flame, reference
 *                 ~0.26·body so trimmed small), keystone TABLET, radiating CROWN —
 *                 all located off the figure's own hand/head stacks.
 *
 * Deterministic (the figure is rng-free). Heavy: the polygonised figure is ~35k faces.
 */
import { buildPosedFigure, renderFigureWorldFrames } from '../polygonizer/figure-render.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => scale(a, 1 / len(a));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const LD = norm([0.42, -0.5, 0.76]);   // matches the figure renderer's baked light, so props shade consistently
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const PROTO = { sex: 'female', height: 1.0 };

// The pose + robe are built per-call so the statue can be MIRRORED: with mirror the
// torch arm and tablet arm (and the contrapposto + the himation's bearing shoulder)
// all swap sides. Re-posing (rather than flipping geometry) keeps the baked lighting
// correct — a geometry x-flip would leave each face's shading lit from the wrong side.
function libertyPose(mirror) {
  const T = mirror ? 'L' : 'R';     // torch arm side
  const B = mirror ? 'R' : 'L';     // tablet arm side (also the draped/sash shoulder)
  const s = mirror ? -1 : 1;        // sign for the asymmetric (roll / weight) dials
  const pose = {
    [`sh${T}`]: { pitch: 172 }, [`elbow${T}`]: 8,            // torch arm overhead (raw pitch; aim() caps at head height)
    [`sh${B}`]: { pitch: 14, roll: 30 * s }, [`elbow${B}`]: 95, // tablet forearm across the body
    weight: -0.35 * s, [`knee${T}`]: 16, support: 'both',   // contrapposto: weight on the non-torch leg
    head: { pitch: 8 },
  };
  const robe = {
    id: 'libertyRobe', color: { cloth: '#5fa893' }, pieces: [
      { coverage: ['torso', 'seat'], fit: 'drape', anchor: 'shoulders', clearance: 0.16, sag: 0.12 },
      { fit: 'pelvis', clearance: 0.17, basin: { includeLegs: true, hemFrac: 0.98 } },
      { fit: 'sash', side: B, width: 0.74, clearance: 0.025, folds: 5, foldAmp: 0.07 },
    ],
  };
  return { pose, robe, T, B, s };
}
const PS = 12, SS = 1.95;   // figure-render PROTO_SCALE / STAND→world

/**
 * @param {{copper?:string, torch?:string, flame?:string, torchScale?:number}} [pal]
 * @returns {{faces: Array<{corners:number[][], fill:string}>}} normalised statue faces
 */
export function buildStatueFigure(pal = {}) {
  const COPPER = hexRgb(pal.copper || '#5fa893');
  const GRN = COPPER, GOLD = hexRgb(pal.torch || '#caa23e'), GOLDB = hexRgb(pal.flame || '#f2cf5b');
  const CROWN = hexRgb('#74b8a4'), TAB = hexRgb('#67b09d'), TABF = hexRgb('#7dc2b0');
  const tScale = pal.torchScale ?? 0.8;   // torch trimmed 20% vs the reference-fit size
  const { pose: POSE, robe: ROBE, T, B, s } = libertyPose(!!pal.mirror);

  const remap = (hex) => { const [r, g, b] = hexRgb(hex); const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255; const f = Math.max(0.45, Math.min(1.5, lum / 0.42)); return rgbHex(scale(COPPER, f)); };
  const rgbHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const lit = (c, base) => { const n = norm(cross(sub(c[1], c[0]), sub(c[2], c[0]))); return rgbHex(scale(base, 0.5 + 0.62 * Math.abs(dot(n, LD)))); };

  // figure faces (production mesher → real fold shading), recoloured to verdigris
  const faces = renderFigureWorldFrames({ pose: POSE, proto: PROTO, garment: ROBE }).frames[0].faces
    .map((f) => ({ corners: f.corners, fill: remap(f.fill) }));
  let zmn = Infinity, zmx = -Infinity;
  for (const f of faces) for (const p of f.corners) { if (p[2] < zmn) zmn = p[2]; if (p[2] > zmx) zmx = p[2]; }
  const H = zmx - zmn;

  // labelled stacks + the SAME world transform → hand/head anchors line up with the faces
  const stacks = buildPosedFigure(POSE, PROTO, ROBE);
  let gz = Infinity; for (const s of stacks) for (const rg of s.rings) for (const q of rg.polyline) { const z = q.z / PS; if (z < gz) gz = z; }
  const W = (q) => [(q.x / PS) * SS, (q.y / PS) * SS, ((q.z / PS) - gz) * SS + 0.02];
  const stk = (id) => stacks.find((p) => p.id === id);
  const ctrW = (id) => { const st = stk(id); if (!st) return null; let x = 0, y = 0, z = 0, n = 0; for (const rg of st.rings) { x += rg.center.x; y += rg.center.y; z += rg.center.z; n++; } return n ? W({ x: x / n, y: y / n, z: z / n }) : null; };
  const tipW = (id, end) => { const st = stk(id); if (!st) return null; const rg = end ? st.rings[st.rings.length - 1] : st.rings[0]; return W(rg.center); };

  // lathe primitive: revolve a [t,radius] profile along an axis into banded rings
  const lathe = (base, ax, length, profile, base3) => {
    let u = cross(ax, [0, 0, 1]); if (len(u) < 1e-5) u = cross(ax, [1, 0, 0]); u = norm(u);
    const v = norm(cross(ax, u)), Nr = 20;
    const ring = (t, r) => { const c = add(base, scale(ax, t * length)); return Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return add(c, add(scale(u, Math.cos(a) * r), scale(v, Math.sin(a) * r))); }); };
    for (let k = 0; k < profile.length - 1; k += 1) { const A = ring(profile[k][0], profile[k][1]), B = ring(profile[k + 1][0], profile[k + 1][1]); for (let i = 0; i < Nr; i += 1) { const j = (i + 1) % Nr; faces.push({ corners: [A[i], A[j], B[j], B[i]], fill: lit([A[i], A[j], B[j]], base3) }); } }
  };

  // ── gilded torch in the raised torch-hand (lathe handle → brazier → bulbous flame) ──
  const handR = ctrW(`hand${T}`) || tipW(`forearm${T}`, 1), foreR = ctrW(`forearm${T}`);
  let axis = norm(sub(handR, foreR)); if (axis[2] < 0) axis = scale(axis, -1);
  const Rh = 0.013 * H * tScale, Rb = 0.052 * H * tScale, Rf = 0.058 * H * tScale;
  const hL = 0.115 * H * tScale, bL = 0.055 * H * tScale, fL = 0.155 * H * tScale;
  const tb = add(handR, scale(axis, -0.05 * H));
  lathe(tb, axis, hL, [[0, 0.55 * Rh], [0.05, Rh], [0.85, 0.95 * Rh], [1, 1.25 * Rh]], GRN);
  lathe(add(tb, scale(axis, hL)), axis, bL, [[0, 1.25 * Rh], [0.35, 2.4 * Rh], [0.72, Rb], [1, 0.92 * Rb]], GOLD);
  lathe(add(tb, scale(axis, hL + bL)), axis, fL, [[0, 0.70 * Rf], [0.12, 0.92 * Rf], [0.22, 1.0 * Rf], [0.36, 0.93 * Rf], [0.52, 0.78 * Rf], [0.68, 0.58 * Rf], [0.82, 0.36 * Rf], [0.93, 0.18 * Rf], [1, 0.02 * Rf]], GOLDB);

  // ── keystone tablet cradled in the tablet-arm ──
  const handL = ctrW(`hand${B}`), foreL = ctrW(`forearm${B}`);
  if (handL && foreL) {
    const C = add(scale(add(handL, foreL), 0.5), [-0.015 * H * s, 0.05 * H, 0.045 * H]);
    const up = norm([-0.34 * s, -0.12, 0.93]), nm = norm([-0.2 * s, 0.94, 0.12]), wv = norm(cross(up, nm));
    const Lt = 0.20 * H, Th = 0.024 * H, wT = 0.075 * H, wB = 0.058 * H;
    const face = (s) => { const o = scale(nm, s * Th / 2); return [add(add(add(C, scale(up, Lt / 2)), scale(wv, wT)), o), add(add(add(C, scale(up, Lt / 2)), scale(wv, -wT)), o), add(add(add(C, scale(up, -Lt / 2)), scale(wv, -wB)), o), add(add(add(C, scale(up, -Lt / 2)), scale(wv, wB)), o)]; };
    const F = face(1), Bk = face(-1);
    faces.push({ corners: F, fill: lit(F, TABF) });
    faces.push({ corners: [Bk[1], Bk[0], Bk[3], Bk[2]], fill: lit(Bk, TAB) });
    for (let i = 0; i < 4; i += 1) { const j = (i + 1) % 4; const q = [F[i], F[j], Bk[j], Bk[i]]; faces.push({ corners: q, fill: lit(q, TAB) }); }
  }

  // ── radiating crown (sunburst diadem) tilted into the head's plane ──
  let wcx = 0, wcy = 0, wc = 0; for (const f of faces) for (const p of f.corners) { wcx += p[0]; wcy += p[1]; wc++; } wcx /= wc; wcy /= wc;
  let top = null, topz = -Infinity;
  for (const f of faces) for (const p of f.corners) if (Math.hypot(p[0] - wcx, p[1] - wcy) < 0.18 && p[2] > 1.0 && p[2] > topz) { topz = p[2]; top = p; }
  if (top) {
    const tiltA = 0.20, sN = Math.sin(tiltA), cN = Math.cos(tiltA);
    const upC = [0, sN, cN], e1 = [1, 0, 0], e2 = [0, cN, -sN];
    const center = [top[0], top[1] - sN * 0.05, top[2] - cN * 0.055], Rc = 0.095, Nc = 22;
    const ringAt = (r, h) => Array.from({ length: Nc }, (_, i) => { const a = (i / Nc) * 2 * Math.PI; const d = add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))); return add(add(center, scale(d, r)), scale(upC, h)); });
    const r0 = ringAt(Rc, -0.022), r1 = ringAt(Rc, 0.030);
    for (let i = 0; i < Nc; i += 1) { const j = (i + 1) % Nc; const q = [r0[i], r0[j], r1[j], r1[i]]; faces.push({ corners: q, fill: lit(q, CROWN) }); }
    for (let i = 0; i < 7; i += 1) { const a = (i / 7) * 2 * Math.PI; const d = add(scale(e1, Math.cos(a)), scale(e2, Math.sin(a))); const t = add(scale(e1, -Math.sin(a)), scale(e2, Math.cos(a))); const base = add(add(center, scale(d, Rc)), scale(upC, 0.02)); const tip = add(add(center, scale(d, Rc * 2.25)), scale(upC, 0.085)); const w = 0.017; const q = [add(base, scale(t, w)), sub(base, scale(t, w)), tip, tip]; faces.push({ corners: q, fill: lit(q, CROWN) }); }
  }

  // normalise: feet → z=0, FEET centred at x=y=0, total height → 1 (one uniform factor for the caller)
  let nzmn = Infinity, nzmx = -Infinity;
  for (const f of faces) for (const p of f.corners) { if (p[2] < nzmn) nzmn = p[2]; if (p[2] > nzmx) nzmx = p[2]; }
  const span = (nzmx - nzmn) || 1;
  // centre on the feet cluster (bottom 6%) so the statue stands centred on its pedestal
  let fx = 0, fy = 0, fn = 0; const footCut = nzmn + 0.06 * span;
  for (const f of faces) for (const p of f.corners) if (p[2] <= footCut) { fx += p[0]; fy += p[1]; fn++; }
  if (fn) { fx /= fn; fy /= fn; }
  const N = ([x, y, z]) => [(x - fx) / span, (y - fy) / span, (z - nzmn) / span];
  return { faces: faces.map((f) => ({ corners: f.corners.map(N), fill: f.fill })) };
}

// normalise a face list to feet-at-z=0, feet-centred at x=y=0, unit total height.
function normaliseFaces(faces) {
  let zmn = Infinity, zmx = -Infinity;
  for (const f of faces) for (const p of f.corners) { if (p[2] < zmn) zmn = p[2]; if (p[2] > zmx) zmx = p[2]; }
  const span = (zmx - zmn) || 1, footCut = zmn + 0.06 * span;
  let fx = 0, fy = 0, fn = 0;
  for (const f of faces) for (const p of f.corners) if (p[2] <= footCut) { fx += p[0]; fy += p[1]; fn++; }
  if (fn) { fx /= fn; fy /= fn; }
  const N = ([x, y, z]) => [(x - fx) / span, (y - fy) / span, (z - zmn) / span];
  return faces.map((f) => ({ corners: f.corners.map(N), fill: f.fill }));
}

// ─── José Rizal (the Rizal Monument main figure) ──────────────────────────────
// A second statue from the same primitive: a MALE figure in a bronze OVERCOAT over a
// vest + necktie, holding a book at the waist — upright, calm. Shows the pipeline
// generalises past Liberty: different sex, garment, props, material. The overcoat is
// the layered-coat idiom from statues.md — a `panel:'coat'` torso + pelvis bell that a
// single redline `wedge` cut (collar→hem, no taper) splits open down the FRONT, so the
// legs read between the panels (a real open overcoat, not a closed skirt); a separate
// `panel:'vest'` layer is left intact and shows in the opening.
const RIZAL_POSE = { armR: 'down', elbowR: 12, shL: { pitch: 12 }, elbowL: 72, weight: -0.05, support: 'both', head: { pitch: 5 } };
const RIZAL_PROTO = { sex: 'male', height: 1.0, stockiness: 1.12 };
const RIZAL_COAT = {
  id: 'coat', color: { cloth: '#6a5636' }, pieces: [
    { fit: 'torso', panel: 'vest', clearance: 0.11, cloth: '#bfae78', basin: { hemFrac: 0.72, uniform: true } },               // vest, forward to fill the open front
    { fit: 'torso', panel: 'coat', clearance: 0.16, basin: { hemFrac: 0.6, uniform: true, includeHips: true, hemBelowWaist: 0.7 }, openMargin: 0.16 },
    { fit: 'pelvis', panel: 'coat', clearance: 0.12, basin: { includeLegs: true, hemFrac: 0.5 } },                              // coat skirt → split by the cut below
    { fit: 'sleeve', coverForearm: true, thickness: 0.06 },
    { coverage: ['legL'], fit: 'drape', anchor: 'hip', clearance: 0.07 },
    { coverage: ['legR'], fit: 'drape', anchor: 'hip', clearance: 0.07 },
  ],
  cuts: [{ kind: 'wedge', halfAngle: 0.33, from: 'collar', to: 0.05, taper: 0, on: 'coat' }],   // open front the whole way down
};

/**
 * @param {{bronze?:string}} [pal]
 * @returns {{faces: Array<{corners:number[][], fill:string}>}} normalised bronze Rizal figure
 */
export function buildRizalFigure(pal = {}) {
  const BRONZE = hexRgb(pal.bronze || '#7a633e');
  const rgbHex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const remap = (hex) => { const [r, g, b] = hexRgb(hex); const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255; return rgbHex(scale(BRONZE, Math.max(0.5, Math.min(1.6, lum / 0.42)))); };
  const lit = (c, base) => { const n = norm(cross(sub(c[1], c[0]), sub(c[2], c[0]))); return rgbHex(scale(base, 0.5 + 0.62 * Math.abs(dot(n, LD)))); };

  const faces = renderFigureWorldFrames({ pose: RIZAL_POSE, proto: RIZAL_PROTO, garment: RIZAL_COAT }).frames[0].faces
    .map((f) => ({ corners: f.corners, fill: remap(f.fill) }));
  let zmn = Infinity, zmx = -Infinity;
  for (const f of faces) for (const p of f.corners) { if (p[2] < zmn) zmn = p[2]; if (p[2] > zmx) zmx = p[2]; }
  const H = zmx - zmn;
  const stacks = buildPosedFigure(RIZAL_POSE, RIZAL_PROTO, RIZAL_COAT);
  let gz = Infinity; for (const s of stacks) for (const rg of s.rings) for (const q of rg.polyline) { const z = q.z / PS; if (z < gz) gz = z; }
  const W = (q) => [(q.x / PS) * SS, (q.y / PS) * SS, ((q.z / PS) - gz) * SS + 0.02];
  const stk = (id) => stacks.find((p) => p.id === id);
  const ctrW = (id) => { const st = stk(id); if (!st) return null; let x = 0, y = 0, z = 0, n = 0; for (const rg of st.rings) { x += rg.center.x; y += rg.center.y; z += rg.center.z; n++; } return n ? W({ x: x / n, y: y / n, z: z / n }) : null; };
  const frontY = (zt) => { let my = -Infinity; for (const s of stacks) if (['trunk', 'pecL', 'pecR', 'clavicleL', 'clavicleR', 'dantien'].includes(s.id)) for (const rg of s.rings) for (const q of rg.polyline) { const w = W(q); if (Math.abs(w[2] - zt) < 0.05 * H && w[1] > my) my = w[1]; } return my; };

  // book at the waist (left hand)
  const handL = ctrW('handL'), foreL = ctrW('forearmL');
  if (handL && foreL) {
    const C = [handL[0] * 0.6, handL[1] + 0.06 * H, handL[2] - 0.01 * H];
    const up = norm([0.06, -0.05, 1.0]), nm = norm([-0.05, 0.99, 0.06]), wv = norm(cross(up, nm));
    const Lt = 0.12 * H, Wt = 0.14 * H, Th = 0.04 * H;
    const corner = (su, sw, sn) => add(add(add(C, scale(up, su * Lt / 2)), scale(wv, sw * Wt / 2)), scale(nm, sn * Th / 2));
    const F = [corner(1, 1, 1), corner(1, -1, 1), corner(-1, -1, 1), corner(-1, 1, 1)];
    const Bk = [corner(1, 1, -1), corner(1, -1, -1), corner(-1, -1, -1), corner(-1, 1, -1)];
    faces.push({ corners: F, fill: lit(F, hexRgb('#94804a')) });
    faces.push({ corners: [Bk[1], Bk[0], Bk[3], Bk[2]], fill: lit(Bk, hexRgb('#86703f')) });
    for (let i = 0; i < 4; i += 1) { const j = (i + 1) % 4; const q = [F[i], F[j], Bk[j], Bk[i]]; faces.push({ corners: q, fill: lit(q, hexRgb('#86703f')) }); }
  }
  // necktie down the chest centre
  const neckW = ctrW('neck') || ctrW('clavicleL');
  if (neckW) {
    const zTop = neckW[2] - 0.03 * H, fy = frontY(zTop), ny = (Number.isFinite(fy) ? fy : neckW[1] + 0.10 * H) + 0.014 * H;
    const TIE = hexRgb('#4a3d28'), Lt = 0.12 * H, wTop = 0.009 * H, wBot = 0.016 * H;
    const F = [[wTop, ny, zTop], [-wTop, ny, zTop], [-wBot, ny + 0.006 * H, zTop - Lt], [wBot, ny + 0.006 * H, zTop - Lt]];
    faces.push({ corners: F, fill: lit(F, TIE) });
    const k = 0.022 * H, kz = zTop + 0.004 * H;
    const kf = [[-k, ny + 0.006 * H, kz], [k, ny + 0.006 * H, kz], [k * 0.7, ny + 0.006 * H, kz - k * 1.4], [-k * 0.7, ny + 0.006 * H, kz - k * 1.4]];
    faces.push({ corners: kf, fill: lit(kf, TIE) });
  }
  return { faces: normaliseFaces(faces) };
}
