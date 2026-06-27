/**
 * roof — the house-view roof primitive (see roof.plan.md for the architect rules).
 *
 * Caps a house footprint (the floorplan-structure envelope, or any box) with a real roof. The
 * house view is the consumer — NOT fractal-city; a "fractal town" may reuse it one day, but the
 * forms and proportions here are tuned to a single dwelling read from outside.
 *
 * EXTERIOR ROOFSCAPE ONLY: the operator's three layers land as — ceiling → the SOFFIT (the flat
 * underside seen at the eave overhang); rafters → RAFTER TAILS (beam ends exposed under the
 * eave); roof material → the sloped/flat faces carrying a tile texture (`shingle` or `clay-tile`
 * from surface-textures.js).
 *
 * FORMS (geometry, independent of material):
 *   hip · gable · pyramid (pavilion) · gambrel (Dutch barn) · mansard · saltbox (asym gable) ·
 *   shed (mono-pitch) · butterfly · flat-deck · stacked-room.
 * All pitched forms are written ONCE in a canonical orientation (ridge along the LONGER axis)
 * via `orient()`, which maps (along, across, z) to world coords so each form needn't special-case
 * which way the house sits.
 *
 * buildRoof returns engine-agnostic LIT faces ({ corners, fill, normal, doubleSided, texture?,
 * uv?, textureLit? }) ready to append as `extraFaces` to a scene assembler (which bakes
 * diffusion/shadows over them) or drop into emitThreeWorld. Textured slope faces author their
 * `uv` in a LOCAL slope basis (u along the eave, v up the slope) so shingle courses run
 * horizontal and clay barrels run down-slope regardless of orientation. `textureKeys` reports
 * which `data:` textures the caller must register into payload.textures.
 *
 * Dependency-free apart from vexar (Lambert shade + hex maths).
 */
import { litFactor, scaleHex } from './polygonizer/vexar.js';

// ── vector helpers ───────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const centroid = (cs) => { const n = cs.length; let x = 0, y = 0, z = 0; for (const c of cs) { x += c[0]; y += c[1]; z += c[2]; } return [x / n, y / n, z / n]; };

// world units per texture repeat (each tile packs ~8 courses / ~6 barrels). Houses are in FEET
// (one world unit ≈ one foot, per FLOORPLAN_DEFAULTS), so a ~3 ft repeat reads as real coursing.
const TILE = 3.0;

// ── style catalog: form + material + pitch + eave + palette (roof.plan.md table). Palette tints
// double as the CSS-3D flat read (that path ignores textures) AND the base the World multiply-
// lights the tile texel against, so each sits under its tile colour. ──
const STYLES = {
  // — pitched, tiled —
  bungalow:    { form: 'hip',     material: 'shingle-weathered', pitch: 0.5,  eave: 1.6, rafters: true,
                 palette: { roof: '#5a5e60', soffit: '#cdbfa6', fascia: '#b6a98f', rafter: '#5b4734', ridge: '#4a4d4f', gable: '#cabfa8' } },
  mission:     { form: 'gable',   material: 'clay-terracotta',   pitch: 0.58, eave: 1.9, rafters: false,
                 palette: { roof: '#b06840', soffit: '#d8ccb2', fascia: '#c9b597', gable: '#e6dcc8', ridge: '#9a5436' } },
  pavilion:    { form: 'pyramid', material: 'clay-sand',         pitch: 0.7,  eave: 1.7, rafters: false,
                 palette: { roof: '#bd935f', soffit: '#d8ccb2', fascia: '#c9b597', ridge: '#9a7344', gable: '#e6dcc8' } },
  farmhouse:   { form: 'gambrel', material: 'shingle-weathered', pitch: 0.5,  eave: 1.4, rafters: true,
                 lowerPitch: 1.5, upperPitch: 0.42, knee: 0.55,
                 palette: { roof: '#5d6163', soffit: '#cdbfa6', fascia: '#b6a98f', rafter: '#4a3a2b', ridge: '#4a4d4f', gable: '#c7b9a0' } },
  manor:       { form: 'mansard', material: 'clay-slate',        pitch: 0.5,  eave: 1.2, rafters: false,
                 lowerPitch: 2.4, knee: 0.42,
                 palette: { roof: '#5d6368', soffit: '#cfc6bb', fascia: '#bcb2a4', ridge: '#444a50', gable: '#cfc7ba' } },
  colonial:    { form: 'saltbox', material: 'shingle-weathered', pitch: 0.8, eave: 1.3, rafters: false, ridgeBias: 0.34,
                 palette: { roof: '#5a5e60', soffit: '#d4cab4', fascia: '#bdb098', gable: '#dfd6c2', ridge: '#4a4d4f' } },
  // — modern, flat-read metal (no tile texture yet) —
  'modern-shed': { form: 'shed', material: null, pitch: 0.42, eave: 0.9, rafters: false,
                 palette: { roof: '#3d4248', soffit: '#cfc6bb', fascia: '#aeb4ba', gable: '#c3beb4', ridge: '#2e3338' } },
  butterfly:   { form: 'butterfly', material: null, pitch: 0.45, eave: 0.9, rafters: false,
                 palette: { roof: '#41474d', soffit: '#cfc6bb', fascia: '#aeb4ba', gable: '#c3beb4', ridge: '#2e3338' } },
  // — flat / occupiable —
  'tofu-deck': { form: 'flat-deck', material: null, pitch: 0, eave: 0.3, rafters: false,
                 palette: { deck: '#9a958c', parapet: '#8d887f', cap: '#b5b0a6', rail: '#55524c', pergola: '#7a5f43', planter: '#5a6b4a' } },
  'tofu-stacked': { form: 'stacked-room', material: 'shingle-brown', pitch: 0.5, eave: 1.0, rafters: true,
                 palette: { deck: '#9a958c', parapet: '#8d887f', cap: '#b5b0a6', rail: '#55524c', wall: '#cfc7ba', roof: '#6a5640', soffit: '#cdbfa6', fascia: '#b6a98f', rafter: '#4a3a2b', ridge: '#564636', gable: '#cfc7ba' } },
};

// ── the renderer seam ──────────────────────────────────────────────────────────────
// Both World renderers want 4-corner faces (face-mesh DROPS <4-corner faces), but the CSS-3D
// path draws a 4-corner face as a PARALLELOGRAM (origin c0 + edges c1-c0, c3-c0) — so a TRIANGLE
// (hip end, gable wall) or a TRAPEZOID (hip/mansard slope) would distort there. The fix every
// roof face goes through: pad to 4 corners and attach a `clip` polygon = the TRUE corners
// projected into that parallelogram basis. CSS-3D clip-paths it to the exact shape; three.js
// uses the real quad for textured faces and fan-triangulates the clip for untextured ones. A
// genuine parallelogram gets no clip (byte-clean). This is the same card/clip contract the
// landmark roof-fans use (see face-mesh.js faceListToMesh).
function clipFor(c4) {
  const O = c4[0], U = sub(c4[1], O), V = sub(c4[3], O);
  const uu = dot(U, U), vv = dot(V, V), uv = dot(U, V), det = uu * vv - uv * uv || 1;
  const poly = c4.map((p) => { const d = sub(p, O), du = dot(d, U), dv = dot(d, V); return [(vv * du - uv * dv) / det, (uu * dv - uv * du) / det]; });
  const ideal = [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (poly.every((p, i) => Math.abs(p[0] - ideal[i][0]) < 2e-3 && Math.abs(p[1] - ideal[i][1]) < 2e-3)) return null;
  return 'polygon(' + poly.map(([u, v]) => `${(u * 100).toFixed(2)}% ${(v * 100).toFixed(2)}%`).join(',') + ')';
}

// lit-face emit: geometric normal sign-flipped to point AWAY from the roof interior (slopes &
// deck face up/out, soffit faces down), padded to a 4-corner clip-card.
function pushFace(faces, corners, baseTint, inner, L, extra = {}) {
  let n = norm(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (dot(n, sub(centroid(corners), inner)) < 0) n = [-n[0], -n[1], -n[2]];
  const c4 = corners.length === 3 ? [corners[0], corners[1], corners[2], corners[2]] : corners;
  const clip = clipFor(c4);
  faces.push({ corners: c4, normal: n, fill: scaleHex(baseTint, litFactor(n, L)), doubleSided: true, ...(clip ? { clip } : {}), ...extra });
}

// per-corner UV in a local slope basis: u along origin→eaveTo, v along origin→upTo (the rise).
// Tiles by world distance / `tile`, so courses stay horizontal and barrels run down-slope.
function slopeUV(corners, oi, eaveTo, upTo, tile) {
  const O = corners[oi], e = norm(sub(corners[eaveTo], O)), u = norm(sub(corners[upTo], O));
  return corners.map((c) => { const r = sub(c, O); return [dot(r, e) / tile, dot(r, u) / tile]; });
}

// a textured (or flat, if no material) slope face. Quads wound [eaveL, eaveR, ridgeR, ridgeL]
// (0→1 eave, 0→3 up); triangles carry caller oi/eaveTo/upTo for the UV basis. pushFace pads + clips
// for the renderer seam, so UVs are padded to 4 here to match (texture group needs uv.length ≥ 4).
function pushSkin(faces, corners, baseTint, inner, L, material, oi = 0, eaveTo = 1, upTo = corners.length - 1) {
  let extra = {};
  if (material) {
    const uv = slopeUV(corners, corners.length === 4 ? 0 : oi, corners.length === 4 ? 1 : eaveTo, corners.length === 4 ? 3 : upTo, TILE);
    extra = { texture: material, textureLit: true, uv: uv.length === 3 ? [...uv, uv[2]] : uv };
  }
  pushFace(faces, corners, baseTint, inner, L, extra);
}

// a solid box (6 lit quads) — rafter tails, parapets, posts, rails, set-back room walls
function pushBox(faces, x0, y0, z0, x1, y1, z1, tint, inner, L) {
  const P = (x, y, z) => [x, y, z];
  const q = [
    [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)],
    [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
    [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)],
    [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
    [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)],
    [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
  ];
  for (const c of q) pushFace(faces, c, tint, inner, L);
}

// ── canonical orientation: ridge along the LONGER axis. `P(along, across, z)` maps a point in
// the canonical (long, short) frame to world coords. Ranges carry the eave overhang `oh`; `w*`
// ranges are the WALL plane (no overhang). across-mid `acm` + `halfShort` size the rise. ──
function orient(fp, oh) {
  const { x, y, w, d } = fp, z = fp.z;
  const x0 = x, x1 = x + w, y0 = y, y1 = y + d;
  const ex0 = x0 - oh, ex1 = x1 + oh, ey0 = y0 - oh, ey1 = y1 + oh;
  const longX = w >= d;
  const P = longX ? (a, c, zz) => [a, c, zz] : (a, c, zz) => [c, a, zz];
  return {
    P, ze: z, longX, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
    A0: longX ? ex0 : ey0, A1: longX ? ex1 : ey1,         // along range (with overhang)
    C0: longX ? ey0 : ex0, C1: longX ? ey1 : ex1,         // across range (with overhang)
    wA0: longX ? x0 : y0, wA1: longX ? x1 : y1,           // along wall plane
    wC0: longX ? y0 : x0, wC1: longX ? y1 : x1,           // across wall plane
    acm: longX ? (y0 + y1) / 2 : (x0 + x1) / 2,
    halfShort: (longX ? (ey1 - ey0) : (ex1 - ex0)) / 2,
  };
}

// soffit ring (the overhang underside, facing down) + (opt) exposed rafter tails along the eaves.
// Used by the forms with a UNIFORM eave at `ze` on all four sides.
function pushEaves(faces, fp, oh, P, ze, inner, L, soffitTint, rafterTint, slopedOnly = false) {
  if (oh <= 0.02) return;
  const { x, y, w, d } = fp, x0 = x, x1 = x + w, y0 = y, y1 = y + d;
  const ex0 = x0 - oh, ex1 = x1 + oh, ey0 = y0 - oh, ey1 = y1 + oh, z = ze - 0.02;
  const longX = P(1, 0, 0)[0] === 1;
  // soffit trapezoids per side. For gable-family forms (slopedOnly) only the two SLOPED eaves
  // get a soffit — the gable ends are flush, so an overhang there would stick out past the roof.
  const yPieces = [[[ex0, ey0, z], [ex1, ey0, z], [x1, y0, z], [x0, y0, z]], [[ex0, ey1, z], [ex1, ey1, z], [x1, y1, z], [x0, y1, z]]];
  const xPieces = [[[ex0, ey0, z], [ex0, ey1, z], [x0, y1, z], [x0, y0, z]], [[ex1, ey0, z], [ex1, ey1, z], [x1, y1, z], [x1, y0, z]]];
  const ring = slopedOnly ? (longX ? yPieces : xPieces) : [...yPieces, ...xPieces];
  for (const c of ring) pushFace(faces, c, soffitTint, inner, L);
  if (!rafterTint) return;
  const tail = (alongX, lo, hi, fixed, out) => {
    const span = hi - lo, n = Math.max(2, Math.round(span / 1.5)), bw = 0.16, z1 = ze - 0.05, z0 = z1 - 0.3;
    const f0 = Math.min(fixed, out), f1 = Math.max(fixed, out);
    for (let i = 0; i <= n; i++) {
      const a = lo + (i / n) * span;
      if (alongX) pushBox(faces, a - bw, f0, z0, a + bw, f1, z1, rafterTint, inner, L);
      else pushBox(faces, f0, a - bw, z0, f1, a + bw, z1, rafterTint, inner, L);
    }
  };
  // tails hang from the two SLOPED eaves (the long sides when the ridge runs along x)
  if (P(1, 0, 0)[0] === 1) { tail(true, ex0, ex1, y0, ey0); tail(true, ex0, ex1, y1, ey1); }
  else { tail(false, ey0, ey1, x0, ex0); tail(false, ey0, ey1, x1, ex1); }
}

// a slim ridge-cap prism along the ridge line (clay ridge tiles / shingle cap)
function pushRidge(faces, P, a0, a1, across, zr, tint, inner, L) {
  const c = [P(a0, across - 0.18, zr - 0.18), P(a1, across - 0.18, zr - 0.18), P(a1, across + 0.18, zr - 0.18), P(a0, across + 0.18, zr - 0.18)];
  // a thin flat cap quad just above the ridge reads as the capping course; cheap + clear.
  pushFace(faces, c.map((p) => [p[0], p[1], zr + 0.06]), tint, inner, L);
}

// ── pitched forms (hip · gable · pyramid · gambrel · mansard · saltbox · shed · butterfly) ──
function pitchedRoof(faces, fp, st, P0, L) {
  const oh = st.eave, o = orient(fp, oh);
  const { P, ze, cx, cy, A0, A1, C0, C1, wA0, wA1, wC0, wC1, acm, halfShort } = o;
  const rise = halfShort * st.pitch, zr = ze + rise;
  const inner = [cx, cy, ze + Math.max(rise, 1) * 0.5];
  const mat = st.material, tint = P0.roof, gtint = P0.gable || P0.fascia;
  // gable-family forms end FLUSH at the gable wall (no rake overhang past the end) — a clean read
  // and no dog-ear sliver at the inset gable. They keep the eave overhang on the sloped sides.
  // hip / pyramid / mansard wrap the eave on all four sides, so they use the full overhang extent.
  const gableFamily = st.form === 'gable' || st.form === 'gambrel' || st.form === 'saltbox';
  const aL = gableFamily ? wA0 : A0, aR = gableFamily ? wA1 : A1;
  const A = P(aL, C0, ze), B = P(aR, C0, ze), C = P(aR, C1, ze), D = P(aL, C1, ze);
  let uniformEave = true;

  if (st.form === 'hip' || st.form === 'pyramid') {
    const pyr = st.form === 'pyramid';
    const r0 = pyr ? (A0 + A1) / 2 : A0 + halfShort, r1 = pyr ? (A0 + A1) / 2 : A1 - halfShort;
    const R0 = P(r0, acm, zr), R1 = P(r1, acm, zr);
    pushSkin(faces, [A, B, R1, R0], tint, inner, L, mat, 0, 1, 3);          // near slope
    pushSkin(faces, [D, C, R1, R0], tint, inner, L, mat, 0, 1, 3);          // far slope
    pushSkin(faces, [A, R0, D], tint, inner, L, mat, 0, 2, 1);              // end hips (triangles)
    pushSkin(faces, [B, C, R1], tint, inner, L, mat, 0, 1, 2);
    if (!pyr) pushRidge(faces, P, r0, r1, acm, zr, P0.ridge, inner, L);
  } else if (st.form === 'gable') {
    const R0 = P(aL, acm, zr), R1 = P(aR, acm, zr);
    pushSkin(faces, [A, B, R1, R0], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [D, C, R1, R0], tint, inner, L, mat, 0, 1, 3);
    pushFace(faces, [P(wA0, wC0, ze), P(wA0, wC1, ze), P(wA0, acm, zr)], gtint, inner, L);  // gable walls
    pushFace(faces, [P(wA1, wC0, ze), P(wA1, wC1, ze), P(wA1, acm, zr)], gtint, inner, L);
    pushRidge(faces, P, aL, aR, acm, zr, P0.ridge, inner, L);
  } else if (st.form === 'gambrel') {
    const knee = st.knee ?? 0.55, kIn = halfShort * knee;
    const zk = ze + kIn * (st.lowerPitch ?? 1.5);
    const zR = zk + (halfShort - kIn) * (st.upperPitch ?? 0.45);
    const nearK0 = C0 + kIn, farK0 = C1 - kIn;
    // near (C0) lower steep + upper shallow
    pushSkin(faces, [P(aL, C0, ze), P(aR, C0, ze), P(aR, nearK0, zk), P(aL, nearK0, zk)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(aL, nearK0, zk), P(aR, nearK0, zk), P(aR, acm, zR), P(aL, acm, zR)], tint, inner, L, mat, 0, 1, 3);
    // far (C1)
    pushSkin(faces, [P(aL, C1, ze), P(aR, C1, ze), P(aR, farK0, zk), P(aL, farK0, zk)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(aL, farK0, zk), P(aR, farK0, zk), P(aR, acm, zR), P(aL, acm, zR)], tint, inner, L, mat, 0, 1, 3);
    // gambrel gable walls: lower trapezoid (quad) + upper triangle, flush at each end
    for (const aw of [wA0, wA1]) {
      pushFace(faces, [P(aw, wC0, ze), P(aw, wC1, ze), P(aw, wC1 - kIn, zk), P(aw, wC0 + kIn, zk)], gtint, inner, L);
      pushFace(faces, [P(aw, wC0 + kIn, zk), P(aw, wC1 - kIn, zk), P(aw, acm, zR)], gtint, inner, L);
    }
    pushRidge(faces, P, aL, aR, acm, zR, P0.ridge, inner, L);
  } else if (st.form === 'mansard') {
    // steep lower band of ABSOLUTE height (≈ one storey) leaning IN to an inset crown, capped by
    // a low flat top — the recognizable "a storey in the roof" French read.
    const zk = ze + (st.mansardRise ?? 9);
    const kIn = halfShort * (st.knee ?? 0.5);                                 // how far the steep face leans in
    const ia0 = A0 + kIn, ia1 = A1 - kIn, ic0 = C0 + kIn, ic1 = C1 - kIn;     // inset crown rect at zk
    pushSkin(faces, [P(A0, C0, ze), P(A1, C0, ze), P(ia1, ic0, zk), P(ia0, ic0, zk)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(A0, C1, ze), P(A1, C1, ze), P(ia1, ic1, zk), P(ia0, ic1, zk)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(A0, C0, ze), P(A0, C1, ze), P(ia0, ic1, zk), P(ia0, ic0, zk)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(A1, C0, ze), P(A1, C1, ze), P(ia1, ic1, zk), P(ia1, ic0, zk)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(ia0, ic0, zk), P(ia1, ic0, zk), P(ia1, ic1, zk), P(ia0, ic1, zk)], P0.roof, inner, L, mat, 0, 1, 3); // flat crown
  } else if (st.form === 'saltbox') {
    const bias = st.ridgeBias ?? 0.34, ra = C0 + (C1 - C0) * bias;            // ridge offset toward C0 (front)
    pushSkin(faces, [P(aL, C0, ze), P(aR, C0, ze), P(aR, ra, zr), P(aL, ra, zr)], tint, inner, L, mat); // short steep front
    pushSkin(faces, [P(aL, C1, ze), P(aR, C1, ze), P(aR, ra, zr), P(aL, ra, zr)], tint, inner, L, mat); // long shallow rear
    pushFace(faces, [P(wA0, wC0, ze), P(wA0, wC1, ze), P(wA0, ra, zr)], gtint, inner, L);  // asymmetric gable walls
    pushFace(faces, [P(wA1, wC0, ze), P(wA1, wC1, ze), P(wA1, ra, zr)], gtint, inner, L);
    pushRidge(faces, P, aL, aR, ra, zr, P0.ridge, inner, L);
  } else if (st.form === 'shed') {
    const zh = ze + 2 * halfShort * st.pitch;                                 // high eave at C1
    pushSkin(faces, [P(A0, C0, ze), P(A1, C0, ze), P(A1, C1, zh), P(A0, C1, zh)], tint, inner, L, mat, 0, 1, 3);
    pushFace(faces, [P(wA0, wC1, ze), P(wA1, wC1, ze), P(wA1, wC1, zh), P(wA0, wC1, zh)], gtint, inner, L);   // tall clerestory wall
    pushFace(faces, [P(wA0, wC0, ze), P(wA0, wC1, ze), P(wA0, wC1, zh)], gtint, inner, L);                    // raking end walls
    pushFace(faces, [P(wA1, wC0, ze), P(wA1, wC1, ze), P(wA1, wC1, zh)], gtint, inner, L);
    uniformEave = false;
  } else if (st.form === 'butterfly') {
    const zh = ze + halfShort * st.pitch * 2;                                 // high outer eaves, valley at acm
    pushSkin(faces, [P(A0, C0, zh), P(A1, C0, zh), P(A1, acm, ze), P(A0, acm, ze)], tint, inner, L, mat, 0, 1, 3);
    pushSkin(faces, [P(A0, C1, zh), P(A1, C1, zh), P(A1, acm, ze), P(A0, acm, ze)], tint, inner, L, mat, 0, 1, 3);
    pushFace(faces, [P(wA0, wC0, zh), P(wA0, acm, ze), P(wA0, wC1, zh)], gtint, inner, L);   // V end walls
    pushFace(faces, [P(wA1, wC0, zh), P(wA1, acm, ze), P(wA1, wC1, zh)], gtint, inner, L);
    uniformEave = false;
  }

  if (uniformEave) pushEaves(faces, fp, oh, P, ze, inner, L, P0.soffit || P0.fascia, st.rafters ? P0.rafter : null, gableFamily);
}

// ── flat occupiable deck: slab + parapet ring + corner-post railing + a pergola ──
function flatDeck(faces, fp, st, P, L) {
  const { x, y, w, d, z } = fp;
  const x0 = x, x1 = x + w, y0 = y, y1 = y + d, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const zd = z + 0.1, ph = 1.0, pt = 0.5;
  const inner = [cx, cy, z + 1.5];
  pushFace(faces, [[x0, y0, zd], [x1, y0, zd], [x1, y1, zd], [x0, y1, zd]], P.deck, inner, L);
  pushBox(faces, x0, y0, z, x1, y0 + pt, z + ph, P.parapet, inner, L);
  pushBox(faces, x0, y1 - pt, z, x1, y1, z + ph, P.parapet, inner, L);
  pushBox(faces, x0, y0, z, x0 + pt, y1, z + ph, P.parapet, inner, L);
  pushBox(faces, x1 - pt, y0, z, x1, y1, z + ph, P.parapet, inner, L);
  const rz0 = z + ph, rz1 = rz0 + 1.4, pr = 0.14;
  const posts = [[x0 + pt, y0 + pt], [x1 - pt, y0 + pt], [x0 + pt, y1 - pt], [x1 - pt, y1 - pt], [cx, y0 + pt], [cx, y1 - pt]];
  for (const [px, py] of posts) pushBox(faces, px - pr, py - pr, rz0, px + pr, py + pr, rz1, P.rail, inner, L);
  pushBox(faces, x0 + pt, y0 + pt - 0.08, rz1 - 0.16, x1 - pt, y0 + pt + 0.08, rz1, P.rail, inner, L);
  pushBox(faces, x0 + pt, y1 - pt - 0.08, rz1 - 0.16, x1 - pt, y1 - pt + 0.08, rz1, P.rail, inner, L);
  if (P.pergola) {
    const gx0 = cx - w * 0.18, gx1 = cx + w * 0.18, gy0 = cy - d * 0.04, gy1 = cy + d * 0.3, gz = z + ph + 2.2;
    pushBox(faces, gx0, gy0, zd, gx0 + 0.24, gy1, gz, P.pergola, inner, L);
    pushBox(faces, gx1 - 0.24, gy0, zd, gx1, gy1, gz, P.pergola, inner, L);
    for (let i = 0; i <= 5; i++) { const sy = gy0 + (i / 5) * (gy1 - gy0); pushBox(faces, gx0, sy - 0.08, gz - 0.2, gx1, sy + 0.08, gz, P.pergola, inner, L); }
  }
}

/**
 * Build a roof for one house footprint.
 *
 * @param {{x,y,w,d,z}} footprint  z = wall top (the eave datum); w×d in world units (feet)
 * @param {object} opts
 *   style    one of STYLES; default 'bungalow'
 *   form|material|pitch|eave|palette|knee|lowerPitch|upperPitch|ridgeBias  per-field overrides
 *   light    a vexar light (required for the Lambert bake)
 *   roomHeight  set-back upper-room height for 'stacked-room' (default 9)
 * @returns {{ faces: object[], textureKeys: string[] }}
 */
export function buildRoof(footprint, opts = {}) {
  const base = STYLES[opts.style] || STYLES.bungalow;
  const st = { ...base, ...opts, palette: { ...base.palette, ...(opts.palette || {}) } };
  const P = st.palette, L = opts.light;
  if (!L) throw new Error('buildRoof: opts.light is required');
  const faces = [];

  if (st.form === 'flat-deck') {
    flatDeck(faces, footprint, st, P, L);
  } else if (st.form === 'stacked-room') {
    flatDeck(faces, footprint, { ...st, form: 'flat-deck' }, P, L);
    const { x, y, w, d, z } = footprint;
    const inset = Math.min(w, d) * 0.2;
    const ux0 = x + inset, uy0 = y + inset, uw = w - 2 * inset, ud = d - 2 * inset;
    const roomH = opts.roomHeight ?? 9, ztop = z + 1.0 + roomH;
    const inner = [x + w / 2, y + d / 2, z + roomH];
    pushBox(faces, ux0, uy0, z + 1.0, ux0 + uw, uy0 + ud, ztop, P.wall, inner, L);
    pitchedRoof(faces, { x: ux0, y: uy0, w: uw, d: ud, z: ztop }, { ...st, form: 'hip' }, P, L);
  } else {
    pitchedRoof(faces, footprint, st, P, L);
  }

  const textureKeys = [...new Set(faces.map((f) => f.texture).filter(Boolean))];
  return { faces, textureKeys };
}

export { STYLES as ROOF_STYLES };
