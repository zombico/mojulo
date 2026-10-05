import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { ANIME_CHARACTER_LIGHT, ANIME_HAIR_HIGHLIGHT, derivedShade, derivedHighlight, resolveCharacterLight, layeredShadingNormals, characterLitFaces, characterLitPieces, piecesAt, drawLayer } from './station-loft-shade.js';
import { layeredFaces, layeredSeat } from './station-loft-faces.js';
import { compileLayered } from './station-loft.js';
import { THONG } from './seat-panels.js';
import { validateRig, bindLayered } from './station-loft-rig.js';
import { standPose, poseLayered, rigidParts } from './hero-gesture.js';
import { FLAT_LIGHT, resolveToon, resolveToonLight, hexToRgb, rgbToHex } from './vexar.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { humanoidPlan } from './humanoid-plan.js';
import { heroPlan } from './hero-form.js';
import { composeAnime } from './anime-looks.js';
import { animeDefaultStyle } from './anime-head.js';
import { withGestureClip, resolveGesture, heroGesture } from './hero-gesture.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { rasterDepth, viewCamera } from '../scene/depth-raster.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const area = (c) => Math.hypot(...cross(sub(c[1], c[0]), sub(c[2], c[0]))) / 2;
const derived = (hex, g) => derivedShade(g, hex);

/** a UV sphere (radius 1) as a compiled-mesh-shaped object: one part, a palette group per face from `groupOf(φ, band)` */
function sphere({ lat = 16, lon = 24, groupOf = () => 'Skin', part = 'ball' } = {}) {
  const vertices = [[0, 0, 1]]; const ring = [];
  for (let i = 1; i < lat; i++) { const th = (i * Math.PI) / lat; ring.push([]); for (let j = 0; j < lon; j++) { const ph = (j * 2 * Math.PI) / lon; ring[i - 1].push(vertices.length); vertices.push([Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]); } }
  const bottom = vertices.length; vertices.push([0, 0, -1]);
  const faces = [], groups = [];
  const put = (t, j, band) => { faces.push(t); groups.push(groupOf((j + 0.5) / lon * 2 * Math.PI, band)); };
  for (let j = 0; j < lon; j++) put([0, ring[0][j], ring[0][(j + 1) % lon]], j, 0);
  for (let i = 0; i + 1 < ring.length; i++) for (let j = 0; j < lon; j++) {
    const a = ring[i][j], b = ring[i + 1][j], c = ring[i + 1][(j + 1) % lon], d = ring[i][(j + 1) % lon];
    put([a, b, c], j, i + 1); put([a, c, d], j, i + 1);
  }
  for (let j = 0; j < lon; j++) put([bottom, ring[ring.length - 1][(j + 1) % lon], ring[ring.length - 1][j]], j, lat - 1);
  return { vertices, faces, groups, provenance: vertices.map(() => ({ part, layer: 1 })), parts: { [part]: {} } };
}
/** the octahedron: every neighbour turns 70.5° away, past the 35° crease */
function octahedron() {
  const vertices = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; const faces = [];
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const X = sx > 0 ? 0 : 1, Y = sy > 0 ? 2 : 3, Z = sz > 0 ? 4 : 5;
    faces.push(sx * sy * sz > 0 ? [X, Y, Z] : [X, Z, Y]);
  }
  return { vertices, faces, groups: faces.map(() => 'Skin'), provenance: vertices.map(() => ({ part: 'oct', layer: 1 })), parts: { oct: {} } };
}
/** per render group: every edge (keyed by exact corner coordinates) used exactly twice, in opposite directions */
function openEdges(faces) {
  const by = new Map(); let open = 0;
  for (const f of faces) {
    let E = by.get(f.group); if (!E) by.set(f.group, E = new Map());
    for (let i = 0; i < 3; i++) {
      const a = f.corners[i].join(','), b = f.corners[(i + 1) % 3].join(','); const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const e = E.get(k) || { n: 0, bal: 0 }; e.n++; e.bal += a < b ? 1 : -1; E.set(k, e);
    }
  }
  for (const E of by.values()) for (const e of E.values()) if (e.n !== 2 || e.bal !== 0) open++;
  return open;
}

describe('resolveCharacterLight — which light a layered manifest reads', () => {
  // the anime hero's default carries its design base's hair highlight (the ring on the female, the fringe streak on the
  // male; the pole is headPreset, else the cast when male or female, else male)
  const anime = { kind: 'layered', hero: { head: 'anime' } }, female = { kind: 'layered', hero: { head: 'anime', cast: 'female' } };
  const def = (pole) => ({ ...ANIME_CHARACTER_LIGHT, highlight: ANIME_HAIR_HIGHLIGHT[pole] });
  it("the anime hero's read-time default; nothing for any other manifest", () => {
    expect(resolveCharacterLight(anime, {})).toEqual(def('male')); expect(resolveCharacterLight(anime, {})).toBe(resolveCharacterLight(anime, {}));   // frozen, shared
    expect(resolveCharacterLight(anime, { toon: null })).toEqual(def('male'));
    expect(resolveCharacterLight(female, {})).toEqual(def('female'));
    expect(resolveCharacterLight({ kind: 'layered', hero: { head: 'anime', cast: 'female', headPreset: 'male' } }, {})).toEqual(def('male'));
    expect(ANIME_HAIR_HIGHLIGHT).toEqual({ female: { Hair: { kind: 'ring', threshold: 0.3, band: [0.14, 0.22], falloff: 1.4 } }, male: { Hair: { kind: 'streak', threshold: 0.5, band: [0, 0.4], parts: 'fringe' } } });
    expect(resolveCharacterLight({ kind: 'layered', hero: { head: 'landmark' } }, {})).toBeNull();
    expect(resolveCharacterLight({ kind: 'layered', plan: {} }, { toon: resolveToon({ bands: 3, ink: true }) })).toBeNull();
    expect(ANIME_CHARACTER_LIGHT).toEqual(resolveToonLight(true));
    expect(Object.isFrozen(ANIME_CHARACTER_LIGHT.toLight)).toBe(true); expect(Object.isFrozen(resolveCharacterLight(anime, {}).highlight.Hair.band)).toBe(true);
  });
  it('ctx.light (the unshaded / lit export) wins; toon.light false opts out; an explicit light wins for anyone', () => {
    const layered = { light: true };   // world-scene resolves the dial with the light for a layered row only
    expect(resolveCharacterLight(anime, { light: FLAT_LIGHT, toon: null })).toBeNull();
    expect(resolveCharacterLight({ ...anime, toon: { light: false } })).toBeNull();                                // resolved from the manifest
    expect(resolveCharacterLight(anime, { toon: resolveToon({ light: false }, layered) })).toBeNull();             // resolved by world-scene
    const own = resolveToon({ light: { threshold: 0.2 } }, layered);
    expect(resolveCharacterLight({ kind: 'layered', hero: { head: 'landmark' } }, { toon: own })).toEqual({ ...ANIME_CHARACTER_LIGHT, threshold: 0.2 });
    expect(resolveCharacterLight(anime, { toon: resolveToon({ light: { toLight: [0, 0, 0] } }, layered) })).toBe(resolveCharacterLight(anime, {}));   // invalid ⇒ dropped
    // an anime hero's own light keeps the base's highlight unless it says `highlight` (false: none)
    expect(resolveCharacterLight(female, { toon: own })).toEqual({ ...def('female'), threshold: 0.2 });
    expect(resolveCharacterLight(female, { toon: resolveToon({ light: { highlight: false } }, layered) }).highlight).toBe(false);
    expect(resolveCharacterLight(female, { toon: resolveToon({ light: { highlight: { Hair: { kind: 'streak' } } } }, layered) }).highlight).toEqual({ Hair: { kind: 'streak', threshold: 0.5, band: [0, 0.4] } });
  });
  it('the derived swatches by value: the hair shade hue-shifted, never greyed, floored off the backdrop; the highlight always lighter', () => {
    // CIE L* of a swatch (D65, sRGB): the order the rules promise
    const Lstar = (hex) => { const Y = hexToRgb(hex).map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0); return Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : Y * 24389 / 27; };
    // L* × 0.52 floored at L* 20.5 (about 15 above the World page's dark backdrop, L* ≈ 5, and never closer than 10 to the
    // lit tone), chroma × 0.75, the hue 20° toward violet: a warm brown's shade stays brown, a blue-black's goes violet
    expect(derivedShade('Hair', '#644634')).toBe('#452b25'); expect(derivedShade('Hair', '#465365')).toBe('#2f313e');
    for (const hex of ['#644634', '#465365', '#3b4859']) expect(Lstar(derivedShade('Hair', hex)), hex).toBeCloseTo(20.5, 0);
    expect(Lstar(derivedShade('Hair', '#9a7a5a'))).toBeCloseTo(Lstar('#9a7a5a') * 0.52, 0);   // a lighter hair: the rule, not the floor
    expect(Lstar(derivedShade('Hair', '#101010'))).toBeLessThan(Lstar('#101010'));            // a hair darker than the floor still shades down
    // a quarter of the way from the base's L* to white (about +16 on a dark hair), chroma × 1.15, the same hue — always
    // lighter than its base; none when that lift is under 4 L* (a base above L* 84 keeps one lit tone)
    expect(derivedHighlight('#644634')).toBe('#936d57'); expect(derivedHighlight('#465365')).toBe('#6c7b91');
    for (const hex of ['#000000', '#101010', '#3b4859', '#644634', '#9a7a5a', '#f4a6c8', '#c0a070']) {
      const hi = derivedHighlight(hex); expect(hi, hex).toMatch(/^#[0-9a-f]{6}$/); expect(Lstar(hi), hex).toBeGreaterThan(Lstar(hex) + 3);
    }
    for (const hex of ['#ffffff', '#f0d890', '#e8e8f0']) expect(derivedHighlight(hex), hex).toBeNull();   // white, a blonde, a silver
    expect(derivedHighlight('#f0e0d0')).toBe(derivedHighlight('#f0e0d0'));
    // Skin and everything else keep their multipliers
    const c = hexToRgb('#d9a77e'); expect(derivedShade('Skin', '#d9a77e')).toBe(rgbToHex([c[0] * 0.9, c[1] * 0.76, c[2] * 0.76]));
  });
});

describe('layeredShadingNormals — per-corner, welded, crease-split', () => {
  it('a smooth closed form welds to its radial normal; every entry is unit length; deterministic', () => {
    const m = sphere(); const N = layeredShadingNormals(m);
    expect(N).toHaveLength(m.faces.length); expect(N.every((f) => f.length === 3)).toBe(true);
    let worst = 1;
    N.forEach((f, fi) => f.forEach((n, k) => { expect(Math.abs(Math.hypot(...n) - 1)).toBeLessThan(1e-12); worst = Math.min(worst, dot(n, m.vertices[m.faces[fi][k]])); }));
    expect(worst).toBeGreaterThan(0.99);
    expect(layeredShadingNormals(m)).toEqual(N);
  });
  it('a 35° crease keeps a sharp edge sharp: the octahedron shades flat, a wider crease welds', () => {
    const m = octahedron(); const N = layeredShadingNormals(m);
    N.forEach((f, fi) => { const [a, b, c] = m.faces[fi].map((vi) => m.vertices[vi]); const fn = unit(cross(sub(b, a), sub(c, a))); for (const n of f) expect(dot(n, fn)).toBeCloseTo(1, 12); });
    const wide = layeredShadingNormals(m, {}, { crease: 80 });
    expect(wide[0][0]).not.toEqual(N[0][0]);
  });
  it('welds in FANS across shared smooth edges: a vertex where faces turn gradually shares one normal around it', () => {
    // a low cone apex ring: neighbours turn ~20° (under the crease) but opposite faces ~80° (past it); a per-face filter
    // gives every corner at the apex a different subset, the fan gives them all one (the faces are joined edge to edge)
    const n = 18, vertices = [[0, 0, 0.35]], faces = [];
    for (let j = 0; j < n; j++) { const a = (j * 2 * Math.PI) / n; vertices.push([Math.cos(a), Math.sin(a), 0]); }
    for (let j = 0; j < n; j++) faces.push([0, 1 + j, 1 + ((j + 1) % n)]);
    const cone = { vertices, faces, groups: faces.map(() => 'Skin'), provenance: vertices.map(() => ({ part: 'cone', layer: 1 })), parts: { cone: {} } };
    const N = layeredShadingNormals(cone, {}, { proxy: false });
    for (const f of N) expect(f[0][2]).toBeCloseTo(1, 12);   // the apex: every corner the fan's (vertical) normal
    const fn = (t) => unit(cross(sub(vertices[t[1]], vertices[t[0]]), sub(vertices[t[2]], vertices[t[0]])));
    expect(dot(fn(faces[0]), fn(faces[n / 2]))).toBeLessThan(Math.cos((35 * Math.PI) / 180));   // opposite faces past the crease, joined through their neighbours
  });
  it('welds per palette group: a group seam keeps its own side', () => {
    const m = sphere({ groupOf: (ph) => (ph < Math.PI ? 'Skin' : 'Top') }); const N = layeredShadingNormals(m); const one = layeredShadingNormals(sphere());
    let seam = 0; N.forEach((f, fi) => f.forEach((n, k) => { if (Math.abs(n[0] - one[fi][k][0]) + Math.abs(n[1] - one[fi][k][1]) > 1e-9) seam++; }));
    expect(seam).toBeGreaterThan(0);
  });
});

describe('characterLitFaces — the conforming iso-split', () => {
  // exact radial normals make d = N·L = z at every corner, so the linear iso-line IS the plane z = threshold
  const L = resolveToonLight({ toLight: [0, 0, 1], threshold: 0.3 });   // Hair steps at its default 0.40; Iris unlit
  const palette = { Skin: '#d9a77e', Hair: '#3b291e', Iris: '#4d6b6e' };
  const m = sphere({ groupOf: (ph, band) => (band < 2 ? 'Iris' : ph < Math.PI ? 'Skin' : 'Hair') });
  const radial = m.faces.map((t) => t.map((vi) => unit(m.vertices[vi])));
  const recipe = { palette };
  const faces = characterLitFaces(m, recipe, { light: L, normals: radial, seat: false });
  const at = { [palette.Skin]: ['lit', 0.3], [derived(palette.Skin, 'Skin')]: ['shade', 0.3], [palette.Hair]: ['lit', 0.4], [derived(palette.Hair, 'Hair')]: ['shade', 0.4] };

  it('every piece lies on its own side of the terminator plane; two tones per lit group, the unlit group at its base', () => {
    expect(new Set(faces.map((f) => f.fill))).toEqual(new Set([...Object.keys(at), palette.Iris]));
    for (const f of faces) {
      if (f.fill === palette.Iris) continue;
      const [side, t] = at[f.fill];
      for (const c of f.corners) if (side === 'lit') expect(c[2]).toBeGreaterThanOrEqual(t - 1e-12); else expect(c[2]).toBeLessThanOrEqual(t + 1e-12);
    }
    // the band the plane cuts really split: pieces carry corners ON the plane
    expect(faces.some((f) => f.corners.some((c) => Math.abs(c[2] - 0.3) < 1e-12))).toBe(true);
    expect(faces.some((f) => f.corners.some((c) => Math.abs(c[2] - 0.4) < 1e-12))).toBe(true);
  });
  it('conserves area, keeps the parent winding and outNormal, and stays closed (no T-junction)', () => {
    const parent = layeredFaces(m, recipe, { seat: false });
    const A = parent.reduce((s, f) => s + area(f.corners), 0), B = faces.reduce((s, f) => s + area(f.corners), 0);
    expect(Math.abs(A - B) / A).toBeLessThan(1e-9);
    for (const f of faces) { expect(dot(unit(cross(sub(f.corners[1], f.corners[0]), sub(f.corners[2], f.corners[0]))), f.outNormal)).toBeGreaterThan(1 - 1e-6); expect(area(f.corners)).toBeGreaterThan(0); }
    expect(openEdges(parent)).toBe(0); expect(openEdges(faces)).toBe(0);
    expect(characterLitFaces(m, recipe, { light: L, normals: radial, seat: false })).toEqual(faces);   // deterministic
  });
  it('a threshold through a ring of vertices snaps to them: no slivers, still closed', () => {
    const t = Math.cos((6 * Math.PI) / 16); const one = sphere();
    const f2 = characterLitFaces(one, recipe, { light: resolveToonLight({ toLight: [0, 0, 1], threshold: t }), normals: one.faces.map((tri) => tri.map((vi) => unit(one.vertices[vi]))), seat: false });
    expect(openEdges(f2)).toBe(0);
    for (const f of f2) expect(2 * area(f.corners)).toBeGreaterThan(1e-14);
    const A = layeredFaces(one, recipe, { seat: false }).reduce((s, f) => s + area(f.corners), 0);
    expect(Math.abs(A - f2.reduce((s, f) => s + area(f.corners), 0)) / A).toBeLessThan(1e-9);
  });
  it('an explicit shade swatch replaces the derived one; an unsplit face is the exact layeredFaces triangle', () => {
    const own = characterLitFaces(m, recipe, { light: resolveToonLight({ toLight: [0, 0, 1], threshold: 0.3, shade: { Skin: '#aa5544' } }), normals: radial, seat: false });
    const fills = new Set(own.map((f) => f.fill)); expect(fills.has('#aa5544')).toBe(true); expect(fills.has(derived(palette.Skin, 'Skin'))).toBe(false);
    const parent = layeredFaces(m, recipe, { seat: false });
    expect(faces[0].corners).toEqual(parent[0].corners);   // the top cap (Iris, far from the plane) is untouched
    expect(faces[0].fill).toBe(palette.Iris);
  });
});

describe('the emissive groups under the character light (a lens, a visor slit, a reactor)', () => {
  // the recipe's `emissive` groups render full-bright on the static solid (layeredFaces); the character light used to
  // step and split them like any lit group
  const L = resolveToonLight({ toLight: [0, 0, 1], threshold: 0.3 });
  const palette = { Skin: '#d9a77e', Lens: '#eef6ff' };
  const m = sphere({ groupOf: (ph) => (ph < Math.PI ? 'Skin' : 'Lens') });
  const radial = m.faces.map((t) => t.map((vi) => unit(m.vertices[vi])));
  const cy = (f) => (f.corners[0][1] + f.corners[1][1] + f.corners[2][1]) / 3;   // the Lens half is y < 0
  it('an emissive group keeps its base colour, never split; the solid stays closed', () => {
    const glow = characterLitFaces(m, { palette, emissive: ['Lens'] }, { light: L, normals: radial, seat: false });
    const lensFaces = glow.filter((f) => cy(f) < 0);
    expect(lensFaces.length).toBeGreaterThanOrEqual(m.groups.filter((g) => g === 'Lens').length);
    expect(lensFaces.every((f) => f.fill === palette.Lens && !f.noInk)).toBe(true);
    expect(glow.filter((f) => cy(f) > 0).some((f) => f.fill === derived(palette.Skin, 'Skin'))).toBe(true);   // the rest still steps
    expect(openEdges(glow)).toBe(0);
    const A = layeredFaces(m, { palette }, { seat: false }).reduce((t, f) => t + area(f.corners), 0);
    expect(Math.abs(A - glow.reduce((t, f) => t + area(f.corners), 0)) / A).toBeLessThan(1e-9);
    const plain = characterLitFaces(m, { palette }, { light: L, normals: radial, seat: false });
    expect(plain.filter((f) => cy(f) < 0).some((f) => f.fill === derived(palette.Lens, 'Lens'))).toBe(true);   // without it, the lens steps into shade
    expect(characterLitFaces(m, { palette, emissive: [] }, { light: L, normals: radial, seat: false })).toEqual(plain);   // none ⇒ the same faces
  });
});

describe('the highlight — a second conforming iso-split on the lit side', () => {
  // the key on +x, exact radial normals: N·L = x, the step the plane x = 0.40 (the Hair default); a ring whose band is
  // the middle half of the group's height centred at z = 0 (no face part: the group's own extent is the frame), its
  // half-height narrowed away from the key's azimuth, so s = min(x − 0.2, 1 − (z / 0.5 / w)²), w = cos(Δ)^½ with Δ the
  // turn about the vertical axis from +x: a crescent facing the key whose edges cross the step's line inside triangles
  // (the corner reference `bary`)
  const m = sphere({ lat: 24, lon: 32, groupOf: () => 'Hair' });
  const radial = m.faces.map((t) => t.map((vi) => unit(m.vertices[vi])));
  const palette = { Hair: '#3b4859' };
  const light = resolveToonLight({ toLight: [1, 0, 0], highlight: { Hair: { kind: 'ring', threshold: 0.2, band: [0.25, 0.75], falloff: 1 } } });
  const pieces = characterLitPieces(m, { light, normals: radial, palette });
  const faces = pieces.map((pc) => ({ corners: pc.refs.map((r) => r.p), fill: pc.fill, group: pc.part }));
  const hi = derivedHighlight(palette.Hair), shade = derivedShade('Hair', palette.Hair);
  const cen = (c) => [0, 1, 2].map((k) => (c[0][k] + c[1][k] + c[2][k]) / 3);

  it('three tones: the highlight only on the lit side, inside its band; closed, area kept, deterministic', () => {
    expect(new Set(faces.map((f) => f.fill))).toEqual(new Set([palette.Hair, hi, shade]));
    for (const f of faces) {
      const [x, , z] = cen(f.corners);
      if (f.fill === shade) expect(Math.max(...f.corners.map((c) => c[0]))).toBeLessThanOrEqual(0.4 + 1e-12);
      else expect(Math.min(...f.corners.map((c) => c[0]))).toBeGreaterThanOrEqual(0.4 - 1e-12);
      // the corner values are interpolated: inside the crescent up to the chord's error
      if (f.fill === hi) { const [, y] = cen(f.corners), c = Math.cos(Math.atan2(x, y) - Math.PI / 2), w = c > 0 ? Math.sqrt(c) : 0; expect(x).toBeGreaterThan(0.2 - 0.02); expect(Math.abs(z / 0.5)).toBeLessThan(w + 0.06); }
    }
    expect(openEdges(faces)).toBe(0);
    const A = layeredFaces(m, { palette }, { seat: false }).reduce((a, f) => a + area(f.corners), 0);
    expect(Math.abs(A - faces.reduce((a, f) => a + area(f.corners), 0)) / A).toBeLessThan(1e-9);
    expect(characterLitPieces(m, { light, normals: radial, palette })).toEqual(pieces);
  });
  it('where the two lines cross inside a triangle the corner is a bary ref, shared by the lit and the shade side; piecesAt re-places it exactly', () => {
    const bary = pieces.filter((pc) => pc.refs.some((r) => r.bary));
    expect(bary.length).toBeGreaterThan(0); expect(pieces.some((pc) => pc.refs.some((r) => r.mix))).toBe(false);
    for (const pc of bary) for (const r of pc.refs) if (r.bary) {
      expect(r.bary.map(([vi]) => vi).sort()).toEqual([...m.faces[pc.fi]].sort()); expect(Math.abs(r.bary.reduce((a, [, w]) => a + w, 0) - 1)).toBeLessThan(1e-12);
      expect(Math.abs(r.p[0] - 0.4)).toBeLessThan(1e-9);   // on the step's line
    }
    const fills = new Set(bary.filter((pc) => pc.refs.some((r) => r.bary)).map((pc) => pc.fill)); expect(fills).toEqual(new Set([palette.Hair, hi, shade]));
    const again = piecesAt(pieces, m, 0); expect(again.map((pc) => pc.refs.map((r) => r.p))).toEqual(pieces.map((pc) => pc.refs.map((r) => r.p)));
    const moved = { ...m, vertices: m.vertices.map((v) => [v[0] + 1, v[1] * 2, v[2]]) };
    expect(openEdges(piecesAt(pieces, moved, 0.5).map((pc) => ({ corners: pc.refs.map((r) => r.p), group: pc.part })))).toBe(0);
  });
  it('the colour: palette <group>Highlight wins over the derived one; `parts` keeps it to its parts; none unless asked', () => {
    const own = characterLitPieces(m, { light, normals: radial, palette: { ...palette, HairHighlight: '#abcdef' } });
    expect(own.some((pc) => pc.fill === '#abcdef')).toBe(true); expect(own.some((pc) => pc.fill === hi)).toBe(false);
    // a base too light for a lighter tone (derivedHighlight null) keeps the two-tone step's pieces exactly
    const white = { Hair: '#ffffff' }, plainLight = resolveToonLight({ toLight: [1, 0, 0] });
    expect(characterLitPieces(m, { light, normals: radial, palette: white })).toEqual(characterLitPieces(m, { light: plainLight, normals: radial, palette: white }));
    const fringeOnly = characterLitPieces(m, { light: resolveToonLight({ toLight: [1, 0, 0], highlight: { Hair: { kind: 'ring', threshold: 0.2, band: [0.25, 0.75], falloff: 1, parts: 'fringe' } } }), normals: radial, palette });
    expect(fringeOnly.some((pc) => pc.fill === hi)).toBe(false);   // the sphere's part is no fringe
    // a light without a highlight: exactly the two-tone step's pieces
    const plain = resolveToonLight({ toLight: [1, 0, 0] });
    expect(characterLitPieces(m, { light: { ...light, highlight: undefined }, normals: radial, palette })).toEqual(characterLitPieces(m, { light: plain, normals: radial, palette }));
    expect(characterLitPieces(m, { light: resolveToonLight({ toLight: [1, 0, 0], highlight: false }), normals: radial, palette })).toEqual(characterLitPieces(m, { light: plain, normals: radial, palette }));
  });
  it('the streak: a hard window on the band, only above its own threshold', () => {
    const streak = characterLitPieces(m, { light: resolveToonLight({ toLight: [1, 0, 0], highlight: { Hair: { kind: 'streak', threshold: 0.7, band: [0, 0.25] } } }), normals: radial, palette });
    const F = streak.map((pc) => ({ corners: pc.refs.map((r) => r.p), fill: pc.fill, group: pc.part }));
    expect(openEdges(F)).toBe(0);
    const lit = F.filter((f) => f.fill === hi); expect(lit.length).toBeGreaterThan(0);
    for (const f of lit) { const [x, , z] = cen(f.corners); expect(x).toBeGreaterThan(0.6); expect(z).toBeGreaterThan(0.4); }   // the top quarter of the height (z > 0.5), N·L > 0.7
  });
});

describe('the character light on the anime hero', () => {
  const hero = (cast) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime' }) }); return { m, mesh: compileLayered(m.recipe, m.dials) }; };
  const { m, mesh } = hero('female');
  const N = layeredShadingNormals(mesh, m.recipe);
  const faces = characterLitFaces(mesh, m.recipe, { normals: N });
  const P = m.recipe.palette;

  it('normals: unit length, shaped like the faces, deterministic; the proxies move only the face, ear and neck skin', () => {
    expect(N).toHaveLength(mesh.faces.length);
    for (const f of N) for (const n of f) expect(Math.abs(Math.hypot(...n) - 1)).toBeLessThan(1e-12);
    expect(layeredShadingNormals(mesh, m.recipe)).toEqual(N);
    const flat = layeredShadingNormals(mesh, m.recipe, { proxy: false }); const moved = new Set();
    N.forEach((f, fi) => { if (JSON.stringify(f) !== JSON.stringify(flat[fi])) moved.add(`${mesh.provenance[mesh.faces[fi][0]].part}/${mesh.groups[fi]}`); });
    expect([...moved].sort()).toEqual(['earL/Skin', 'earR/Skin', 'face/Skin', 'neck/Skin']);
  });
  it('a posed mesh with its rest: the weld and the region weights follow the vertices, the proxies follow the head', () => {
    const a = 0.5, c = Math.cos(a), s = Math.sin(a); const R = (p) => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]];
    const turned = layeredShadingNormals({ ...mesh, vertices: mesh.vertices.map(R) }, m.recipe, { rest: mesh });
    let worst = 0; N.forEach((f, fi) => f.forEach((n, k) => { const r = R(n); worst = Math.max(worst, Math.hypot(r[0] - turned[fi][k][0], r[1] - turned[fi][k][1], r[2] - turned[fi][k][2])); }));
    expect(worst).toBeLessThan(1e-9);
  });
  it('two tones per lit group; the lenses, the ink and the mouth at their base colour', () => {
    const byPart = new Map(); for (const f of faces) { let s = byPart.get(f.group); if (!s) byPart.set(f.group, s = new Set()); s.add(f.fill); }
    const skinShade = derived(P.Skin, 'Skin'), hairShade = derived(P.Hair, 'Hair');
    expect(byPart.get('face')).toEqual(new Set([P.Skin, skinShade, P.Sclera, P.Mouth]));
    for (const [part, fills] of byPart) {
      if (/^hair/.test(part)) expect(fills).toEqual(new Set([P.Hair, hairShade]));   // (the light with no highlight)
      if (/^(iris)/.test(part)) expect(fills).toEqual(new Set([P.Iris]));
      if (/^(pupil)/.test(part)) expect(fills).toEqual(new Set([P.Pupil]));
      if (/^(brow|lash)/.test(part)) expect(fills).toEqual(new Set([P.Ink]));
    }
    // the neck occlusion rule: under the anime head the neck is in the head's shade; on the structured core (this hero)
    // the jaw's, its lower edge a V toward the notch, the neck under it stepped by N·L
    expect(byPart.get('neck')).toEqual(new Set([skinShade, P.Skin]));
  });
  it('the neck occlusion rule: under the anime head the neck is in shade (on the structured core above the jaw line, stepped under it); any other mesh steps its neck', () => {
    const neckFaces = mesh.faces.filter((t) => mesh.provenance[t[0]].part === 'neck').length;
    // without the structured core (no pelvis part): every neck face whole and in shade
    const lean = { ...mesh, parts: Object.fromEntries(Object.entries(mesh.parts).filter(([k]) => k !== 'pelvis')) };
    const pieces = characterLitPieces(lean, { normals: N, palette: P, dz: layeredSeat(mesh, true) }).filter((pc) => pc.part === 'neck');
    expect(pieces).toHaveLength(neckFaces); expect(new Set(pieces.map((pc) => pc.fill))).toEqual(new Set([derived(P.Skin, 'Skin')]));
    expect(pieces.every((pc) => pc.refs.every((r) => r.vi !== undefined))).toBe(true);   // no crossing: the parent triangle
    // the structured core: the jaw's shadow over the neck's top, the neck lit under its lower edge (both tones), and every
    // piece wholly over the chin in shade
    const jawed = characterLitPieces(mesh, { normals: N, palette: P, dz: layeredSeat(mesh, true) }).filter((pc) => pc.part === 'neck');
    expect(new Set(jawed.map((pc) => pc.fill))).toEqual(new Set([P.Skin, derived(P.Skin, 'Skin')]));
    const chin = Math.min(...mesh.faces.filter((t) => mesh.provenance[t[0]].part === 'face').flat().map((v) => mesh.vertices[v]).filter((p) => p[1] > 0).map((p) => p[2])) + layeredSeat(mesh, true);
    expect(jawed.filter((pc) => pc.refs.every((r) => r.p[2] > chin + 0.002)).every((pc) => pc.fill === derived(P.Skin, 'Skin'))).toBe(true);
    // a mesh without the anime face (no face shell over a cranium core) steps its part named `neck` as any other part
    const plain = { ...mesh, parts: Object.fromEntries(Object.entries(mesh.parts).filter(([k]) => k !== 'face')) };
    const stepped = characterLitPieces(plain, { normals: N, palette: P, dz: layeredSeat(mesh, true) }).filter((pc) => pc.part === 'neck');
    expect(new Set(stepped.map((pc) => pc.fill))).toEqual(new Set([P.Skin, derived(P.Skin, 'Skin')]));
  });
  it("the seat's panels: the structured female's thong (a V narrowing into the cleft, a thin string rising over the hip), the male's speedo (its crease, its leg line rounded on the thigh), under the character light and the studio's", () => {
    const build = (hero) => { const m = expandLayeredManifest({ kind: 'layered', hero }); return compileLayered(m.recipe, m.dials || {}, m.channels || {}); };
    const piecesOf = (me, extra = {}) => characterLitPieces(me, { normals: layeredShadingNormals(me), dz: layeredSeat(me, true), ...extra });
    const SW = '#336699', P = { Swim: SW }, swimTones = new Set([SW, derived(SW, 'Swim')]);
    // the female: on her seat's skin, pieces in the swimsuit's tones; under the string (the V) every one behind, within
    // the V's top half-width of the midline, narrower low than high (the V narrows into the cleft)
    const fm = build({ cast: 'female', head: 'anime', detail: 'swimsuit' }), f = piecesOf(fm, { palette: P }).filter((pc) => pc.part === 'pelvis');
    const str = f.filter((pc) => fm.groups[pc.fi] === 'Skin' && swimTones.has(pc.fill)); expect(str.length).toBeGreaterThan(0);
    const pts = str.flatMap((pc) => pc.refs.map((r) => r.p)), side = pts.filter((p) => Math.abs(p[0]) > 0.13), mid = pts.filter((p) => Math.abs(p[0]) < 0.02);
    const zTopMid = Math.max(...mid.map((p) => p[2])), vee = pts.filter((p) => p[2] < zTopMid - THONG.string - 1e-6);
    expect(vee.every((p) => Math.abs(p[0]) < THONG.vee + 0.002 && p[1] < 0.01)).toBe(true);
    const zs = vee.map((p) => p[2]), z0 = Math.min(...zs), z1 = Math.max(...zs), widthIn = (a, b) => Math.max(...vee.filter((p) => p[2] >= a && p[2] <= b).map((p) => Math.abs(p[0])));
    expect(widthIn(z0, z0 + 0.25 * (z1 - z0))).toBeLessThan(widthIn(z1 - 0.25 * (z1 - z0), z1));
    // the string at the hip: thin (its own height, not the ring's) and higher than at the back
    expect(side.length).toBeGreaterThan(0);
    expect(Math.max(...side.map((p) => p[2])) - Math.min(...side.map((p) => p[2]))).toBeLessThan(THONG.string + 0.012);
    expect(Math.max(...side.map((p) => p[2]))).toBeGreaterThan(zTopMid + 0.005);
    // the studio light draws the thong too: pelvis faces in the swimsuit's colour (blue over red) behind, off the Swim group's own
    const sf = layeredFaces(fm, { palette: { Swim: SW, Skin: '#ffffff' } }).filter((x) => x.group === 'pelvis'), blue = (x) => { const [r, , b] = [1, 3, 5].map((i) => parseInt(x.fill.slice(i, i + 2), 16)); return b > r + 20; };
    expect(sf.length).toBeGreaterThan(fm.faces.filter((t) => fm.provenance[t[0]].part === 'pelvis').length);
    expect(sf.some((x) => blue(x) && x.corners.every((c) => c[1] < 0 && Math.abs(c[0]) < 0.03))).toBe(true);
    // the male: his speedo's pieces take a third tone, darker than its shade, down the midline behind (the crease)
    const mm = build({ cast: 'male', head: 'anime', detail: 'swimsuit' }), all = piecesOf(mm, { palette: P }), m = all.filter((pc) => pc.part === 'pelvis');
    const crease = m.filter((pc) => mm.groups[pc.fi] === 'Swim' && !swimTones.has(pc.fill));
    expect(crease.length).toBeGreaterThan(0);
    expect(crease.every((pc) => pc.refs.every((r) => Math.abs(r.p[0]) < 0.04 && r.p[1] < 0.01))).toBe(true);
    // the skin of his lower back over the speedo's waistband keeps the skin's two tones (no wedge, no V)
    const skinTones = new Set(m.filter((pc) => mm.groups[pc.fi] === 'Skin').map((pc) => pc.fill)); expect(skinTones.size).toBeLessThanOrEqual(2);
    for (const t of swimTones) expect(skinTones.has(t)).toBe(false);
    // the speedo's leg line on his thigh: the thigh's skin in the swimsuit's tones, lowest behind, higher at the outer side
    const leg = all.filter((pc) => pc.part === 'thighR' && mm.groups[pc.fi] === 'Skin' && swimTones.has(pc.fill)).flatMap((pc) => pc.refs.map((r) => r.p)); expect(leg.length).toBeGreaterThan(0);
    const ax = leg.reduce((a, p) => a + p[0], 0) / leg.length, low = (q) => Math.min(...leg.filter(q).map((p) => p[2]));
    expect(low((p) => p[1] < -0.04 && Math.abs(p[0] - ax) < 0.03)).toBeLessThan(low((p) => p[0] > ax + 0.05) - 0.02);
    // the streamlined core has no pelvis part, so no panel (and no pelvis pieces at all)
    const s0 = piecesOf(build({ cast: 'female', head: 'anime', detail: 'swimsuit', core: 'streamlined' }), { palette: P }).filter((pc) => pc.part === 'pelvis');
    expect(s0).toHaveLength(0);
  });
  it("the hair's top planes: under the anime head a hair corner's N·L gains 0.8 of its normal's upward share; nothing else moves, and no other mesh takes it", () => {
    const dz = layeredSeat(mesh, true), on = characterLitPieces(mesh, { normals: N, palette: P, dz }), off = characterLitPieces(mesh, { normals: N, palette: P, dz, hairTop: false });
    expect(on.filter((pc) => !/^hair/.test(pc.part))).toEqual(off.filter((pc) => !/^hair/.test(pc.part)));
    const A = (list, fill) => list.filter((pc) => /^hair/.test(pc.part) && pc.fill === fill).reduce((a, pc) => a + area(pc.refs.map((r) => r.p)), 0);
    expect(A(on, P.Hair)).toBeGreaterThan(A(off, P.Hair) * 1.02);   // more of the mass lit: its top planes
    const F = on.map((pc) => ({ corners: pc.refs.map((r) => r.p), fill: pc.fill, group: pc.part })); expect(openEdges(F)).toBe(0);
    // a mesh without the anime face (no face shell over a cranium core) steps its hair on the key alone
    const plain = { ...mesh, parts: Object.fromEntries(Object.entries(mesh.parts).filter(([k]) => k !== 'face')) };
    expect(characterLitPieces(plain, { normals: N, palette: P, dz })).toEqual(characterLitPieces(plain, { normals: N, palette: P, dz, hairTop: false }));
  });
  it("the hero's own light: a third tone on the hair (the female's ring), only on the lit side; closed; area per part kept", () => {
    const light = resolveCharacterLight(m); expect(light.highlight).toEqual(ANIME_HAIR_HIGHLIGHT.female);
    const dz = layeredSeat(mesh, true), pieces = characterLitPieces(mesh, { light, normals: N, palette: P, dz });
    const F = pieces.map((pc) => ({ corners: pc.refs.map((r) => r.p), fill: pc.fill, group: pc.part }));
    const hi = derivedHighlight(P.Hair), hairShade = derived(P.Hair, 'Hair');
    expect(openEdges(F)).toBe(0); expect(pieces.some((pc) => pc.refs.some((r) => r.mix))).toBe(false);
    const hairFills = new Set(F.filter((f) => /^hair/.test(f.group)).map((f) => f.fill)); expect(hairFills).toEqual(new Set([P.Hair, hairShade, hi]));
    expect(F.filter((f) => f.fill === hi).every((f) => /^hair/.test(f.group))).toBe(true);
    // the highlight is a small share of the lit hair (a sheen line, not a second lit tone)
    const A = (fill) => F.filter((f) => /^hair/.test(f.group) && f.fill === fill).reduce((a, f) => a + area(f.corners), 0);
    const share = A(hi) / (A(hi) + A(P.Hair)); expect(share).toBeGreaterThan(0.01); expect(share).toBeLessThan(0.08);
    // everything off the hair is the two-tone step's, piece for piece
    const plain = characterLitPieces(mesh, { light: ANIME_CHARACTER_LIGHT, normals: N, palette: P, dz }).filter((pc) => !/^hair/.test(pc.part));
    expect(pieces.filter((pc) => !/^hair/.test(pc.part))).toEqual(plain);
  });
  it('area per part equals the parent triangles; every part stays closed; deterministic', () => {
    const parent = layeredFaces(mesh, m.recipe);
    const sum = (fs) => { const o = {}; for (const f of fs) o[f.group] = (o[f.group] || 0) + area(f.corners); return o; };
    const A = sum(parent), B = sum(faces);
    expect(Object.keys(B).sort()).toEqual(Object.keys(A).sort());
    for (const k of Object.keys(A)) expect(Math.abs(A[k] - B[k]) / A[k]).toBeLessThan(1e-9);
    expect(openEdges(faces)).toBe(0);
    expect(faces.length).toBeGreaterThan(parent.length);
    expect(characterLitFaces(mesh, m.recipe, { normals: N })).toEqual(faces);
  });
  it('the draw layers: the brows and lids `through`, the fringe `veil`, every other hair face `hair` with the ink only; nothing else', () => {
    const partsBy = (fs) => { const o = {}; for (const f of fs) if (f.layer) (o[f.layer] ??= new Set()).add(f.group); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [...v].sort()])); };
    expect(partsBy(faces)).toEqual({ through: ['browL', 'browR', 'lidL', 'lidR'], veil: ['hairFormFringeA', 'hairFormFringeB'] });
    const inked = characterLitFaces(mesh, m.recipe, { normals: N, hairInk: true });
    expect(partsBy(inked)).toEqual({ ...partsBy(faces), hair: ['hairCap', 'hairFormBackC', 'hairFormBackL', 'hairFormBackR', 'hairFormSideL', 'hairFormSideR'] });
    // the layer is the whole difference, and only where there is one does the key appear
    const bare = (fs) => fs.map(({ layer: _layer, ...f }) => f);
    expect(bare(inked)).toEqual(bare(faces)); expect(faces.filter((f) => 'layer' in f).every((f) => f.layer)).toBe(true);
    // under the ink every Hair face is in the hair class (hair or veil), and no other group's face is
    const pieces = characterLitPieces(mesh, { normals: N, palette: P, dz: layeredSeat(mesh, true) });
    pieces.forEach((pc, i) => expect(mesh.groups[pc.fi] === 'Hair', pc.part).toBe(inked[i].layer === 'hair' || inked[i].layer === 'veil'));
    expect(pieces.map((pc) => drawLayer(mesh, pc, { hairInk: true }))).toEqual(inked.map((f) => f.layer ?? null));
    // the studio's face carries no flag: no layer at all without the ink, the hair class alone with it
    const studio = (() => { const s = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', sculpt: false }) }); return { r: s.recipe, mesh: compileLayered(s.recipe, s.dials) }; })();
    const sN = layeredShadingNormals(studio.mesh, studio.r);
    expect(characterLitFaces(studio.mesh, studio.r, { normals: sN }).some((f) => 'layer' in f)).toBe(false);
    expect(new Set(characterLitFaces(studio.mesh, studio.r, { normals: sN, hairInk: true }).map((f) => f.layer))).toEqual(new Set([undefined, 'hair']));
  });
});

describe('the character light on a stand: closed, continuous, the head in its own frame', () => {
  /** an anime hero standing in `gesture`, as the World resolver builds it (world-kinds.js `layered`) */
  const stand = (cast, gesture) => {
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime', gesture }) });
    const mesh = compileLayered(m.recipe, m.dials); const R = validateRig(m.recipe.rig); const skin = bindLayered(mesh, m.recipe, R);
    const shown = poseLayered(mesh, m.recipe, standPose(m.recipe, R), { R, skin }).mesh; const rigid = rigidParts(mesh, skin, R, 'head');
    return { m, mesh, shown, rigid, dz: layeredSeat(mesh, true), N: layeredShadingNormals(shown, m.recipe, { rest: mesh, rigid }) };
  };
  const asFaces = (pieces) => pieces.map((pc) => ({ corners: pc.refs.map((r) => r.p), group: pc.part }));
  const female = stand('female', 'relaxed');

  it('every part stays closed at every preset stand under the candidate keys, posed and re-placed at rest', () => {
    // crossings a hair apart on one edge (faces across a crease) merge into one point, so no sliver is left to drop
    const keys = [[0.45, 0.75, 0.55], [-0.45, 0.75, 0.55], [-0.15, 0.55, 0.82]];
    for (const cast of ['female', 'male']) for (const gesture of ['relaxed', 'hand-on-hip', 'guard']) {
      const S = cast === 'female' && gesture === 'relaxed' ? female : stand(cast, gesture);
      for (const toLight of keys) for (const threshold of [0, 0.2]) {
        const pieces = characterLitPieces(S.shown, { light: resolveToonLight({ toLight, threshold }), normals: S.N, palette: S.m.recipe.palette, dz: S.dz });
        const at = `${cast} ${gesture} [${toLight}] ${threshold}`;
        expect(openEdges(asFaces(pieces)), at).toBe(0); expect(openEdges(asFaces(piecesAt(pieces, S.mesh, S.dz))), at).toBe(0);
        expect(pieces.some((pc) => pc.refs.some((r) => r.mix)), at).toBe(false);   // the centroid fallback never runs
        // with the base's hair highlight (the second split, its band on the rest mesh) too
        const hi = characterLitPieces(S.shown, { light: resolveToonLight({ toLight, threshold, highlight: ANIME_HAIR_HIGHLIGHT[cast] }), normals: S.N, palette: S.m.recipe.palette, dz: S.dz, rest: S.mesh });
        expect(openEdges(asFaces(hi)), `${at} highlight`).toBe(0); expect(openEdges(asFaces(piecesAt(hi, S.mesh, S.dz))), `${at} highlight`).toBe(0);
        expect(hi.some((pc) => pc.refs.some((r) => r.mix)), at).toBe(false);
      }
    }
  }, 120_000);   // about 11 s alone; the 30 s default times out under a loaded full suite
  it('the terminator is continuous: the two faces across every smooth edge cross it at the same point', () => {
    const { shown, N } = female; const L = ANIME_CHARACTER_LIGHT; const unlit = new Set(L.unlit);
    const V = shown.vertices, F = shown.faces, G = shown.groups, nV = V.length; const edges = new Map();
    F.forEach((t, fi) => { for (let k = 0; k < 3; k++) { const key = Math.min(t[k], t[(k + 1) % 3]) * nV + Math.max(t[k], t[(k + 1) % 3]); let l = edges.get(key); if (!l) edges.set(key, l = []); l.push([fi, k]); } });
    const fn = (fi) => unit(cross(sub(V[F[fi][1]], V[F[fi][0]]), sub(V[F[fi][2]], V[F[fi][0]])));
    let smooth = 0;
    for (const l of edges.values()) {
      if (l.length !== 2) continue; const [[f1, k1], [f2, k2]] = l;
      if (G[f1] !== G[f2] || unlit.has(G[f1]) || dot(fn(f1), fn(f2)) <= Math.cos((35 * Math.PI) / 180)) continue;
      const lo = Math.min(F[f1][k1], F[f1][(k1 + 1) % 3]); const t = L.thresholds[G[f1]] ?? L.threshold;
      const ends = (fi, k) => { const a = F[fi][k] === lo ? k : (k + 1) % 3, b = a === k ? (k + 1) % 3 : k; return [dot(N[fi][a], L.toLight), dot(N[fi][b], L.toLight)]; };
      const [a1, b1] = ends(f1, k1), [a2, b2] = ends(f2, k2);
      if ((a1 > t) === (b1 > t) && (a2 > t) === (b2 > t)) continue;
      smooth++; expect([a2, b2]).toEqual([a1, b1]);   // the same values ⇒ the same crossing, bit for bit
    }
    expect(smooth).toBeGreaterThan(100);
  });
  it('the parts riding the head bone are lit in their own frame: at the stand their pieces are the rest pieces', () => {
    const { m, mesh, shown, rigid, N, dz } = female; const pal = m.recipe.palette;
    // (the graphic face adds the lid bands, the catchlights and the nose line: head parts too)
    expect([...rigid].filter((p) => !/^(cranium|face|ear|brow|hair|iris|pupil|lash|lid|catch|noseLine)/.test(p))).toEqual([]); expect(rigid.has('face')).toBe(true);
    const key = (pieces) => pieces.filter((pc) => rigid.has(pc.part)).map((pc) => `${pc.fill}|${pc.refs.map((r) => (r.vi !== undefined ? r.vi : `${r.a}-${r.b}@${r.s}`)).join(' ')}`);
    const posed = characterLitPieces(shown, { normals: N, palette: pal, dz });
    const rest = characterLitPieces(mesh, { normals: layeredShadingNormals(mesh, m.recipe), palette: pal, dz });
    expect(key(posed)).toEqual(key(rest));
    // the hair's highlight too: its band is read on the rest mesh (`rest`), so the stand never moves it
    const light = resolveCharacterLight(m), keyB = (pieces) => pieces.filter((pc) => rigid.has(pc.part)).map((pc) => `${pc.fill}|${pc.refs.map((r) => (r.vi !== undefined ? r.vi : r.bary ? r.bary.map(([vi, w]) => `${vi}:${w}`).join(',') : `${r.a}-${r.b}@${r.s}`)).join(' ')}`);
    const posedHi = characterLitPieces(shown, { light, normals: N, palette: pal, dz, rest: mesh });
    expect(posedHi.some((pc) => pc.fill === derivedHighlight(pal.Hair))).toBe(true);
    expect(keyB(posedHi)).toEqual(keyB(characterLitPieces(mesh, { light, normals: layeredShadingNormals(mesh, m.recipe), palette: pal, dz })));
  });
});

// World payload pins, recorded from the layered resolver BEFORE the character light existed: a manifest the channel
// does not reach (every non-anime hero and plan, and the anime hero under the unshaded export or with toon.light
// false) resolves byte-identical. sha256(JSON.stringify(payload)), first 16 hex digits.
// Re-pinned for the hero's `wave` clip (hero-form.js): the upper arm level and the forearm up, the elbow never over
// the head. Every hero plan carries the clip, so the plan, the recipe and the pages move with it and with nothing else
// (with the old wave restored these pins pass unchanged).
describe('the World payload: absent ⇒ byte-identical', () => {
  const h = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
  // the draw layers undone: the faces without `layer`; each packed part without `ranges`, its streams as the sorted list
  // of its triangles (a triangle: its corners' position, colour, joints and weights, byte for byte)
  const trianglesOf = (part) => { const s = { pos: 36, col: 9, jnt: 12, wgt: 48 }, B = Object.fromEntries(Object.keys(s).map((k) => [k, Buffer.from(part[k], 'base64')])); return Array.from({ length: part.faces }, (_, t) => Object.entries(s).map(([k, n]) => B[k].subarray(n * t, n * (t + 1)).toString('hex')).join('')).sort(); };
  const unlayered = (p) => ({ ...p, faces: p.faces.map(({ layer: _layer, ...f }) => f), ...(p.figures ? { figures: Object.fromEntries(Object.entries(p.figures).map(([k, f]) => [k, { ...f, parts: f.parts.map((q) => { if (!q) return q; const { ranges: _r, pos: _p, col: _c, jnt: _j, wgt: _w, ...rest } = q; return { ...rest, triangles: h(trianglesOf(q)) }; }) }])) } : {}) });
  const world = async (manifest, opts = {}) => (await resolveWorldScene({ ref: 'x', title: 't', manifest }, opts)).payload;
  // CLIP TIMING undone (hero-gesture.js heroClipSeconds, station-loft-rig packLayeredRig `seconds`): every packed clip
  // without the designed duration `s` the anime hero's clips carry — nothing else of the payload moves with it
  const untimed = (p) => (p.figures ? { ...p, figures: Object.fromEntries(Object.entries(p.figures).map(([k, f]) => [k, { ...f, clips: Object.fromEntries(Object.entries(f.clips).map(([c, { s: _s, ...clip }]) => [c, clip])) }])) } : p);
  // THE ANIME WAVE undone (hero-form.js ANIME_WAVE, put over the form's `wave` by the humanoid starter under the anime
  // head): the manifest with the form's own wave back in its place (every other head's) — nothing else moves with it
  const FORM_WAVE = heroPlan({ cast: 'male' }).clips.wave;
  const formWave = (m) => ({ ...m, ...(m.plan ? { plan: { ...m.plan, clips: { ...m.plan.clips, wave: FORM_WAVE } } } : {}), recipe: { ...m.recipe, clips: { ...m.recipe.clips, wave: FORM_WAVE } } });
  const plan = {
    schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' }, joints: { hip: [0.2, 0, 1], knee: [0.22, 0.1, 0.5], toe: [0.22, 0.3, 0.05] },
    segments: [
      { name: 'torso', kind: 'trunk', stations: [{ z: 0.9, r: [0.3, 0.22] }, { z: 1.3, r: [0.32, 0.24] }, { z: 1.7, r: [0.2, 0.16] }], caps: { back: [0, 0, 0.8], tip: [0, 0, 1.8] }, mirror: 'plane' },
      { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.14, rB: 0.1, mirror: 'name' },
      { name: 'shinR', kind: 'segment', from: 'knee', to: 'toe', rA: 0.1, rB: [0.08, 0.04], over: [0.6, 0.3], mirror: 'name' },
    ],
  };
  const PINS = {
    planBiped: [() => expandLayeredManifest({ kind: 'layered', plan }), ['a645ae390d3b0fbf', 'a33a830d8af3f744', 'f1b33d48167b8855']],
    // the heroes on the streamlined core: these pin the light's absence, and predate the structured core (DEFAULT_CORE),
    // whose own payloads are pinned below
    landmarkMale: [() => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', core: 'streamlined' }) }), ['50f693843ceb2e44', '5af15b7c932e1e27', 'c499ac73612000db']],
    landmarkFemaleLowpoly: [() => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', register: 'lowpoly', core: 'streamlined' }) }), ['80ca1bf8963729c4', 'a331848f2c2bd5c4', 'af946a02d6dee4f2']],
    headNone: [() => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'none', core: 'streamlined' }) }), ['9284e50464c3a412', '00ab4889f9c168a6', '0e6eb7d4107141c3']],
  };
  // THE STRUCTURED CORE (hero-form.js DEFAULT_CORE: the pelvis bone and part, converged legs, the stands' own base): the
  // default heroes' payloads, pinned; each one at core: 'streamlined' is the value pinned beside it above, still. Re-pinned
  // for the structured torso and bust (hero-form.js TORSO_FORM, BUST_FORM), and for the bare body (the dense torso and
  // pelvis, TORSO_SCULPT and the seat, the chest layers CHEST_FORM, the hem without the shirt's overlap), and for the
  // pectorals meeting as one domed chest and the breast sampled from its field (breast-field.js), then for the female's
  // breasts closer together, pointing forward, rising out of her upper chest's fill, then for the pair meeting in the
  // cleft's valley (breast-field.js `cleft`) with the décolletage unfilled and her upper pole a longer ramp, then for
  // the neck rising out of the chest, the trapezius sloping, the deltoid's dome (hero-form.js NECK_ROOT) and, under the
  // anime head, the neck's shade the jaw's shadow, then for the deltoid's belly, the landmark head's nape loft and the
  // pectoral's top along the clavicle, then for the seat (the female's deeper, its cleft in the second shade: SEAT_CLEFT;
  // the male's square) and the structured speedo and thong, then for the seat's panels (seat-panels.js: the thong's V
  // and thin string, the speedo's leg line, cut out of the faces) and the female's seat full low, then for the hand
  // (hero-hand.js: a palm and five digits for the mitten, the rig's `hands`), then for the forearm tapering into the hand
  // at a rounded wrist, then for the arm's muscles (the triceps and biceps rings, the elbow, the forearm slimming to the
  // wrist), then for the legs' (the quadriceps, hamstrings and the ring above the knee, the calf, the slim ankle); the
  // streamlined values above unchanged
  it('the structured core (the default): the heroes\' payloads, pinned', async () => {
    const S = { landmarkMale: [{ cast: 'male' }, ['a54fb8f5f7fb7345', 'fb3aa75dba910a15', '5ed152e7de9d30d9']],
      landmarkFemaleLowpoly: [{ cast: 'female', register: 'lowpoly' }, ['6777f1dcaae5e22c', '8721ae3dae0ce190', '8726272326d1025e']],
      headNone: [{ cast: 'female', head: 'none' }, ['cd4fba2202acc2ec', '348fad58732efa0d', '9ae3db683a366a18']] };
    for (const [name, [spec, [plain, toon, unshaded]]] of Object.entries(S)) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
      expect(h(await world(m)), name).toBe(plain); expect(h(await world({ ...m, toon: { bands: 3, ink: true } })), name).toBe(toon); expect(h(await world(m, { unshaded: true })), name).toBe(unshaded);
    }
    for (const [cast, pin] of [['female', '185596bc0a50e96e'], ['male', '1270432ca11f495f']]) expect(h(await world(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime' }) }))), `anime ${cast}`).toBe(pin);
  }, 90000);
  for (const [name, [make, [plain, toon, unshaded]]] of Object.entries(PINS)) {
    it(`${name}: plain, toon and unshaded`, async () => {
      const m = make();
      expect(h(await world(m))).toBe(plain);
      expect(h(await world({ ...m, toon: { bands: 3, ink: true } }))).toBe(toon);
      expect(h(await world(m, { unshaded: true }))).toBe(unshaded);
    });
  }
  // The anime hero as the door made it before the HAIR BASES (anime-head ANIME_HAIR_BASE, applied by the door through
  // composeAnime): the studio's hair and one palette for both casts (Hair #644634), and the character light before the
  // hair's value design (the Hair step at 0.25, its shade the RGB multiplier [0.62, 0.62, 0.76], no highlight). With these
  // inputs today's code gives every value pinned before the hair bases, so those are all that moved the pins below; and
  // with the form's own wave, which the anime wave (hero-form.js ANIME_WAVE) replaced after them.
  const beforeHairBase = (spec) => {
    const hero = heroRecord(spec), eff = composeAnime(hero, animeDefaultStyle(hero.cast));
    const plan = withGestureClip(humanoidPlan({ preset: hero.cast, register: hero.register, tune: eff.tune, body: {}, girth: 1, head: 'anime', face: eff.face, hair: eff.hair, expression: eff.expression, sculpt: eff.sculpt, palette: { Hair: '#644634', Ink: '#16181c' }, ...(hero.core ? { core: hero.core } : {}) }), resolveGesture(heroGesture(hero), hero.cast, { core: hero.core }));
    return expandLayeredManifest({ kind: 'layered', hero, plan: { ...plan, clips: { ...plan.clips, wave: FORM_WAVE } } }, { from: 'plan' });
  };
  const lightBefore = { thresholds: { Hair: 0.25 }, shade: { Hair: rgbToHex(hexToRgb('#644634').map((v, k) => v * [0.62, 0.62, 0.76][k])) }, highlight: false };
  it('the anime hero: unshaded and toon.light false are the old bake; the default steps', async () => {
    // standing at rest (`gesture: 'rest'`: no stand clip, the bind pose). Re-pinned for the anime hero's own PALETTE
    // (layered.js ANIME_HERO_PALETTE: the hair lifted, the strokes darker): these are the values the code before the
    // character light gives for the same hero with that palette passed as its operator palette — the Lambert bake
    // exactly, the light never reaching the unshaded export or a `light: false` row. The light stays off the payload.
    // On the studio's face (`sculpt: false`): the graphic face is another of the anime hero's defaults.
    // Re-pinned for the female neck form (hero-form.js ANIME_NECK_FORMS: the neck a ring loft rising into the occiput):
    // with the segment neck in its place the hero gives 5327a5ac4e4635a5 / e37584fef73693f7, the values before it.
    // Re-pinned for the female hair base (anime-head ANIME_HAIR_BASE: the lifted, thicker ridge-section form and the
    // side-parted cut) and her hair colour (#3b4859, layered.js ANIME_HERO_PALETTE): the hero as the door made it before
    // them (beforeHairBase) gives 996d63140c2c8f92 / c70c1f68db57186d, the values before them, still.
    // Re-pinned for her hair colour lifted to L* 35 (#465365, layered.js ANIME_HERO_PALETTE, so her shade side parts from
    // the World's backdrop): with #3b4859 passed as her operator palette she gives 273c66c9558cca14 / 82226dddadb7a263,
    // the values before it, still.
    // Re-pinned for CLIP TIMING (hero-gesture.js heroClipSeconds: every packed clip of the anime hero carries its designed
    // duration `s`, station-loft-rig packLayeredRig `seconds`): `untimed` drops exactly that, and each payload here
    // hashes the value before it, still (f3aec022ea5b2d63 / 437cd1cd36b08c58).
    // Re-pinned for the ANIME WAVE (hero-form.js ANIME_WAVE: the packed `wave` clip): with the form's wave back in its
    // place (formWave) each payload hashes the value before it, still (397626ea24a83220 / 1c387481453f8328).
    // Re-pinned for the hero's `wave` clip keeping its elbow at the shoulder line (hero-form.js): the form's wave that
    // formWave puts back is that one now, so untimed each payload hashes the values that re-pin gave (ea41b45ae2f53fcd /
    // 2c05de0b1d383565), still; the anime hero's own payloads never move with it (ANIME_WAVE replaces the form's).
    // (on the streamlined core: the chain above predates the structured core, DEFAULT_CORE, pinned below)
    const spec = { cast: 'female', head: 'anime', gesture: 'rest', sculpt: false, core: 'streamlined' };
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
    const plainBake = await world(m, { unshaded: true });
    expect(h(plainBake)).toBe('483d4a95853df858'); expect(h(untimed(plainBake))).toBe('8854b560f6965ca2');
    const off = await world({ ...m, toon: { light: false } });
    expect(off.toon).toBeUndefined(); expect(h(off)).toBe('f2e3b5bf99df4b96'); expect(h(untimed(off))).toBe('65ff2977c52b5cca');
    const plainWas = await world(formWave(m), { unshaded: true }), offWas = await world({ ...formWave(m), toon: { light: false } });
    expect(h(plainWas)).toBe('397626ea24a83220'); expect(h(untimed(plainWas))).toBe('ea41b45ae2f53fcd');
    expect(h(offWas)).toBe('1c387481453f8328'); expect(h(untimed(offWas))).toBe('2c05de0b1d383565');
    const was = formWave(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ ...spec, palette: { Hair: '#3b4859' } }) }));
    expect(h(untimed(await world(was, { unshaded: true })))).toBe('273c66c9558cca14'); expect(h(untimed(await world({ ...was, toon: { light: false } })))).toBe('82226dddadb7a263');
    const before = beforeHairBase(spec);
    expect(h(untimed(await world(before, { unshaded: true })))).toBe('996d63140c2c8f92'); expect(h(untimed(await world({ ...before, toon: { light: false } })))).toBe('c70c1f68db57186d');
    const lit = await world(m);
    expect(h(lit)).not.toBe('c07a8da432d22b96'); expect(lit.faces.length).toBeGreaterThan(off.faces.length);
    // the packed rig figure takes the same pieces (station-loft-rig characterRigParts): the skeleton and the clips
    // stand, the parts carry the palette, the step and the split; station-loft-rig.light.test.js checks them
    const { preview, parts, ...rig } = lit.figures.body; const { preview: p0, parts: parts0, ...rig0 } = off.figures.body;
    expect(rig).toEqual(rig0); expect(parts).not.toEqual(parts0); expect(preview).toEqual({ ...p0, ink: true });
  });
  // The anime hero's default World payload, pinned: the character light's pieces on the static faces and on the rig pack
  // (characterLitPieces, shared by characterLitFaces and packLayeredRig `character`, joints and weights lerped at the
  // split) and the character ink on payload.toon (characterInk: the silhouette hull at CHARACTER_INK_WIDTH × height).
  // sha256(JSON.stringify(payload)), first 16 hex digits. The anime hero stands `relaxed` by default (hero-gesture.js):
  // the static solid is skinned at its `gesture` clip, the light baked on the posed mesh with the head's parts in their
  // own frame (rigidParts), the pack re-placing those pieces on the rest mesh (piecesAt), the preview opening on the
  // solid; `gesture: 'rest'` is the bind pose. Re-pinned for the default key on the figure's right, the fan weld, the
  // head capsule and neck cylinder proxies, the length-snapped split, the shade multipliers, the anime hero's own
  // palette and the relaxed stand's bent near arm. Re-pinned for the graphic face (anime-sculpt.js: the base's face layer,
  // the placed nose and its line, the lid bands, the lenses clipped by the lid with a catchlight, the brow blocks, the ink
  // named by key, the fringe flags); `sculpt: false` gives the values before it. Re-pinned for the neck form (hero-form.js
  // ANIME_NECK_FORMS: the neck a ring12 loft whose nape ring rises into the occiput on both casts, the male column at 1.2×
  // his cast's radius over the trapezius ring), the male base's rest carriage (headPitch −0.25: 3° instead of 6°) and the
  // neck occlusion rule (characterLitPieces: under the anime head the neck is always in shade). Re-pinned for the HAIR
  // BASES (anime-head ANIME_HAIR_BASE: the lift draped over the dome with the roots sunk and pinched, thicker sections,
  // the ridge section, no crown accents; the swept-back cut on the male, the side-parted cut on the female; the female's
  // hair colour #3b4859) and the hair's value design (vexar: the Hair step at 0.40; station-loft-shade: its shade derived
  // by value, derivedShade, and its highlight, a second conforming split — the ring on the female, the fringe streak on
  // the male); the hero as the door made it before them, lit as before them, gave the values before them until the draw
  // layers below (92fb6be6420282a8 / 424d7ed8ad464289 / 99763a6cc2eaea5e, 8d8ccb2f955e582d / c16155bfff8df8d2 /
  // 618808f882bb8f2c).
  // Re-pinned for the DRAW LAYERS (station-loft-shade drawLayer: the static faces of the brows and lids carry `layer:
  // 'through'`, the fringe's `'veil'`, and with the character ink on every other hair face `'hair'`; the rig pack orders
  // the parts holding them [plain | hair | veil | marks | through] with `ranges`, station-loft-rig characterRigParts —
  // the World page's stencil rules, channels/draw-layers.js). `unlayered` undoes exactly that (the faces without
  // `layer`, each packed part as the sorted list of its triangles); undone, every payload here hashes what the code
  // before the layers gave for it undone the same way (7c1292c27097242a / 0e6495901e04b8ae / fc24ee5499afe5b0,
  // 48826ef552f238f3 / da8c3350991d51a1 / bf626afe973fbd73), and the hero before the hair bases too (daac23168b144fc8,
  // 2afb8fb5408bc04f: its payload was 92fb6be6420282a8 / 8d8ccb2f955e582d before the layers).
  // Re-pinned for the hair's value against the backdrop and its sheen (station-loft-shade: the derived hair shade floored
  // at L* 20.5, derivedShade; the derived highlight a quarter of the way to white, derivedHighlight; the ring's edges
  // from the position alone, a crescent facing the key; the HAIR'S TOP PLANES, a hair corner's N·L gaining 0.8 of its
  // normal's upward share under the anime head; the female's hair colour lifted to L* 35, #465365), the hair form's dome
  // (anime-form `dome`: the skull's own top seen from inside it, not a sphere), the male hair base (anime-head
  // ANIME_HAIR_BASE / the swept-back cut: the crown lift 0.12, the crest's tips laid onto the mass, the hairline lower) and
  // the graphic base (anime-sculpt GRAPHIC_BASE: the ear raised to span the eye level to the nose tip, the female's nose
  // line longer and hooked); the layers undone, the six values above are the ones before these. The hero before the hair
  // bases, lit as before them, takes the top planes, the ear and the nose line too (bf934d9e455fe93d / fa28e13ac632c3f8;
  // daac23168b144fc8 / 2afb8fb5408bc04f before them).
  // the hair's value design on the World's own faces: at the three-quarter view (the camera 45° off the front on the key's
  // side, 4° up, over the head), 65–85 % of the hair a viewer sees is on the lit side (its base tone or its highlight),
  // with designed shade shapes under the locks; the highlight a small share of the lit hair
  // and from the rear three-quarter camera (the gameplay view: behind on the key's side, 20° down) the hair's top planes
  // keep more than a quarter of what a viewer sees lit, the crown and the upper back (this wide frame reads the female at
  // about 0.30 and the male near 0.5; the key alone left the female about a sixth)
  it('the hair at the three-quarter view: 65–85 % lit, the highlight a small share of it; at the rear three-quarter over a quarter (female and male)', async () => {
    for (const cast of ['female', 'male']) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime' }) }), P = m.recipe.palette;
      const faces = (await world(m)).faces.filter((f) => !f.studio), hi = derivedHighlight(P.Hair), shade = derivedShade('Hair', P.Hair);
      const tone = (f) => (f.fill === P.Hair ? 'lit' : f.fill === hi ? 'hi' : f.fill === shade ? 'shade' : null);
      const top = Math.max(...faces.filter(tone).flatMap((f) => f.corners.map((c) => c[2])));
      const src = { vertices: [], faces: [] }, kind = [];
      for (const f of faces) { if (Math.min(...f.corners.map((c) => c[2])) < top - 0.45) continue; const b = src.vertices.length; src.vertices.push(...f.corners); src.faces.push([b, b + 1, b + 2]); kind.push(tone(f)); }
      const seen = (az, el) => { const R = rasterDepth(src, viewCamera(src, az, { elevationDegrees: el }), 320), n = { lit: 0, hi: 0, shade: 0 }; for (const fi of R.face) if (fi >= 0 && kind[fi]) n[kind[fi]]++; return n; };
      const n = seen(135, 4), lit = (n.lit + n.hi) / (n.lit + n.hi + n.shade);
      expect(lit, cast).toBeGreaterThanOrEqual(0.65); expect(lit, cast).toBeLessThanOrEqual(0.85);
      expect(n.hi, cast).toBeGreaterThan(0); expect(n.hi / (n.lit + n.hi), cast).toBeLessThan(0.15);
      const r = seen(45, 20); expect((r.lit + r.hi) / (r.lit + r.hi + r.shade), `${cast} at the rear three-quarter`).toBeGreaterThanOrEqual(0.27);
    }
  }, 60000);
  // Re-pinned for CLIP TIMING (hero-gesture.js heroClipSeconds: every packed clip of the anime hero carries its designed
  // duration `s`, station-loft-rig packLayeredRig `seconds`, which the World page's clip preview plays): TIMED holds the
  // payloads; `untimed` drops exactly the `s`, and undone each payload hashes the value before it (PINS), still.
  // Re-pinned for the ANIME WAVE (hero-form.js ANIME_WAVE: the packed `wave` clip): WAVED holds the payloads; with the
  // form's wave back in its place (formWave) each payload hashes TIMED, and the chain above, still. TIMED and PINS were
  // re-pinned for the form's `wave` keeping its elbow at the shoulder line (hero-form.js): WAVED never moved with it.
  // Re-pinned for DMATH (the anime head, the hero form and the station-loft modules take their transcendentals from
  // util/dmath.js, and the shared figure rig runs under withMath): the female chain moved, from values only macOS
  // arm64 on Node 24 produced; the male chain and the hair-base pins did not.
  it('the anime hero default, pinned (female and male)', async () => {
    const PINS = [['female', ['ffb8d37bc08d16ba', 'f5deaea4120a546a'], ['4c3754af7646aa9e', '2887b27d6e938552'], ['1fdf3c90d77c935c', '755ab3593db17ff7']],
      ['male', ['15e57c4bc1d8a1f8', '8864f3e9d7b7c517'], ['0673f3eb6d1583e6', '29b93ac1aab62c1b'], ['43893c06763875ef', '7d7cba2a0afad84e']]];
    const TIMED = { female: ['2585a16cdc02ae53', 'ad90336ddc2cc553', '2ff2e9f55796d955'], male: ['02ff3e82a4b572fd', '12d7111ddfb7c054', 'faeb81c5005442a7'] };
    const WAVED = { female: ['a0cf31d82d429668', '920af4172d6e2312', '1e426997d5069890'], male: ['64fd9335f413ea62', '772bb0116544418e', '7340f7e2c9471d44'] };
    for (const [cast, pin, rest, studio] of PINS) {
      for (const [i, [spec, [full, undone], label]] of [[{}, pin, cast], [{ gesture: 'rest' }, rest, `${cast} at rest`], [{ sculpt: false }, studio, `${cast} on the studio's face`]].entries()) {
        // (on the streamlined core: the chain predates the structured core, DEFAULT_CORE, pinned below)
        const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime', ...spec, core: 'streamlined' }) });
        expect(h(await world(m)), `${label}, waved`).toBe(WAVED[cast][i]);
        const payload = await world(formWave(m));
        expect(h(payload), label).toBe(TIMED[cast][i]);
        expect(h(untimed(payload)), `${label}, untimed`).toBe(full); expect(h(unlayered(untimed(payload))), `${label}, untimed, the layers undone`).toBe(undone);
      }
    }
    for (const [cast, before] of [['female', 'bf934d9e455fe93d'], ['male', 'fa28e13ac632c3f8']]) {
      const m = beforeHairBase({ cast, head: 'anime', core: 'streamlined' });
      expect(h(unlayered(untimed(await world({ ...m, toon: { light: lightBefore } })))), `${cast} before the hair bases, untimed, the layers undone`).toBe(before);
    }
  }, 90000);
});
