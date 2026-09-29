/**
 * vexar — directional Lambert surface-lighting primitive.
 *
 * ★ DEFAULT lighting for curved-surface / sticker rendering in this codebase.
 *   New tessellated-surface work shades through vexar's shadeHex unless a spike
 *   is specifically demonstrating an alternative (imperfect-cel / field-cel for
 *   the stylized cel look). Chosen for the smooth, matte "lit object" read that
 *   the per-normal-on-dense-parametric-surface approach gives on compound forms.
 *
 * The minimal, correct diffuse lighting used across the curved-sticker vehicles
 * (fuselage / train cab / sedan / torus / duck): scale a flat fill by the cosine
 * of the angle between a surface's OUTWARD NORMAL and the light, with an ambient
 * floor so faces turned away from the light don't go black.
 *
 * Why it's a primitive worth naming:
 *   - Purely LOCAL — one dot product per face/cell, no neighbours, no scene.
 *     Topology-blind: it lights a convex hull, a swept superellipse, and a torus
 *     by the same rule. (Verified on the torus stress spike — lighting held; only
 *     compositing needed care.)
 *   - Resolution-independent — works per-cell at any tessellation density.
 *   - Geometry→light bridge included: Newell face normal + outward orientation,
 *     so a caller with world-space face corners gets a lit fill in one call.
 *
 * What vexar deliberately is NOT:
 *   - Not field-cel: no tonal banding, contour darkening, gravity/contact shadow,
 *     or gradients. field-cel.js is the stylized pipeline; vexar is the bare
 *     cosine term it (and everything else) is built on.
 *   - Not a visibility solver: it answers "how lit is this face?", never "is this
 *     face visible / shadowed?". Pair it with back-face culling + a depth policy.
 *     No self-shadowing (a torus hole won't get a cast shadow).
 */

export const VEXAR_VERSION = 'vexar-v0.1.0';

// ---- vector math (exported: lighting needs them, callers reuse them) -------
export function norm3(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function sub3(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function centroid(pts) {
  const n = pts.length || 1;
  return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n, pts.reduce((a, p) => a + p[2], 0) / n];
}

// ---- normals: the geometry→light bridge ------------------------------------
/** Newell's-method normal of a planar-ish polygon (3+ world points). Robust to
 *  non-planar quads. Sign follows vertex winding — orient with orientOutward. */
export function newellNormal(pts) {
  const n = [0, 0, 0];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm3(n);
}
/** Flip `normal` so it points AWAY from `inside` (a spine/axis point the surface
 *  wraps around) — turns a winding-dependent normal into a true outward normal. */
export function orientOutward(normal, faceCentroid, inside) {
  return dot3(normal, sub3(faceCentroid, inside)) >= 0 ? normal : [-normal[0], -normal[1], -normal[2]];
}

// ---- color -----------------------------------------------------------------
export function hexToRgb(h) { const s = h.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
export function rgbToHex(r) { const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'); return `#${c(r[0])}${c(r[1])}${c(r[2])}`; }
export function scaleHex(hex, f) { return rgbToHex(hexToRgb(hex).map((v) => v * f)); }

// ---- the light + the shade -------------------------------------------------
/** A light. `direction` is the way the light travels (normalized); `ambient` is
 *  the floor brightness for fully-turned-away faces; `diffuse` is the range
 *  added as a face turns to meet the light. Brightness ∈ [ambient, ambient+diffuse].
 *
 *  Optional `fill` = { diffuse, direction? } adds a soft SECONDARY light that lifts
 *  the faces the key leaves at ambient. With no `direction` the fill sits OPPOSITE the
 *  key (its toLight = the key's travel direction), so it illuminates exactly the key's
 *  shadow hemisphere — a form-study key+fill that keeps flat, camera-facing surfaces off
 *  the near-black ambient floor (a single directional key renders any face perpendicular
 *  to it at ambient only, which reads as "no surface"). Absent → single-key output is
 *  byte-identical, so only opted-in lights (the workbench studio) change. */
export function makeLight({ direction = [0.4, 0.5, -0.76], ambient = 0.46, diffuse = 0.6, fill = null, bands = null } = {}) {
  const d = norm3(direction);
  const light = { dir: d, toLight: [-d[0], -d[1], -d[2]], ambient, diffuse };
  // toon dial (see withBands): only a finite count ≥ 2 lands on the light, so the default
  // object is unchanged and every deep-equality on it holds.
  if (Number.isFinite(bands) && bands >= 2) light.bands = Math.floor(bands);
  if (fill && Number.isFinite(fill.diffuse) && fill.diffuse > 0) {
    const fd = fill.direction ? norm3(fill.direction) : null;
    light.fillToLight = fd ? [-fd[0], -fd[1], -fd[2]] : [d[0], d[1], d[2]];
    light.fillDiffuse = fill.diffuse;
  }
  return light;
}
export const DEFAULT_LIGHT = makeLight();
// FLAT_LIGHT — the UNSHADED (flat-albedo) light. ambient 1 + diffuse 0 ⇒ litFactor ≡ 1
// for EVERY normal (see litFactor below), so shadeHex/shadeFace return the base albedo
// UNCHANGED — no Lambert directional term, no ambient darkening. This is the mechanism
// behind the opt-in unshaded export mode (resolveWorldScene({ unshaded:true })): a GLB
// carrying raw albedo as a clean base for external GI baking (Blender). Purely additive:
// only a caller that threads this light in place of a directional key changes output.
//
// `flat: true` is a hard marker read by shadeHex/shadeHexMat: under FLAT_LIGHT they
// return the base albedo for EVERY face, INCLUDING material faces. A material's own
// ambient/diffuse would otherwise override the light (see shadeHexMat) and keep a
// NORMAL-DEPENDENT term alive — which, on mirror-built parts (flipped normals), bakes
// asymmetric (one side dark). The flat marker drops that term so unshaded truly emits
// raw albedo, mirror-symmetric, regardless of normal orientation.
export const FLAT_LIGHT = { ...makeLight({ ambient: 1, diffuse: 0 }), flat: true };

// ---- LOD: sustainable-by-default tessellation, tweakable upward ------------
// vexar surfaces read smooth from SHADING, not polygon count — so the default
// mesh is deliberately coarse (sustainable file size). A surface scales its base
// cell counts by vexarLod(quality): pass a named level, or a raw factor for hero
// close-ups. The LOD study (city bus) showed 80×56 ≈ indistinguishable from
// 150×120 at a third the bytes — see vehicle-smooth-box-net.plan.md.
export const VEXAR_QUALITY = { draft: 0.6, default: 1.0, hero: 1.8, ultra: 2.6 };
export function vexarLod(quality = 'default') {
  if (typeof quality === 'number' && Number.isFinite(quality)) return Math.max(0.25, quality);
  return VEXAR_QUALITY[quality] ?? VEXAR_QUALITY.default;
}
/** Scale a base cell count by quality, floored so 'draft' stays legible. */
export function lodCount(base, quality = 'default', floor = 8) {
  return Math.max(floor, Math.round(base * vexarLod(quality)));
}

// ---- toon bands (the toon-shading dial) -------------------------------------
/** Quantize a Lambert factor `f` in [ambient, ambient + range] into `bands` TONES (3 → lit /
 *  mid / shadow): the normalized brightness snaps to round(t·(bands−1))/(bands−1). Tone
 *  semantics, deliberately: `material.cel` (shadeHexMat) predates this and counts STEPS of the
 *  key term, and a material's own `cel` wins over the light's bands. bands < 2 or a zero range
 *  → f unchanged. The FINAL factor is banded (key + fill together) so the shadow hemisphere
 *  steps too; gravity darkening, lamps and traced diffusion compose on top, continuous. */
export function bandFactor(f, ambient, range, bands) {
  const n = Math.floor(bands) - 1;
  if (!(n >= 1) || !(range > 0)) return f;
  const t = Math.min(1, Math.max(0, (f - ambient) / range));
  return ambient + range * (Math.round(t * n) / n);
}
/** A copy of `light` carrying `bands` — the input light is untouched. FLAT_LIGHT stays flat
 *  (raw albedo has no tones to band, so an unshaded export ignores the dial); bands < 2 or
 *  absent → the SAME light object back, so every existing caller stays byte-identical. */
export function withBands(light, bands) {
  if (!light || light.flat || !(Number.isFinite(bands) && bands >= 2)) return light;
  return { ...light, bands: Math.floor(bands) };
}

/** The toon dial as authored on a manifest, normalized: `true` → { bands: 3, ink: true };
 *  `{ bands?, ink?, bake? }` → the same shape with a finite bands ≥ 2 (or none), ink `true` or its
 *  tuning object, and `bake: true` carried through ONLY when ink is on (shader-look phase 3: the GLB
 *  export bakes the ink pair as real geometry; bake reads the ink tuning, so bake without ink is
 *  meaningless and dropped). Anything else → null. Shared by the world resolver, the still renderers
 *  and the mint tools so one spelling is accepted everywhere.
 *  `{ light: true }` (the LAYERED kind's readers only — its resolver, its door, the world resolver for a
 *  layered row) also reads `toon.light`, the CHARACTER LIGHT (resolveToonLight): a valid one rides
 *  through normalized, `false` rides through as the explicit opt-out, an invalid one is dropped — and a
 *  light alone is a dial (`{ light }`), since the step shades without bands or ink. Every other caller
 *  never sees the field, so a toon returns exactly what it did before the channel existed. */
export function resolveToon(t, { light: withLight = false } = {}) {
  if (t === true) return { bands: 3, ink: true };
  if (!t || typeof t !== 'object') return null;
  const bands = Number.isFinite(t.bands) && t.bands >= 2 ? Math.floor(t.bands) : null;
  const ink = t.ink === true ? true : (t.ink && typeof t.ink === 'object' ? t.ink : null);
  const light = !withLight ? null : t.light === false ? false : resolveToonLight(t.light);
  if (bands == null && !ink && light == null) return null;
  return { ...(bands != null ? { bands } : {}), ...(ink ? { ink } : {}), ...(ink && t.bake === true ? { bake: true } : {}), ...(light != null ? { light } : {}) };
}

// ---- the character light (toon.light) ---------------------------------------
// One light per character, in CHARACTER space (+y front, +z up, so it turns with the figure): a
// two-tone STEP on three inputs — the light vector, a threshold on N·L and the shading normal — with
// a chosen shade swatch per palette group, never a Lambert gradient. Baked by the layered kind
// (station-loft-shade.js); every field is optional and the defaults are the key below.
/** the default key: from the front, above and the figure's RIGHT (+x; the rig's `R` side), about 32° up and 31° to the
 *  side (unit([0.45, 0.75, 0.55])) — the three-quarter key, on the side the World's head and three-quarter cameras
 *  stand, so the broad cheek toward the camera is the lit one */
const CHARACTER_KEY = [0.45, 0.75, 0.55];
/** groups drawn at their base colour by default: the eye lenses, the ink strokes, the mouth interior */
export const CHARACTER_LIGHT_UNLIT = Object.freeze(['Iris', 'Pupil', 'Sclera', 'Ink', 'Mouth']);
/** per-group thresholds by default: hair steps higher, so the locks read as a few lit shapes rather than one lit dome
 *  (at 0.40 about three quarters of the hair is lit at the three-quarter view, with shade shapes under the locks) */
const CHARACTER_THRESHOLDS = Object.freeze({ Hair: 0.40 });
const TOON_LIGHT_KEYS = ['toLight', 'threshold', 'thresholds', 'shade', 'unlit', 'highlight'];
/** the HIGHLIGHT (a third tone on a group's lit side, split crisply on a second iso-line; station-loft-shade.js): its
 *  kinds and each kind's defaults — `ring`: N·L above `threshold` less `falloff`·u², u the height across the `band` (a
 *  share of the head's height below the skull crown), so a band on the lit side broken where the locks turn away (the
 *  sheen line on the hair); `streak`: N·L above `threshold` inside the band only (a hard window). `parts: 'fringe'` keeps
 *  it to the fringe's locks and sections. */
export const HIGHLIGHT_KINDS = Object.freeze({
  ring: Object.freeze({ threshold: 0.3, band: Object.freeze([0.14, 0.22]), falloff: 1.4 }),
  streak: Object.freeze({ threshold: 0.5, band: Object.freeze([0, 0.4]) }),
});
const HIGHLIGHT_KEYS = ['kind', 'threshold', 'band', 'falloff', 'parts'];
const HIGHLIGHT_PARTS = ['fringe'];
const isPlain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const inStep = (v) => Number.isFinite(v) && v >= -1 && v <= 1;

/** Error strings for an authored `toon.light` (empty = valid). `undefined` / `null` (absent), `true` (the
 *  default key) and `false` (off) are valid; otherwise an object of the six fields (`highlight` a map of palette groups to a rule or false). */
export function toonLightErrors(l) {
  if (l === undefined || l === null || l === true || l === false) return [];
  if (!isPlain(l)) return ['toon.light: true (the default character light), false (off), or { toLight, threshold, thresholds, shade, unlit, highlight }'];
  const errs = [];
  for (const k of Object.keys(l)) if (!TOON_LIGHT_KEYS.includes(k)) errs.push(`toon.light.${k}: not a light field (have ${TOON_LIGHT_KEYS.join(', ')})`);
  if (l.toLight !== undefined && !(Array.isArray(l.toLight) && l.toLight.length === 3 && l.toLight.every(Number.isFinite) && Math.hypot(l.toLight[0], l.toLight[1], l.toLight[2]) > 1e-9)) {
    errs.push('toon.light.toLight: [x, y, z] pointing TOWARD the light in character space (+y front, +z up), not zero');
  }
  if (l.threshold !== undefined && !inStep(l.threshold)) errs.push('toon.light.threshold: the N·L step, a number in [-1, 1]');
  if (l.thresholds !== undefined) {
    if (!isPlain(l.thresholds)) errs.push('toon.light.thresholds: { <palette group>: a number in [-1, 1] }');
    else for (const [g, v] of Object.entries(l.thresholds)) if (!inStep(v)) errs.push(`toon.light.thresholds.${g}: a number in [-1, 1]`);
  }
  if (l.shade !== undefined) {
    if (!isPlain(l.shade)) errs.push('toon.light.shade: { <palette group>: "#rrggbb" } (the shade swatch; absent groups derive theirs from the base)');
    else for (const [g, v] of Object.entries(l.shade)) if (!(typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v))) errs.push(`toon.light.shade.${g}: a "#rrggbb" colour`);
  }
  if (l.unlit !== undefined && !(Array.isArray(l.unlit) && l.unlit.every((g) => typeof g === 'string' && g.length > 0))) errs.push('toon.light.unlit: a list of palette groups drawn at their base colour');
  if (l.highlight !== undefined && l.highlight !== false) {
    if (!isPlain(l.highlight)) errs.push(`toon.light.highlight: { <palette group>: { kind: ${Object.keys(HIGHLIGHT_KINDS).join(' | ')}, threshold?, band?, falloff?, parts? } | false }, or false (none)`);
    else for (const [g, h] of Object.entries(l.highlight)) {
      if (h === false) continue;
      const at = `toon.light.highlight.${g}`;
      if (!isPlain(h)) { errs.push(`${at}: { kind: ${Object.keys(HIGHLIGHT_KINDS).join(' | ')}, threshold?, band?, falloff?, parts? } or false`); continue; }
      for (const k of Object.keys(h)) if (!HIGHLIGHT_KEYS.includes(k)) errs.push(`${at}.${k}: not a highlight field (have ${HIGHLIGHT_KEYS.join(', ')})`);
      if (!HIGHLIGHT_KINDS[h.kind]) errs.push(`${at}.kind: ${Object.keys(HIGHLIGHT_KINDS).join(' | ')}`);
      if (h.threshold !== undefined && !inStep(h.threshold)) errs.push(`${at}.threshold: the N·L step, a number in [-1, 1]`);
      if (h.band !== undefined && !(Array.isArray(h.band) && h.band.length === 2 && h.band.every((x) => Number.isFinite(x) && x >= 0 && x <= 1) && h.band[1] > h.band[0])) errs.push(`${at}.band: [from, to], shares of the head's height below the skull crown, 0 ≤ from < to ≤ 1`);
      if (h.falloff !== undefined && !(Number.isFinite(h.falloff) && h.falloff >= 0 && h.falloff <= 10)) errs.push(`${at}.falloff: a number in [0, 10] (how fast a ring fades off its band's centre)`);
      if (h.parts !== undefined && !HIGHLIGHT_PARTS.includes(h.parts)) errs.push(`${at}.parts: ${HIGHLIGHT_PARTS.join(' | ')} (absent: every part of the group)`);
    }
  }
  return errs;
}
/** An authored highlight map normalized: each group's rule over its kind's defaults (`band` copied); `false` rides
 *  through (none, over a default); anything invalid is dropped by the caller's errors check. */
function resolveHighlight(h) {
  if (h === false) return false;
  return Object.fromEntries(Object.entries(h).map(([g, r]) => [g, r === false ? false : { kind: r.kind, ...HIGHLIGHT_KINDS[r.kind], ...r, band: [...(r.band ?? HIGHLIGHT_KINDS[r.kind].band)] }]));
}

/** An authored `toon.light` normalized: `true` → the default light; a valid object → the defaults with its fields
 *  on top (`toLight` unit length; `thresholds` merged over the Hair default; `unlit` replaces the default list; a
 *  `highlight` over its kinds' defaults, present only when authored); anything else (absent, `false`, invalid) → null.
 *  The result is a fresh object: `{ toLight, threshold, thresholds, shade, unlit, highlight? }`. */
export function resolveToonLight(l) {
  if (l !== true && !isPlain(l)) return null;
  if (toonLightErrors(l).length) return null;
  const o = l === true ? {} : l;
  return {
    toLight: norm3(o.toLight ?? CHARACTER_KEY),
    threshold: o.threshold ?? 0,
    thresholds: { ...CHARACTER_THRESHOLDS, ...(o.thresholds || {}) },
    shade: { ...(o.shade || {}) },
    unlit: [...(o.unlit ?? CHARACTER_LIGHT_UNLIT)],
    ...(o.highlight !== undefined ? { highlight: resolveHighlight(o.highlight) } : {}),
  };
}

/** Lambert brightness for an outward normal under a light (+ optional opposite fill). */
export function litFactor(normal, light = DEFAULT_LIGHT) {
  let f = light.ambient + light.diffuse * Math.max(0, dot3(normal, light.toLight));
  if (light.fillDiffuse) f += light.fillDiffuse * Math.max(0, dot3(normal, light.fillToLight));
  return light.bands ? bandFactor(f, light.ambient, light.diffuse + (light.fillDiffuse || 0), light.bands) : f;
}
/** Scale a flat fill by the Lambert factor — the per-cell shade. */
export function shadeHex(hex, normal, light = DEFAULT_LIGHT) {
  if (light.flat) return hex; // FLAT_LIGHT: raw albedo, no directional term
  return scaleHex(hex, litFactor(normal, light));
}
/**
 * One-call surface shade: from a face's world `corners` + base `hex`, compute the
 * outward normal (Newell, oriented away from `inside` if given) and return the lit
 * fill plus the normal (for the caller's back-face cull).
 * @returns {{ fill:string, normal:number[] }}
 */
export function shadeFace(corners, hex, { light = DEFAULT_LIGHT, inside = null } = {}) {
  let normal = newellNormal(corners);
  if (inside) normal = orientOutward(normal, centroid(corners), inside);
  return { fill: shadeHex(hex, normal, light), normal };
}

// ---- material response (material-response.plan.md) --------------------------
// A material is a RESPONSE CURVE row from polygonizer/materials.js: { ambient,
// diffuse, specular?, shininess?, emissive?, cel? }. vexar consumes the row but
// deliberately does not import the shelf — data flows in, keeping this module
// dependency-free. Promoted from carved-solid's matRgb (same math, parity-tested).

/**
 * Material-aware shade. `material` null/absent → EXACT shadeHex path (byte-equal,
 * the opt-in identity every baked channel holds). With a material: Lambert with
 * the row's own ambient/diffuse (falling back to the light's), optional `cel`
 * band quantization, optional `emissive` blend toward the unlit albedo — all
 * camera-independent. The Blinn-Phong `specular` highlight is added ONLY when
 * the caller passes BOTH `viewFrom` (camera position) and `at` (surface point):
 * passing them declares a fixed-camera render (carved-solid's hero shot, a
 * single-camera SVG study). Faces bound for the camera-independent face payload
 * must omit them.
 */
export function shadeHexMat(hex, normal, material, { light = DEFAULT_LIGHT, viewFrom = null, at = null } = {}) {
  if (light.flat) return hex; // FLAT_LIGHT: raw albedo — skip the material's normal-dependent response
  if (!material) return shadeHex(hex, normal, light);
  let lam = Math.max(0, dot3(normal, light.toLight));
  if (material.cel) lam = Math.round(lam * material.cel) / material.cel;
  let f = (material.ambient ?? light.ambient) + (material.diffuse ?? light.diffuse) * lam;
  if (light.fillDiffuse) f += light.fillDiffuse * Math.max(0, dot3(normal, light.fillToLight));
  // the light's toon bands apply unless the material bands its own key term (`cel` wins)
  if (light.bands && !material.cel) f = bandFactor(f, material.ambient ?? light.ambient, (material.diffuse ?? light.diffuse) + (light.fillDiffuse || 0), light.bands);
  const base = hexToRgb(hex);
  let rgb = base.map((v) => v * f);
  if (material.specular && viewFrom && at) {
    const toView = norm3(sub3(viewFrom, at));
    const half = norm3([light.toLight[0] + toView[0], light.toLight[1] + toView[1], light.toLight[2] + toView[2]]);
    const s = material.specular * Math.pow(Math.max(0, dot3(normal, half)), material.shininess || 16);
    rgb = rgb.map((v) => v + 255 * s);
  }
  if (material.emissive) rgb = rgb.map((v, i) => v * (1 - material.emissive) + base[i] * material.emissive);
  return rgbToHex(rgb);
}

/**
 * Material-aware shadeFace: same normal bridge, material-aware fill. The face
 * centroid doubles as the specular `at` point when `viewFrom` is given.
 * @returns {{ fill:string, normal:number[] }}
 */
export function shadeFaceMat(corners, hex, material, { light = DEFAULT_LIGHT, inside = null, viewFrom = null } = {}) {
  let normal = newellNormal(corners);
  const c = centroid(corners);
  if (inside) normal = orientOutward(normal, c, inside);
  return { fill: shadeHexMat(hex, normal, material, { light, viewFrom, at: viewFrom ? c : null }), normal };
}
