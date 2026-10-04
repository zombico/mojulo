/**
 * station-loft-shade — the CHARACTER LIGHT baked onto a compiled LAYERED mesh: a two-tone step on three inputs
 * (the light vector, a threshold on N·L, the shading normal), with a chosen shade swatch per palette group, and a third
 * tone (the highlight) where a light names one.
 *
 * Its pieces, every one derived at read time from the compiled mesh (nothing stored, nothing camera-dependent —
 * the baked-light rule of the face payload holds):
 *
 *   • resolveCharacterLight(manifest, ctx) — WHICH light: `ctx.light` (FLAT_LIGHT under the unshaded / lit export)
 *     wins and returns null (the caller keeps its own bake); then the manifest's `toon.light` (vexar resolveToon;
 *     `false` opts out); then, for a hero wearing the anime head (`hero.head === 'anime'`), the default character
 *     light as a READ-TIME default, so every stored anime hero takes it without a re-mint. Anything else → null,
 *     and the caller's output is byte-identical to before the channel existed.
 *   • layeredShadingNormals(mesh, recipe, opts) — per-FACE-CORNER shading normals: welded by (palette group,
 *     quantised position) into smooth fans split at a 35° crease (dot > 0.82, the limit the anime head's source
 *     smooths at), area-weighted, plus one cheap proxy on the anime head — its Skin blended toward a vertical capsule
 *     down the hidden cranium core to the mouth's height, by a region weight (1 around the eyes and the mouth, 0.5
 *     over the rest of the face, 0.3 on the ears, 0 on the neck and body), so the face shades as one rounded form
 *     instead of its facets. Hair keeps its welded normals (one radial proxy splits the whole mass along a single
 *     diagonal) and steps on its own threshold instead. A part riding the head bone can be lit in its own frame
 *     (`rigid`), so a stand never moves the face's shadow shapes.
 *   • characterLitPieces(mesh, { light, normals, palette, dz, rest }) — the step, crisp: a triangle whose corners
 *     straddle the threshold is SPLIT along the straight iso-line (d = N·L interpolated linearly along the two crossing
 *     edges) into a lit piece and a shade piece, each FLAT-filled, and with `light.highlight` the lit side split again
 *     along a second line into the third tone, conforming the same way. No per-vertex colour anywhere, so the terminator
 *     is a clean edge in the World view, the static GLB, the rig pack and the print soup alike. Under the anime head
 *     the neck is always in shade (the neck occlusion rule: the head shadows the neck) and the hair's top planes take
 *     the light from above too. The split is
 *     CONFORMING: every crossing point is registered on its edge and every face sharing that edge takes it as a
 *     boundary vertex, so no T-junction opens (closed parts stay closed, and the ink census sees no false boundary).
 *     Every piece corner says where it came from (a vertex, or a fraction along an edge), so the rig pack
 *     (station-loft-rig.js packLayeredRig `character`) carries joints and weights through the split exactly as
 *     the position went. characterLitFaces is the same pieces as studio faces; piecesAt re-places them on another
 *     pose of the same mesh (a figure standing in its gesture is lit posed, and its rig pack skins from the rest).
 *   • characterInk(ink, height) — the outline a character-lit figure wears by default: the silhouette hull only,
 *     at a width set by the figure's height rather than a render group's radius.
 *   • drawLayer(mesh, piece, { hairInk }) — the piece's DRAW LAYER for the World page's stencil rules
 *     (channels/draw-layers.js): `through` / `veil` from its part's flag, `hair` for any other hair with the ink on;
 *     characterLitFaces writes it on the static faces, the rig pack orders its parts by it.
 *
 * Pure and deterministic: functions of the mesh, the recipe and the light alone.
 */
import { hexToRgb, rgbToHex, resolveToon, resolveToonLight } from './vexar.js';
import { layeredSeat } from './station-loft-faces.js';
import * as dmath from '../../util/dmath.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => dmath.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return l > 1e-300 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const FALLBACK = '#8a8f96';
const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o); };

/** The anime hero's default character light (the read-time default; frozen, shared). */
export const ANIME_CHARACTER_LIGHT = deepFreeze(resolveToonLight(true));
/** The anime hero's default HAIR HIGHLIGHT per design base (the head's pole: `headPreset`, else the cast when it is male or
 * female, else male), a read-time default like the light: the RING on the female (the sheen line across the lit side of
 * the mass), the STREAK on the male (the lit tops of the fringe's locks, where they rise off the hairline). */
export const ANIME_HAIR_HIGHLIGHT = deepFreeze({ female: resolveToonLight({ highlight: { Hair: { kind: 'ring' } } }).highlight, male: resolveToonLight({ highlight: { Hair: { kind: 'streak', parts: 'fringe' } } }).highlight });
/** the default light with the pole's highlight (frozen, shared) */
const ANIME_LIGHT_OF = deepFreeze({ female: { ...resolveToonLight(true), highlight: ANIME_HAIR_HIGHLIGHT.female }, male: { ...resolveToonLight(true), highlight: ANIME_HAIR_HIGHLIGHT.male } });
const animePole = (hero) => (hero.headPreset === 'female' || hero.headPreset === 'male' ? hero.headPreset : hero.cast === 'female' || hero.cast === 'male' ? hero.cast : 'male');

/** Derived shade swatches (a multiplier of the base colour) for a group with no explicit `shade`: each keeps its colour
 * in one value group, about 10–13 CIE L* below its lit tone — skin shades warm (the hue moves toward red), anything else
 * a cool neutral. Hair derives its own by value (derivedShade). */
export const DERIVED_SHADE = deepFreeze({ Skin: [0.90, 0.76, 0.76], other: [0.76, 0.76, 0.86] });

// ─── colour by value (CIE L*a*b* / LCh, D65, sRGB) ─────────────────────────
const D65 = [0.95047, 1, 1.08883];
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : dmath.pow((c + 0.055) / 1.055, 2.4)), toGam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * dmath.pow(c, 1 / 2.4) - 0.055);
/** "#rrggbb" → [L*, C*, h°] */
function hexLch(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => toLin(v / 255));
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / D65[0], Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / D65[2];
  const f = (t) => (t > 216 / 24389 ? dmath.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const L = 116 * f(Y) - 16, A = 500 * (f(X) - f(Y)), B = 200 * (f(Y) - f(Z));
  return [L, dmath.hypot(A, B), ((dmath.atan2(B, A) * 180 / Math.PI) + 360) % 360];
}
/** [L*, C*, h°] → "#rrggbb" (clamped into sRGB) */
function lchHex(L, C, hDeg) {
  const h = hDeg * Math.PI / 180, A = C * dmath.cos(h), B = C * dmath.sin(h);
  const fy = (L + 16) / 116, fx = fy + A / 500, fz = fy - B / 200, inv = (t) => (dmath.pow(t, 3) > 216 / 24389 ? dmath.pow(t, 3) : (116 * t - 16) / (24389 / 27));
  const X = inv(fx) * D65[0], Y = inv(fy) * D65[1], Z = inv(fz) * D65[2];
  const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  return rgbToHex(rgb.map((c) => toGam(Math.max(0, Math.min(1, c))) * 255));
}
/** hue toward violet (h ≈ 300° in LCh(ab)) by up to `deg`, along the shorter arc (never past it) */
const VIOLET = 300;
const hueToward = (h, deg) => { const d = ((VIOLET - h + 540) % 360) - 180; return (h + Math.sign(d) * Math.min(deg, Math.abs(d)) + 360) % 360; };
/** the derived hair shade's floor, CIE L*: about 15 above the World page's own dark backdrop (L* ≈ 5), so a dark hair's
 * shade side and its outline still part from the background; never closer than 10 to the lit tone */
const HAIR_SHADE_FLOOR = 20.5;
/** The derived SHADE swatch of `group` over its base `hex` (a group with no explicit `shade`): Hair by value — L* × 0.52
 * (floored at HAIR_SHADE_FLOOR, but at least 10 below the lit tone), chroma × 0.75, the hue moved 20° toward violet (a
 * hue-shifted shade, never a greyed one: a warm brown's shade stays brown, a blue-black's goes a little violet); Skin and
 * everything else by DERIVED_SHADE's multiplier. */
export function derivedShade(group, hex) {
  if (group === 'Hair') { const [L, C, h] = hexLch(hex); return lchHex(Math.max(L * 0.52, Math.min(HAIR_SHADE_FLOOR, L - 10)), C * 0.75, hueToward(h, 20)); }
  const m = DERIVED_SHADE[group] || DERIVED_SHADE.other; const c = hexToRgb(hex);
  return rgbToHex([c[0] * m[0], c[1] * m[1], c[2] * m[2]]);
}
/** The derived HIGHLIGHT swatch over a base `hex` (a group whose palette carries no `<group>Highlight`): a quarter of the
 * way from its L* to white (about +16 on a dark hair), chroma × 1.15, the same hue — always lighter than the base; null
 * when that lift is under 4 L* (a base above L* 84: no lighter tone reads, so the lit side keeps one tone) */
export function derivedHighlight(hex) { const [L, C, h] = hexLch(hex), lift = 0.25 * (100 - L); return lift < 4 ? null : lchHex(L + lift, C * 1.15, h); }

/** The character light for a layered manifest at read time, or null (the caller keeps its own bake). See the header.
 * An anime hero also takes its design base's hair highlight (ANIME_HAIR_HIGHLIGHT) unless its light says `highlight`. */
export function resolveCharacterLight(manifest, ctx = {}) {
  if (ctx?.light) return null;   // FLAT_LIGHT (unshaded / lit export) wins: raw albedo has no tones to step
  // ctx.toon is world-scene's resolved dial; a caller without one resolves the manifest's own
  const toon = ctx && 'toon' in ctx ? ctx.toon : resolveToon(manifest?.toon ?? manifest?.scene?.toon, { light: true });
  const own = toon?.light;
  if (own === false) return null;
  const anime = manifest?.hero?.head === 'anime';
  if (own) return anime && own.highlight === undefined ? { ...own, highlight: ANIME_HAIR_HIGHLIGHT[animePole(manifest.hero)] } : own;
  return anime ? ANIME_LIGHT_OF[animePole(manifest.hero)] : null;
}

// ─── shading normals ──────────────────────────────────────────────────────
const partOf = (mesh, fi) => mesh.provenance[mesh.faces[fi][0]].part;
/** the recipe wears the anime head's face shell over a hidden cranium core (the head proxy's inputs) */
const wearsAnimeFace = (recipe, mesh) => !!((recipe?.parts?.face || mesh.parts?.face) && (recipe?.parts?.cranium || mesh.parts?.cranium));

/** The head proxy's landmarks, all on the REST mesh (the head upright; same topology as any pose of it): the capsule
 * axis (from the cranium core's corner centroid straight down to the mouth's height — the stomion line) and the eye and
 * mouth regions (the face part's Sclera per side and its Mouth), so the region weights stay attached to their vertices
 * when a pose turns the head. */
function headProxyLandmarks(rest) {
  const acc = () => ({ s: [0, 0, 0], n: 0, lo: Infinity, hi: -Infinity });
  const add = (a, p) => { a.s[0] += p[0]; a.s[1] += p[1]; a.s[2] += p[2]; a.n++; if (p[0] < a.lo) a.lo = p[0]; if (p[0] > a.hi) a.hi = p[0]; };
  const cr = acc(), eL = acc(), eR = acc(), mo = acc(); const neck = new Set();
  rest.faces.forEach((t, fi) => {
    const part = partOf(rest, fi), g = rest.groups[fi];
    if (part === 'cranium') for (const vi of t) add(cr, rest.vertices[vi]);
    else if (part === 'face' && (g === 'Sclera' || g === 'Mouth')) for (const vi of t) { const p = rest.vertices[vi]; add(g === 'Mouth' ? mo : p[0] < 0 ? eL : eR, p); }
    else if (part === 'neck') for (const vi of t) neck.add(vi);
  });
  if (!cr.n) return null;
  const region = (a) => (a.n ? { c: a.s.map((v) => v / a.n), r: (a.hi - a.lo) / 2 } : null);
  const centre = cr.s.map((v) => v / cr.n), mouth = region(mo);
  const byZ = [...neck].sort((i, j) => rest.vertices[i][2] - rest.vertices[j][2] || i - j); const q = Math.max(1, Math.floor(byZ.length / 4));
  return { centre, bottom: mouth ? Math.min(centre[2], mouth.c[2]) : centre[2], eyes: [region(eL), region(eR)].filter((e) => e && e.r > 0), mouth, neck: byZ.length >= 8 ? { lo: byZ.slice(0, q), hi: byZ.slice(-q) } : null };
}
/** The neck's axis on the SHOWN positions `V`: from the centroid of its lowest quarter of vertices to that of its highest
 * (chosen at rest; a short wide prism has no trustworthy principal axis), so a posed neck's axis bends with it and every
 * corner of a vertex reads the same direction; `{ a, d, len }`, or null when flat. */
function neckAxis(V, { lo, hi }) {
  const mean = (ids) => ids.reduce((m, vi) => [m[0] + V[vi][0] / ids.length, m[1] + V[vi][1] / ids.length, m[2] + V[vi][2] / ids.length], [0, 0, 0]);
  const a = mean(lo), b = mean(hi); const e = sub(b, a), l = len(e);
  return l > 1e-6 ? { a, d: [e[0] / l, e[1] / l, e[2] / l], len: l } : null;
}
/** the neck's weight toward its cylinder: the prism's facets (45° apart, past the crease) shade as one round column */
const NECK_WEIGHT = 0.7;
/** a triangle's orthonormal frame (edge, in-plane, normal), or null when degenerate */
function triFrame(V, t) {
  const a = V[t[0]], e = sub(V[t[1]], a), n = cross(e, sub(V[t[2]], a)); const le = len(e), ln = len(n);
  if (!(le > 1e-300 && ln > 1e-300)) return null;
  const e1 = [e[0] / le, e[1] / le, e[2] / le], nn = [n[0] / ln, n[1] / ln, n[2] / ln];
  return [e1, cross(nn, e1), nn];
}

/** The weld (see layeredShadingNormals): per-corner normals over `V` (the shown positions), welded by (group, REST
 * position) into FANS — the faces of one bin joined across the edges they share where their faces turn less than the
 * crease — each corner the area-weighted sum of its own fan. */
function weldedNormals(V, F, G, restV, crease, q) {
  const nF = F.length; const pid = new Int32Array(restV.length); const ids = new Map();
  for (let vi = 0; vi < restV.length; vi++) { const p = restV[vi]; const k = `${Math.round(p[0] / q)},${Math.round(p[1] / q)},${Math.round(p[2] / q)}`; let id = ids.get(k); if (id === undefined) ids.set(k, id = ids.size); pid[vi] = id; }
  const gids = new Map(); const fg = new Int32Array(nF);
  for (let fi = 0; fi < nF; fi++) { let id = gids.get(G[fi]); if (id === undefined) gids.set(G[fi], id = gids.size); fg[fi] = id; }
  const fn = new Float64Array(3 * nF), fu = new Float64Array(3 * nF), ok = new Uint8Array(nF);   // unnormalized ⇒ area-weighted sums
  for (let fi = 0; fi < nF; fi++) {
    const t = F[fi], a = V[t[0]], n = cross(sub(V[t[1]], a), sub(V[t[2]], a)), l = len(n);
    fn[3 * fi] = n[0]; fn[3 * fi + 1] = n[1]; fn[3 * fi + 2] = n[2];
    if (l > 1e-300) { ok[fi] = 1; fu[3 * fi] = n[0] / l; fu[3 * fi + 1] = n[1] / l; fu[3 * fi + 2] = n[2] / l; }
  }
  const P = ids.size; const bins = new Map();   // groupId·P + positionId → corner ids (3·fi + k)
  for (let fi = 0; fi < nF; fi++) for (let k = 0; k < 3; k++) { const key = fg[fi] * P + pid[F[fi][k]]; let b = bins.get(key); if (!b) bins.set(key, b = []); b.push(3 * fi + k); }
  const c = dmath.cos((crease * Math.PI) / 180); const out = new Array(nF);
  for (let fi = 0; fi < nF; fi++) out[fi] = [null, null, null];
  const par = [], sum = [];
  for (const bin of bins.values()) {
    const m = bin.length; par.length = m; for (let i = 0; i < m; i++) par[i] = i;
    const find = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      const fi = (bin[i] / 3) | 0, fj = (bin[j] / 3) | 0; let join = fi === fj;
      if (!join && ok[fi] && ok[fj] && fu[3 * fi] * fu[3 * fj] + fu[3 * fi + 1] * fu[3 * fj + 1] + fu[3 * fi + 2] * fu[3 * fj + 2] > c) {
        const ki = bin[i] % 3, kj = bin[j] % 3, ti = F[fi], tj = F[fj];   // a shared edge: one more position in common
        const a1 = pid[ti[(ki + 1) % 3]], a2 = pid[ti[(ki + 2) % 3]], b1 = pid[tj[(kj + 1) % 3]], b2 = pid[tj[(kj + 2) % 3]];
        join = a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2;
      }
      if (join) { const ri = find(i), rj = find(j); if (ri !== rj) par[ri] = rj; }
    }
    // each fan's sum over its DISTINCT faces; a degenerate face's corner takes the whole bin's (unfiltered) sum
    sum.length = 0; const seen = new Map(); const all = [0, 0, 0]; const allSeen = new Set();
    for (let i = 0; i < m; i++) {
      const fi = (bin[i] / 3) | 0, r = find(i); let s = sum[r]; if (!s) sum[r] = s = [0, 0, 0];
      const key = r * nF + fi; if (!seen.has(key)) { seen.set(key, 1); s[0] += fn[3 * fi]; s[1] += fn[3 * fi + 1]; s[2] += fn[3 * fi + 2]; }
      if (!allSeen.has(fi)) { allSeen.add(fi); all[0] += fn[3 * fi]; all[1] += fn[3 * fi + 1]; all[2] += fn[3 * fi + 2]; }
    }
    for (let i = 0; i < m; i++) { const fi = (bin[i] / 3) | 0; out[fi][bin[i] % 3] = unit(ok[fi] ? sum[find(i)] : all); }
  }
  return out;
}

/** The region weight toward the head capsule at a Skin vertex (rest position `p`) of `part`: an elliptical falloff in
 * the frontal (x, z) plane around each eye and the mouth (1 inside, fading to the face's 0.5 over 0.6 radii). */
function regionWeight(part, p, L) {
  if (part === 'face') {
    let w = 0.5;
    for (const e of L.eyes) { const d = dmath.hypot((p[0] - e.c[0]) / (e.r * 1.35), (p[2] - e.c[2]) / (e.r * 1.1)); w = Math.max(w, clamp01(1 - (d - 1) / 0.6)); }
    const m = L.mouth; if (m && m.r > 0) { const d = dmath.hypot((p[0] - m.c[0]) / (m.r * 1.6), (p[2] - m.c[2]) / m.r); w = Math.max(w, clamp01(1 - (d - 1) / 0.6)); }
    return w;
  }
  return /^ear/.test(part) ? 0.3 : 0;   // the ears lean in a little; the neck, the hands and the core keep their weld
}

/**
 * Per-face-corner shading normals `[fi][k] → [x, y, z]` (unit length), shaped like `mesh.faces`.
 *   crease   degrees: two faces of one weld bin join the same smooth FAN across an edge they share when their faces
 *            turn less than this (default 35: dot > 0.82, the limit the anime head's source smooths at); each corner
 *            takes its fan's area-weighted sum, so the two faces across a smooth edge read the SAME normal at both of
 *            its ends (the step then crosses that edge at one point) and a crease edge stays sharp
 *   quantum  the weld's position quantum in metres (default 1e-4)
 *   proxy    the anime head's Skin proxy (default: on when the recipe wears the anime face shell and cranium core)
 *   rest     the unposed mesh (same topology): the weld keys, the proxy's axis and its region weights read it; default
 *            the mesh itself. Pass the rest mesh when `mesh` is posed, so the weld and the weights follow their
 *            vertices (a quantised weld of posed positions would regroup near-coincident corners); the proxy's
 *            direction is carried from rest onto each posed face by that face's own rest → posed rotation.
 *   rigid    parts (a Set of names) whose corners take the REST mesh's normals outright: a part riding one bone (the
 *            head) is then lit in its OWN frame, so a stand that turns or nods the head leaves its shadow shapes as
 *            designed at rest (the light turns with the head) and the rig pack's rigidly carried colours agree.
 * The head proxy: the face's Skin blended toward a vertical CAPSULE (the cranium core's centroid straight down to the
 * mouth's height) by a region weight — 1 around the eyes and the mouth, 0.5 over the rest of the face, 0.3 on the
 * ears, 0 on the neck and body — so the eye and mouth band shade as one rounded form with level normals, and the
 * chin and the jaw's underside roll into shade below it; and the neck's Skin blended toward a cylinder about its own
 * axis (NECK_WEIGHT), so its prism facets shade as one round column. A degenerate face takes its weld's unfiltered sum
 * (or +z when that is zero too), so every entry is unit length.
 */
export function layeredShadingNormals(mesh, recipe = {}, { crease = 35, quantum = 1e-4, proxy = wearsAnimeFace(recipe, mesh), rest = mesh, rigid = null } = {}) {
  if (rigid && rigid.size && rest !== mesh) {
    const own = layeredShadingNormals(mesh, recipe, { crease, quantum, proxy, rest }), still = layeredShadingNormals(rest, recipe, { crease, quantum, proxy });
    return own.map((f, fi) => (rigid.has(partOf(mesh, fi)) ? still[fi] : f));
  }
  const V = mesh.vertices, F = mesh.faces, G = mesh.groups;
  // the weld is topology: keyed on the REST positions, so a posed mesh welds exactly the corners its rest welds
  const out = weldedNormals(V, F, G, rest.vertices, crease, quantum);
  if (!proxy) return out;
  const L = headProxyLandmarks(rest); if (!L) return out;
  const C = L.centre, zLo = L.bottom; const wOf = new Map(); const RV = rest.vertices; const posed = rest !== mesh; const NA = L.neck && neckAxis(V, L.neck);
  F.forEach((t, fi) => {
    if (G[fi] !== 'Skin') return;
    const part = partOf(mesh, fi); let fr = null;
    t.forEach((vi, k) => {
      if (part === 'neck') {   // off the neck's own axis, on the shown positions (per vertex: continuous across its faces)
        if (!NA) return; const p = V[vi], { a, d, len: l } = NA; const u = Math.min(l, Math.max(0, dot(sub(p, a), d)));
        const s = unit(sub(p, [a[0] + d[0] * u, a[1] + d[1] * u, a[2] + d[2] * u])), n = out[fi][k], w = NECK_WEIGHT;
        out[fi][k] = unit([n[0] * (1 - w) + s[0] * w, n[1] * (1 - w) + s[1] * w, n[2] * (1 - w) + s[2] * w]); return;
      }
      let w = wOf.get(vi); if (w === undefined) wOf.set(vi, w = regionWeight(part, RV[vi], L));
      if (!(w > 0)) return;
      const p = RV[vi]; let s = unit(sub(p, [C[0], C[1], p[2] > C[2] ? C[2] : p[2] < zLo ? zLo : p[2]]));   // off the capsule's axis, at rest
      if (posed) {   // carried onto the posed face by its own rest → posed rotation (exact for a face riding one bone)
        if (!fr) fr = [triFrame(RV, t), triFrame(V, t)];
        const [R0, R1] = fr; if (!R0 || !R1) return;
        const co = [dot(R0[0], s), dot(R0[1], s), dot(R0[2], s)];
        s = [co[0] * R1[0][0] + co[1] * R1[1][0] + co[2] * R1[2][0], co[0] * R1[0][1] + co[1] * R1[1][1] + co[2] * R1[2][1], co[0] * R1[0][2] + co[1] * R1[1][2] + co[2] * R1[2][2]];
      }
      const n = out[fi][k];
      out[fi][k] = unit([n[0] * (1 - w) + s[0] * w, n[1] * (1 - w) + s[1] * w, n[2] * (1 - w) + s[2] * w]);
    });
  });
  return out;
}

// ─── the crisp step: a conforming iso-split ─────────────────────────────────
const SNAP_M = 1e-6;     // metres: a crossing this close to an edge's end IS that end, and two crossings this close on
                         // one edge are ONE point (faces across a crease edge compute their own; a hair apart they would
                         // leave a sliver thinner than AREA2 between them, dropped, and the part open)
const AREA2 = 1e-14;     // twice a piece's area at or below this is no piece (layeredFaces' degenerate rule)
/** THE HAIR'S TOP PLANES (under the anime head): a hair corner's N·L gains this share of its shading normal's upward
 * component — the planes on top of the mass take the light from above as well as the key's, so the crown and the upper
 * back still read lit from behind and above (the rear three-quarter camera) while the undersides and the hanging back
 * keep the key's shade shapes */
const HAIR_TOP_PLANES = 0.8;

/** The shade swatch of `group` over `hex`: the light's explicit swatch, else the derived one (derivedShade). */
function shadeFill(light, group, hex) {
  const own = light.shade?.[group]; if (own) return own;
  return derivedShade(group, hex);
}
/** a point inside a triangle by its corners' weights `[[vi, w] ×3]`, seated by `dz` (one arithmetic for the split and for
 * piecesAt, so re-placing on the same mesh is exact) */
function baryPoint(V, bary, dz) {
  let x = 0, y = 0, z = 0;
  for (const [vi, w] of bary) { x += V[vi][0] * w; y += V[vi][1] * w; z += V[vi][2] * w; }
  return [x, y, z + dz];
}
/** the parts a highlight's `parts` word keeps */
const HIGHLIGHT_PARTS_RE = { fringe: /^hair(Form)?Fringe/ };
/** The highlight's band frame on the REST mesh: the skull crown and the menton as the top and bottom of the `face` part's
 * Skin (the anime head's face shell), else of the group's own faces; `{ top, H, axis }` in metres (`axis` the centre of
 * that shell's or group's box across x and y: the head's vertical axis), or null. */
function bandFrame(rest, group) {
  const box = () => ({ z: [Infinity, -Infinity], x: [Infinity, -Infinity], y: [Infinity, -Infinity] });
  const face = box(), own = box();
  const add = (b, p) => { for (const [k, i] of [['x', 0], ['y', 1], ['z', 2]]) { if (p[i] < b[k][0]) b[k][0] = p[i]; if (p[i] > b[k][1]) b[k][1] = p[i]; } };
  rest.faces.forEach((t, fi) => {
    const part = partOf(rest, fi), g = rest.groups[fi];
    if (part === 'face' && g === 'Skin') for (const vi of t) add(face, rest.vertices[vi]);
    else if (g === group) for (const vi of t) add(own, rest.vertices[vi]);
  });
  const of = (b) => ({ top: b.z[1], H: b.z[1] - b.z[0], axis: [(b.x[0] + b.x[1]) / 2, (b.y[0] + b.y[1]) / 2] });
  if (face.z[1] > face.z[0]) return of(face);
  return own.z[1] > own.z[0] ? of(own) : null;
}

/** twice the signed area of (a, b, c) along the unit normal n */
const orient2 = (a, b, c, n) => dot(cross(sub(b, a), sub(c, a)), n);
/** w strictly inside segment a–c (collinear within a relative tolerance) */
function onSegment(w, a, c) {
  const e = sub(c, a), d = sub(w, a), ee = dot(e, e); if (!(ee > 0)) return false;
  const t = dot(d, e); if (!(t > 0 && t < ee)) return false;
  return len(cross(e, d)) <= 1e-9 * ee;
}

/** Triangulate a convex ring of point refs (`{ p }`, the parent's winding, collinear boundary points allowed) into
 * triangles that use EVERY ring point: ear clipping that skips degenerate ears and ears whose diagonal would run
 * over another ring point. Winding follows the ring. */
function triangulate(ring, n) {
  let R = ring.filter((r, i) => r !== ring[(i + 1) % ring.length]);
  const tris = [];
  while (R.length > 3) {
    let cut = -1;
    for (let i = 0; i < R.length && cut < 0; i++) {
      const a = R[(i + R.length - 1) % R.length], b = R[i], c = R[(i + 1) % R.length];
      if (!(orient2(a.p, b.p, c.p, n) > AREA2)) continue;
      if (R.some((w) => w !== a && w !== b && w !== c && onSegment(w.p, a.p, c.p))) continue;
      cut = i; tris.push([a, b, c]);
    }
    if (cut < 0) break;
    R = R.filter((_, j) => j !== cut);
  }
  if (R.length === 3) { if (orient2(R[0].p, R[1].p, R[2].p, n) > AREA2) tris.push(R); }
  else if (R.length > 3) {   // numerically stuck (never seen): fan from the centroid, which is inside a convex ring
    const m = R.reduce((s, r) => [s[0] + r.p[0] / R.length, s[1] + r.p[1] / R.length, s[2] + r.p[2] / R.length], [0, 0, 0]); const ctr = { p: m, mix: [...R] };
    R.forEach((r, i) => { const s = R[(i + 1) % R.length]; if (orient2(r.p, s.p, m, n) > AREA2) tris.push([r, s, ctr]); });
  }
  return tris;
}
const ringArea2 = (R, n) => { let s = 0; for (let i = 1; i + 1 < R.length; i++) s += orient2(R[0].p, R[i].p, R[i + 1].p, n); return s; };

/**
 * The character light's step over a compiled mesh, as PIECES: `[{ fi, refs: [r, r, r], fill, outNormal, part, mark }]`
 * in emission order (mesh face order; a face's pieces in ring order). A ref is one corner, `{ p }` seated by `dz`,
 * plus where it comes from — `{ vi }` a mesh vertex, `{ a, b, s }` the crossing on edge a → b (a < b) at fraction
 * s, `{ bary: [[vi, w] ×3] }` a point inside the parent triangle by its corners' weights (where the highlight's line
 * crosses the step's), or `{ mix: [refs] }` the centroid of a ring (the never-seen numeric fallback) — so a caller
 * carrying per-vertex data (the rig pack's joints and weights) interpolates it the way the position was. The step:
 *   • a group in `light.unlit` keeps its base colour, is never split, and is a `mark` (a drawn feature — the eye
 *     lenses, the strokes, the mouth interior — so the outline hull skips it);
 *   • any other group steps on `light.thresholds[group] ?? light.threshold`: a corner is lit when N·L exceeds it;
 *     all lit → the base swatch, none lit → the shade swatch (`light.shade[group]`, else derivedShade of the base);
 *   • a straddling triangle splits along its iso-line into a lit piece and a shade piece;
 *   • THE HIGHLIGHT (`light.highlight[group]`, a third tone): the LIT side of a face is split again along a second
 *     iso-line, s = 0 of a scalar read at the face's corners (N·L against the rule's threshold, and the corner's REST
 *     position: u its height across the rule's band — a share of the head's height below the skull crown, bandFrame — so
 *     the band rides the head), the s > 0 side filled `palette['<group>Highlight']` else derivedHighlight of the base (a
 *     base too light for a lighter tone keeps one tone). `ring`: s = min(N·L − threshold, 1 − (u / w)²), w = cos(Δ)^(falloff
 *     / 2) with Δ the turn about the head's vertical axis from the key's azimuth (0 past a quarter turn): a crescent whose
 *     edges follow the position, smooth across a lock's facets; `streak`: s = N·L − threshold inside the band (|u| ≤ 1),
 *     else −1. Conforming like
 *     the step: its crossings on a face's edges (where the lit part of the edge meets s = 0) are registered on the edge,
 *     and where the two lines cross inside a triangle the point is a `bary` ref shared by the lit and the shade side;
 *   • THE NECK OCCLUSION RULE: on a mesh wearing the anime head (its face shell over a cranium core), every face of the
 *     part `neck` takes the shade swatch, never split — the neck under the head is always in the head's shadow, so the
 *     lit jaw reads against it at any key. On the structured core (a `pelvis` part), whose neck rises out of the chest
 *     (hero-form.js NECK_ROOT), the shadow is the JAW'S: a neck corner is in it above its lower edge (NECK_JAW_SHADOW: a
 *     V from the sides down toward the sternal notch; on the REST mesh, so it stays on the neck as the head turns) and
 *     under it the neck steps by N·L as any part, its edge a smooth line across the faces
 *     (whole, its shade's bottom was the neck's seam on the chest: a flat-bottomed block, a dark tube behind). Derived
 *     here, at read time (nothing stored, no palette group of its own), so the static faces and the rig pack, which
 *     share these pieces, agree;
 *   • THE HAIR'S TOP PLANES: on the same mesh, a Hair corner's N·L gains HAIR_TOP_PLANES × its normal's upward share
 *     (the planes on top of the mass lit from above too), derived the same way.
 * Colour is `palette[group]` → the part's tint → neutral grey (layeredFaces' lookup); a degenerate triangle (twice its
 * area ≤ 1e-14 once seated) has no piece. Every piece keeps its parent's winding and `outNormal` (the ink and the
 * winding read it). A face whose edge carries a neighbour's crossing point takes that point as a vertex (the
 * conforming rule), so a piece may be one of several triangles; an unsplit face whose edges carry none is the exact
 * parent triangle.
 * `normals`: per-face-corner normals (layeredShadingNormals); computed from the mesh alone when absent. `rest`: the rest
 * mesh (same topology) the highlight's band is read on; the mesh itself when absent. A light without `highlight` never
 * reads it, so its pieces are exactly the two-tone step's. `neckShade`, `hairTop`: the two anime-head rules, on by
 * default exactly when the mesh wears the anime head (a review renderer turns one off to show a figure without it).
 */
/** the jaw's shadow on the structured neck (THE NECK OCCLUSION RULE): its lower edge `front` (m) under the chin at the
 * front, `side` under it at the sides, between them by the cosine of the turn from the front: a V toward the sternal
 * notch, as the neck's front muscles carry the shade down to it (a band just under the chin hid behind the jaw: the
 * neck read lit); `k` the scalar's slope (per m), so the step's crossing falls on the line */
const NECK_JAW_SHADOW = Object.freeze({ front: 0.06, side: 0.03, k: 40 });
export function characterLitPieces(mesh, { light = ANIME_CHARACTER_LIGHT, normals = null, palette = null, dz = 0, rest = mesh, neckShade = wearsAnimeFace(null, mesh), hairTop = wearsAnimeFace(null, mesh), glows = null } = {}) {
  const N = normals || layeredShadingNormals(mesh);
  const pal = palette && typeof palette === 'object' ? palette : {};
  const glow = new Set(Array.isArray(glows) ? glows : []);   // the recipe's emissive groups: full-bright, never split (still inked)
  const Lv = light.toLight; const unlit = new Set(light.unlit || []); const thresholds = light.thresholds || {}; const t0 = Number.isFinite(light.threshold) ? light.threshold : 0;
  const neckInShade = !!neckShade, top = hairTop ? HAIR_TOP_PLANES : 0;   // THE NECK OCCLUSION RULE, THE HAIR'S TOP PLANES (see above)
  // the jaw line on the structured core's neck (rest positions): the neck's axis, the chin (the face shell's lowest
  // point in front of it), each neck corner's height over the line
  const jaw = neckInShade && rest.parts?.pelvis ? (() => {
    const nv = new Set(), fv = []; rest.faces.forEach((t, fi) => { const pn = partOf(rest, fi); if (pn === 'neck') t.forEach((v) => nv.add(v)); else if (pn === 'face') fv.push(...t); });
    if (!nv.size || !fv.length) return null;
    let ay = 0; for (const v of nv) ay += rest.vertices[v][1]; ay /= nv.size;
    let chin = Infinity; for (const v of fv) { const p = rest.vertices[v]; if (p[1] > ay) chin = Math.min(chin, p[2]); }
    if (!Number.isFinite(chin)) return null;
    return (vi) => { const p = rest.vertices[vi], fy = p[1] - ay, c = fy / (Math.hypot(p[0], fy) || 1); const J = NECK_JAW_SHADOW; return chin - (J.side + (J.front - J.side) * Math.max(0, c)) - p[2]; };
  })() : null;
  const VREF = mesh.vertices.map((v, vi) => ({ p: [v[0], v[1], v[2] + dz], vi }));
  const nV = mesh.vertices.length; const edges = new Map();   // min·nV + max → [{ s, p, a, b }] along min → max
  const shadeCache = new Map();
  // the highlight rules by group (only a light that has them reads the rest mesh)
  const HI = new Map();
  if (light.highlight && typeof light.highlight === 'object') for (const [g, R] of Object.entries(light.highlight)) {
    if (!R || typeof R !== 'object') continue;
    const frame = bandFrame(rest, g); if (!frame) continue;
    const [b0, b1] = R.band, zc = frame.top - frame.H * (b0 + b1) / 2, hw = frame.H * (b1 - b0) / 2;
    HI.set(g, { R, zc, hw, axis: frame.axis, key: dmath.atan2(Lv[0], Lv[1]), parts: R.parts ? HIGHLIGHT_PARTS_RE[R.parts] : null, colours: new Map() });
  }
  // the highlight's scalar at a corner: N·L `d` and its REST position `p`. The ring's edges come from the position alone —
  // the height across the band, its half-height narrowed by cos(Δ)^(falloff / 2), Δ the turn about the head's axis from
  // the key's azimuth (a crescent, widest facing the key, gone a quarter turn either side) — so an edge runs as a smooth
  // arc across a lock, never toothed by its facets' N·L, which only cuts it where N·L falls under the rule's threshold
  const hiOf = (H, d, p) => {
    const u = (p[2] - H.zc) / H.hw;
    if (H.R.kind === 'streak') return Math.abs(u) <= 1 ? d - H.R.threshold : -1;
    const turn = dmath.atan2(p[0] - H.axis[0], p[1] - H.axis[1]) - H.key, c = dmath.cos(turn), w = c > 0 ? dmath.pow(c, (H.R.falloff ?? 1) / 2) : 0;
    return w > 1e-6 ? Math.min(d - H.R.threshold, 1 - (u / w) ** 2) : -1;
  };
  // a crossing on edge u–v at d = t, computed along the canonical direction (lower index first) so both faces of a
  // shared edge get the bitwise-same point from the same corner values; registered unless it snaps to an end, and
  // MERGED with a point already registered within SNAP_M on the same edge (the other face's, across a crease)
  const crossing = (u, v, du, dv, t) => {
    const [a, b, da, db] = u < v ? [u, v, du, dv] : [v, u, dv, du];
    const s = clamp01((t - da) / (db - da)); const pa = VREF[a].p, pb = VREF[b].p; const el = dmath.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
    if (s * el <= SNAP_M) return VREF[a]; if ((1 - s) * el <= SNAP_M) return VREF[b];
    const key = a * nV + b; let list = edges.get(key); if (!list) edges.set(key, list = []);
    for (const e of list) if (Math.abs(e.s - s) * el <= SNAP_M) return e;
    const e = { s, p: [pa[0] + (pb[0] - pa[0]) * s, pa[1] + (pb[1] - pa[1]) * s, pa[2] + (pb[2] - pa[2]) * s], a, b };
    list.push(e); return e;
  };
  // a ref's barycentric weights over the face's corners `tri` (a vertex, a crossing on one of its edges, or a bary)
  const baryOf = (tri, r) => {
    if (r.bary) return tri.map((vi) => r.bary.find(([x]) => x === vi)?.[1] ?? 0);
    if (r.vi !== undefined) return tri.map((vi) => (vi === r.vi ? 1 : 0));
    return tri.map((vi) => (vi === r.a ? 1 - r.s : vi === r.b ? r.s : 0));
  };
  // pass 1: per face, its fill or its split (the crossing points registered on their edges); a highlit group's lit side
  // also registers its highlight crossings and, when its line crosses the step's, the point where they meet
  const perFace = mesh.faces.map((tri, fi) => {
    const [p0, p1, p2] = tri.map((vi) => VREF[vi].p);
    const n = cross(sub(p1, p0), sub(p2, p0)); const l = len(n);
    if (!(l > 1e-14)) return null;   // a degenerate triangle has no face
    const outNormal = [n[0] / l, n[1] / l, n[2] / l];
    const partName = partOf(mesh, fi); const part = mesh.parts[partName]; const g = mesh.groups[fi];
    const hex = pal[g] || part?.tint || FALLBACK;
    if (unlit.has(g)) return { fi, tri, outNormal, partName, fill: hex, mark: true };
    if (glow.has(g)) return { fi, tri, outNormal, partName, fill: hex };
    const sk = `${g}|${hex}`; let shade = shadeCache.get(sk); if (shade === undefined) shadeCache.set(sk, shade = shadeFill(light, g, hex));
    const jawNeck = neckInShade && partName === 'neck' && jaw;
    if (neckInShade && partName === 'neck' && !jaw) return { fi, tri, outNormal, partName, fill: shade };   // the occlusion rule
    const t = Number.isFinite(thresholds[g]) ? thresholds[g] : t0;
    // the top planes' term only where it applies: every other corner keeps N·L as it was (no `+ 0`, which would turn a −0 to +0)
    const topLift = top && g === 'Hair', d0 = N[fi].map((c) => (topLift && c[2] > 0 ? dot(c, Lv) + top * c[2] : dot(c, Lv)));
    // the structured neck: in the jaw's shadow above its line, by N·L under it
    const d = jawNeck ? d0.map((x, j) => Math.min(x, t + NECK_JAW_SHADOW.k * jaw(tri[j]))) : d0; const lit = d.map((x) => x > t);
    const H = HI.get(g); let hi = H && lit.some(Boolean) && !(H.parts && !H.parts.test(partName)) ? H : null, colour = null;
    if (hi) { colour = H.colours.get(hex); if (colour === undefined) H.colours.set(hex, colour = pal[`${g}Highlight`] || derivedHighlight(hex)); if (!colour) hi = null; }   // no lighter tone: one tone
    let f;
    if (lit[0] === lit[1] && lit[1] === lit[2]) f = { fi, tri, outNormal, partName, fill: lit[0] ? hex : shade };
    else {
      const k = lit[0] === lit[1] ? 2 : lit[0] === lit[2] ? 1 : 0;   // the odd corner
      const A = tri[k], B = tri[(k + 1) % 3], C = tri[(k + 2) % 3];
      f = { fi, tri, outNormal, partName, k, lit, P: crossing(A, B, d[k], d[(k + 1) % 3], t), Q: crossing(A, C, d[k], d[(k + 2) % 3], t), fills: lit[k] ? [hex, shade] : [shade, hex] };
    }
    if (!hi) return f;
    // the highlight: its scalar at the corners (the rest position rides the head), its crossings on the lit part of each
    // edge, and the point where its line meets the step's chord
    const sv = tri.map((vi, j) => hiOf(H, d[j], rest.vertices[vi]));
    const E = [];
    for (let j = 0; j < 3; j++) {
      const u = tri[j], v = tri[(j + 1) % 3], su = sv[j], sw = sv[(j + 1) % 3];
      if ((su > 0) === (sw > 0)) continue;
      const lam = su / (su - sw), dl = d[j] + (d[(j + 1) % 3] - d[j]) * lam;
      if (dl > t) E.push(crossing(u, v, su, sw, 0));
    }
    let X = null;
    if (f.P) {
      const wP = baryOf(tri, f.P), wQ = baryOf(tri, f.Q), sP = wP[0] * sv[0] + wP[1] * sv[1] + wP[2] * sv[2], sQ = wQ[0] * sv[0] + wQ[1] * sv[1] + wQ[2] * sv[2];
      if (f.P !== f.Q && (sP > 0) !== (sQ > 0)) {
        const mu = sP / (sP - sQ), cl = len(sub(f.Q.p, f.P.p));
        if (mu * cl <= SNAP_M) X = f.P; else if ((1 - mu) * cl <= SNAP_M) X = f.Q;
        else { const w = wP.map((x, j) => x + (wQ[j] - x) * mu), bary = tri.map((vi, j) => [vi, w[j]]); X = { p: baryPoint(mesh.vertices, bary, dz), bary }; }
      }
    }
    return { ...f, hi: { sv, E, X, colour, hex } };
  });
  for (const list of edges.values()) list.sort((x, y) => x.s - y.s);
  // the boundary ring of a face from corner `start`: each corner, then the registered points on its outgoing edge
  const ringOf = (tri, start) => {
    const R = [];
    for (let j = 0; j < 3; j++) {
      const u = tri[(start + j) % 3], v = tri[(start + j + 1) % 3]; R.push(VREF[u]);
      const list = edges.get(Math.min(u, v) * nV + Math.max(u, v)); if (list) R.push(...(u < v ? list : [...list].reverse()));
    }
    return R;
  };
  // pass 2: emit — the plain triangle when nothing touches it, else the conforming pieces
  const pieces = [];
  const emit = (tris, fill, f) => { for (const T of tris) pieces.push({ fi: f.fi, refs: T, fill, outNormal: f.outNormal, part: f.partName, mark: f.mark === true }); };
  // a lit ring of a highlit face: split on the highlight's line at its two crossings on the ring (its edge points, the
  // chord point), the s > 0 side in the highlight; one side with no area, or a line that misses, fills the whole ring by
  // the sign of s at its vertex centroid (s is linear across the face)
  const litRing = (Lp, f) => {
    const { sv, E, X, colour, hex } = f.hi;
    const sOf = (ring) => { let acc = 0; for (const r of ring) { const w = baryOf(f.tri, r); acc += w[0] * sv[0] + w[1] * sv[1] + w[2] * sv[2]; } return acc / ring.length; };
    const cut = [...new Set([...E, ...(X ? [X] : [])])].filter((r) => Lp.includes(r));
    if (cut.length === 2) {
      const i1 = Lp.indexOf(cut[0]), i2 = Lp.indexOf(cut[1]), [a, b] = i1 < i2 ? [i1, i2] : [i2, i1];
      const one = Lp.slice(a, b + 1), two = [...Lp.slice(b), ...Lp.slice(0, a + 1)];
      if (ringArea2(one, f.outNormal) > AREA2 && ringArea2(two, f.outNormal) > AREA2) {
        const s1 = sOf(one) > 0;
        emit(triangulate(one, f.outNormal), s1 ? colour : hex, f); emit(triangulate(two, f.outNormal), s1 ? hex : colour, f);
        return;
      }
    }
    emit(Lp.length === 3 ? [Lp] : triangulate(Lp, f.outNormal), sOf(Lp) > 0 ? colour : hex, f);
  };
  for (const f of perFace) {
    if (!f) continue;
    if (f.fills === undefined) {
      const R = ringOf(f.tri, 0);
      if (f.hi) litRing(R, f);
      else emit(R.length === 3 ? [R] : triangulate(R, f.outNormal), f.fill, f);
      continue;
    }
    // split: the ring from the odd corner A; its side runs Q → A → P, the other P → B → C → Q (both close on the chord)
    const R = ringOf(f.tri, f.k); const iP = R.indexOf(f.P), iQ = R.indexOf(f.Q);
    const cyc = (i, j) => { const o = []; for (let x = i; ; x = (x + 1) % R.length) { o.push(R[x]); if (x === j) break; } return o; };
    const sideA = iP === iQ ? [] : cyc(iQ, iP), sideB = iP === iQ ? R : cyc(iP, iQ);
    // a side with no area (the line grazes a corner or runs along an edge) gives the whole ring to the other side
    const noA = !(ringArea2(sideA, f.outNormal) > AREA2), noB = !noA && !(ringArea2(sideB, f.outNormal) > AREA2);
    if (!f.hi) {
      if (noA) { emit(triangulate(R, f.outNormal), f.fills[1], f); continue; }
      if (noB) { emit(triangulate(R, f.outNormal), f.fills[0], f); continue; }
      emit(triangulate(sideA, f.outNormal), f.fills[0], f);
      emit(triangulate(sideB, f.outNormal), f.fills[1], f);
      continue;
    }
    // highlit: the chord takes the point where the highlight's line meets it (on both sides), then the lit side splits
    const litA = f.lit[f.k], X = f.hi.X && f.hi.X !== f.P && f.hi.X !== f.Q ? f.hi.X : null;
    const A2 = X ? [...sideA, X] : sideA, B2 = X ? [...sideB, X] : sideB;
    const side = (ring, isLit) => { if (isLit) litRing(ring, f); else emit(triangulate(ring, f.outNormal), f.fills[isLit === litA ? 0 : 1], f); };
    if (noA) { side(R, !litA); continue; }
    if (noB) { side(R, litA); continue; }
    side(A2, litA); side(B2, !litA);
  }
  return pieces;
}

/**
 * The same pieces with every corner re-placed on another pose of the same mesh (`mesh`: same topology, e.g. the rest
 * mesh under a posed one), seated by `dz`: a vertex ref takes that vertex, an edge crossing the same fraction along
 * the same edge, a point inside a triangle the same weights of its corners, a ring centroid the centroid of its re-placed
 * ring. Fills, parts, marks and the parent's outNormal
 * are kept, so the step and the split decided on a POSED mesh (the stand) ride the BIND pose the rig pack skins from.
 * Refs stay shared (one new ref per old one), so a caller keyed on ref identity still sees each corner once.
 */
export function piecesAt(pieces, mesh, dz = 0) {
  const V = mesh.vertices; const moved = new Map();
  const at = (r) => {
    let m = moved.get(r); if (m) return m;
    if (r.vi !== undefined) { const v = V[r.vi]; m = { p: [v[0], v[1], v[2] + dz], vi: r.vi }; }
    else if (r.bary) m = { p: baryPoint(V, r.bary, dz), bary: r.bary };
    else if (r.mix) { const mix = r.mix.map(at); m = { p: mix.reduce((s, x) => [s[0] + x.p[0] / mix.length, s[1] + x.p[1] / mix.length, s[2] + x.p[2] / mix.length], [0, 0, 0]), mix }; }
    else {   // characterLitPieces' own arithmetic (seated ends, then the lerp), so re-placing on the same mesh is exact
      const pa = [V[r.a][0], V[r.a][1], V[r.a][2] + dz], pb = [V[r.b][0], V[r.b][1], V[r.b][2] + dz];
      m = { s: r.s, p: [pa[0] + (pb[0] - pa[0]) * r.s, pa[1] + (pb[1] - pa[1]) * r.s, pa[2] + (pb[2] - pa[2]) * r.s], a: r.a, b: r.b };
    }
    moved.set(r, m); return m;
  };
  return pieces.map((pc) => ({ ...pc, refs: pc.refs.map(at) }));
}

/**
 * The compiled mesh as studio faces `{ corners, fill, group, outNormal, noInk?, layer? }` under the character light —
 * the same face contract as layeredFaces (seat, render group, palette → part tint → neutral grey, degenerate triangles
 * dropped), with the step in place of the Lambert shade: characterLitPieces, one face per piece. A mark (an unlit
 * group) carries `noInk: true`: the World's outline hull and the GLB's baked ink leave the drawn features alone. A face
 * with a DRAW LAYER (drawLayer below: the brows and lids drawn through the fringe, the fringe that veils them, and — with
 * `hairInk`, the character ink on — every other hair face) carries `layer`, only then: the World page splits each
 * render group by it and draws the layers with the stencil rules (channels/draw-layers.js).
 * `pieces`: characterLitPieces built at this mesh's seat (`layeredSeat(mesh, seat)`), shared with the rig pack;
 * built here when absent. `normals`: per-face-corner normals (layeredShadingNormals); computed when absent.
 */
export function characterLitFaces(mesh, recipe = {}, { light = ANIME_CHARACTER_LIGHT, normals = null, seat = true, group = null, pieces = null, hairInk = false } = {}) {
  const P = pieces || characterLitPieces(mesh, { light, normals: normals || layeredShadingNormals(mesh, recipe), palette: recipe.palette, dz: layeredSeat(mesh, seat), glows: recipe.emissive });
  return P.map((c) => { const layer = drawLayer(mesh, c, { hairInk }); return { corners: c.refs.map((r) => [r.p[0], r.p[1], r.p[2]]), fill: c.fill, group: group || c.part, outNormal: [...c.outNormal], ...(c.mark ? { noInk: true } : {}), ...(layer ? { layer } : {}) }; });
}

// ─── the draw layers ──────────────────────────────────────────────────────
/**
 * The DRAW LAYER of a piece (`{ fi, part }`: its parent face and part) on a compiled layered mesh, or null:
 *   'through' — a part flagged `through` (the graphic face's brows and lid bands, anime-head): drawn after everything
 *               else at its depth, so it shows through the part that veils it;
 *   'veil'    — a part flagged `veil` (the fringe's sections): drawn last, never over a pixel a `through` part took;
 *   'hair'    — with `hairInk` (the character ink on), any other face of the Hair palette group: its outline never draws
 *               over hair (a lock's line stops where it meets another lock, and stays where it meets the face).
 * A veil is hair too: its outline follows the hair rule as well. Everything else has no layer.
 */
export function drawLayer(mesh, { fi, part }, { hairInk = false } = {}) {
  const P = mesh.parts?.[part];
  if (P?.through) return 'through';
  if (P?.veil) return 'veil';
  return hairInk && mesh.groups[fi] === 'Hair' ? 'hair' : null;
}

// ─── the character ink ────────────────────────────────────────────────────
/** The outline width a character-lit figure wears by default, as a fraction of its height (≈ 2.4 mm on a 1.6 m
 * figure: what the per-part render groups drew under the radius rule before the rig merged them into one). */
export const CHARACTER_INK_WIDTH = 0.0015;

/**
 * The toon ink a character-lit figure wears: the SILHOUETTE only — the inverted hull, no crease or boundary lines
 * (`lines: false`: the crease census would ink the facets of the lenses and the open edges of the locks and the
 * split) — at an ABSOLUTE width of CHARACTER_INK_WIDTH × `height`, so a figure merged into one render group (the
 * rigged hero) and one split into many draw the same line. `ink` is the manifest's resolved `toon.ink` (`true`, a
 * tuning object, or absent: all mean on; its own fields win, and an authored `width` or `widthAbs` replaces the
 * height rule); `false` → null (no ink). Pure: `{ lines, widthAbs?, …own }`.
 */
export function characterInk(ink, height) {
  if (ink === false) return null;
  const own = ink && typeof ink === 'object' ? ink : {};
  const sized = Number.isFinite(own.width) || Number.isFinite(own.widthAbs);
  return { lines: false, ...(sized || !(height > 0) ? {} : { widthAbs: Math.round(CHARACTER_INK_WIDTH * height * 1e5) / 1e5 }), ...own };
}
