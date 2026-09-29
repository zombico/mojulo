import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { packLayeredRig } from './station-loft-rig.js';
import { characterLitPieces, characterInk, CHARACTER_INK_WIDTH, derivedShade, derivedHighlight } from './station-loft-shade.js';
import { resolveToonLight, hexToRgb, rgbToHex } from './vexar.js';
import { faceColorLinear } from '../figures/face-mesh.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { inkBuried } from '../scene/ink-geometry.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

// The rig pack under the character light (station-loft-rig.js characterRigParts): the same pieces the static
// solid shows — palette, two-tone step, conforming split — with joints and weights carried through the split
// the way the position went; and the character ink the layered kind puts on the payload beside it.

const h = (x) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const u8 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const lin8 = (hex) => faceColorLinear({ fill: hex }).map((v) => { const x = v * 255; return x <= 0 ? 0 : x >= 255 ? 255 : (x + 0.5) | 0; }).join(',');
/** a packed part's triangles, each its corners' position, colour, joints and weights byte for byte, sorted (its order undone) */
const trianglesOf = (part) => { const s = { pos: 36, col: 9, jnt: 12, wgt: 48 }, B = Object.fromEntries(Object.keys(s).map((k) => [k, Buffer.from(part[k], 'base64')])); return Array.from({ length: part.faces }, (_, t) => Object.entries(s).map(([k, n]) => B[k].subarray(n * t, n * (t + 1)).toString('hex')).join('')).sort(); };
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };

/** a UV sphere (radius 1) as a compiled-mesh-shaped object, a palette group per face from `groupOf(band)` */
function sphere({ lat = 12, lon = 18, groupOf = () => 'Skin' } = {}) {
  const vertices = [[0, 0, 1]]; const ring = [];
  for (let i = 1; i < lat; i++) { const th = (i * Math.PI) / lat; ring.push([]); for (let j = 0; j < lon; j++) { const ph = (j * 2 * Math.PI) / lon; ring[i - 1].push(vertices.length); vertices.push([Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th)]); } }
  const bottom = vertices.length; vertices.push([0, 0, -1]);
  const faces = [], groups = [];
  const put = (t, band) => { faces.push(t); groups.push(groupOf(band)); };
  for (let j = 0; j < lon; j++) put([0, ring[0][j], ring[0][(j + 1) % lon]], 0);
  for (let i = 0; i + 1 < ring.length; i++) for (let j = 0; j < lon; j++) {
    const a = ring[i][j], b = ring[i + 1][j], c = ring[i + 1][(j + 1) % lon], d = ring[i][(j + 1) % lon];
    put([a, b, c], i + 1); put([a, c, d], i + 1);
  }
  for (let j = 0; j < lon; j++) put([bottom, ring[ring.length - 1][(j + 1) % lon], ring[ring.length - 1][j]], lat - 1);
  return { vertices, faces, groups, provenance: vertices.map(() => ({ part: 'ball', layer: 1 })), parts: { ball: {} } };
}

describe('packLayeredRig — the character light on the rig pack', () => {
  // two bones along z; every vertex blends them LINEARLY in z (lo = (1 − z)/2, hi = (1 + z)/2), so a weight lerped
  // along any edge must land exactly on the same linear function at the split point
  const m = sphere({ groupOf: (band) => (band < 2 ? 'Iris' : 'Skin') });
  const skin = { joints: m.vertices.map(() => [0, 1, 0, 0]), weights: m.vertices.map((v) => [(1 - v[2]) / 2, (1 + v[2]) / 2, 0, 0]), dominant: m.vertices.map((v) => (v[2] > 0 ? 1 : 0)) };
  const R = { joints: { lo: [0, 0, -1], hi: [0, 0, 1] }, bones: [{ id: 'low', head: 'lo', tail: 'hi' }, { id: 'high', head: 'hi', tail: 'lo' }] };
  const light = resolveToonLight({ toLight: [1, 0, 0], threshold: 0.3 });   // the split runs down the meridian plane x = 0.3
  const palette = { Skin: '#d9a77e', Iris: '#4d6b6e' };
  const normals = m.faces.map((t) => t.map((vi) => unit(m.vertices[vi])));
  const fig = packLayeredRig(m, skin, R, { character: { light, palette, normals } });
  const corners = fig.parts.flatMap((P, bi) => { if (!P) return []; const p = f32(P.pos), w = f32(P.wgt), j = u8(P.jnt), c = u8(P.col); return Array.from({ length: p.length / 3 }, (_, i) => ({ bi, p: [p[3 * i], p[3 * i + 1], p[3 * i + 2]], w: [...w.subarray(4 * i, 4 * i + 4)], j: [...j.subarray(4 * i, 4 * i + 4)], c: `${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}` })); });

  it('absent is the plain path exactly; the attribute streams stay aligned', () => {
    expect(packLayeredRig(m, skin, R, { character: null })).toEqual(packLayeredRig(m, skin, R));
    for (const P of fig.parts) { if (!P) continue; const n = f32(P.pos).length / 3; expect(u8(P.col).length).toBe(3 * n); expect(u8(P.jnt).length).toBe(4 * n); expect(f32(P.wgt).length).toBe(4 * n); expect(n).toBe(3 * P.faces); }
    expect(packLayeredRig(m, skin, R, { character: { light, palette, normals } })).toEqual(fig);   // deterministic
  });
  it('colour: the palette stepped into two tones on the lit group, the unlit group at its base; no grey', () => {
    const cols = new Set(corners.map((c) => c.c));
    expect(cols.has(lin8(palette.Skin))).toBe(true); expect(cols.has(lin8(palette.Iris))).toBe(true); expect(cols.size).toBe(3);
    expect(cols.has(lin8('#8a8f96'))).toBe(false);
    for (const c of corners) if (c.c === lin8(palette.Skin)) expect(c.p[0]).toBeGreaterThanOrEqual(0.3 - 1e-6);   // the lit side of the plane
  });
  it('the skin at a split corner is the lerp of its edge: weights sum to 1 and follow the linear field; split corners exist', () => {
    let split = 0;
    for (const c of corners) {
      expect(Math.abs(c.w.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-6);
      const hi = c.w[c.j.indexOf(1)] ?? 0;
      expect(Math.abs(hi - (1 + c.p[2]) / 2)).toBeLessThan(2e-6);   // f32 positions and weights
      if (!m.vertices.some((v) => Math.hypot(v[0] - c.p[0], v[1] - c.p[1], v[2] - c.p[2]) < 1e-6)) split++;
    }
    expect(split).toBeGreaterThan(0);
  });
  it('the highlight\'s corner inside a triangle (bary) takes its corners\' skin by its weights: on the linear field, summing to 1', () => {
    // a ring on Skin whose line crosses the step's (x = 0.3) inside triangles; the group's own height is its band's frame
    const light2 = resolveToonLight({ toLight: [1, 0, 0], threshold: 0.3, highlight: { Skin: { kind: 'ring', threshold: 0.1, band: [0.3, 0.7], falloff: 1 } } });
    const pieces = characterLitPieces(m, { light: light2, palette, normals });
    expect(pieces.some((pc) => pc.refs.some((r) => r.bary))).toBe(true);
    const fig2 = packLayeredRig(m, skin, R, { character: { pieces } });
    let n = 0;
    for (const P of fig2.parts) {
      if (!P) continue; const p = f32(P.pos), w = f32(P.wgt), j = u8(P.jnt);
      for (let i = 0; i < p.length / 3; i++) { const W = [...w.subarray(4 * i, 4 * i + 4)], J = [...j.subarray(4 * i, 4 * i + 4)]; expect(Math.abs(W.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-6); expect(Math.abs((W[J.indexOf(1)] ?? 0) - (1 + p[3 * i + 2]) / 2)).toBeLessThan(2e-6); n++; }
    }
    expect(n).toBe(3 * pieces.length);
    expect(new Set(fig2.parts.flatMap((P) => { if (!P) return []; const c = u8(P.col); return Array.from({ length: c.length / 3 }, (_, i) => `${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}`); })).has(lin8(derivedHighlight(palette.Skin)))).toBe(true);
  });
  it('a piece rides its PARENT face\'s dominant bone; the marks (unlit groups) come last, counted out by inkFaces', () => {
    const pieces = characterLitPieces(m, { light, palette, normals });
    const vote = (fi) => { const up = m.faces[fi].filter((vi) => skin.dominant[vi] === 1).length; return up >= 2 ? 1 : 0; };
    const per = [0, 0]; for (const pc of pieces) per[vote(pc.fi)]++;
    expect(fig.parts.map((P) => (P ? P.faces : 0))).toEqual(per);
    for (const [bi, P] of fig.parts.entries()) {
      if (!P) continue;
      const c = u8(P.col); const marks = pieces.filter((pc) => pc.mark && vote(pc.fi) === bi).length;
      expect(P.inkFaces).toBe(P.faces - marks);
      for (let i = 0; i < c.length / 3; i++) expect(`${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}` === lin8(palette.Iris)).toBe(i >= 3 * P.inkFaces);
    }
  });
  it('draw layers: with the hair rule a part runs [plain | hair | marks] with `ranges.hair`; a flagged part\'s faces take its layer; none ⇒ the same pack', () => {
    const m2 = sphere({ groupOf: (band) => (band < 2 ? 'Iris' : band < 5 ? 'Hair' : 'Skin') }), pal2 = { ...palette, Hair: '#3b4859' };
    const plain = packLayeredRig(m2, skin, R, { character: { light, palette: pal2, normals } });
    expect(packLayeredRig(m2, skin, R, { character: { light, palette: pal2, normals, hairInk: false } })).toEqual(plain);
    expect(plain.parts.every((P) => !P || P.ranges === undefined)).toBe(true);
    const inked = packLayeredRig(m2, skin, R, { character: { light, palette: pal2, normals, hairInk: true } });
    const tones = new Set([pal2.Hair, derivedShade('Hair', pal2.Hair)].map(lin8));
    for (const [bi, P] of inked.parts.entries()) {
      if (!P) continue; const c = u8(P.col), col = (i) => `${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}`;
      expect([P.faces, P.inkFaces]).toEqual([plain.parts[bi].faces, plain.parts[bi].inkFaces]);
      const hairFaces = [...Array(P.faces).keys()].filter((t) => tones.has(col(3 * t))).length;
      if (!hairFaces) { expect(P.ranges).toBeUndefined(); expect(P).toEqual(plain.parts[bi]); continue; }
      expect(P.ranges).toEqual({ hair: [P.inkFaces - hairFaces, P.inkFaces] });
      for (let i = 0; i < 3 * P.faces; i++) expect(tones.has(col(i)), `part ${bi} corner ${i}`).toBe(i >= 3 * P.ranges.hair[0] && i < 3 * P.ranges.hair[1]);
    }
    expect(inked.parts.some((P) => P && P.ranges)).toBe(true);
    // a part flagged `through` / `veil` (the graphic face's brows and fringe) takes that layer whatever its group: the
    // veil inside the outlined faces after the hair, the through faces last, after the marks
    const flagged = { ...m2, parts: { ball: { through: 'fringe' } } };
    const thru = packLayeredRig(flagged, skin, R, { character: { light, palette: pal2, normals, hairInk: true } });
    for (const P of thru.parts) if (P) { expect(P.ranges).toEqual({ through: [0, P.faces] }); expect(P.inkFaces).toBe(0); }
    const veiled = packLayeredRig({ ...m2, parts: { ball: { veil: 'fringe' } } }, skin, R, { character: { light, palette: pal2, normals } });
    for (const [bi, P] of veiled.parts.entries()) if (P) { expect(P.ranges).toEqual({ veil: [0, P.inkFaces] }); expect([P.faces, P.inkFaces]).toEqual([plain.parts[bi].faces, plain.parts[bi].inkFaces]); }
  });
});

/** the packed rig's triangles, `[corners, colour]`, skinned at a clip's key the way the preview plays it (M·v = head' +
 * q·(v − restHead), blended by the vertex weights); `clip` null → the bind pose as packed */
function packedTriangles(fig, clip = null, key = 0) {
  const qm = ([x, y, z, w]) => { const l = Math.hypot(x, y, z, w); x /= l; y /= l; z /= l; w /= l; return [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]; };
  const frames = clip && fig.bones.map((b, j) => { const o = (key * fig.bones.length + j) * 7, B = fig.clips[clip].b; return { m: qm(B.slice(o, o + 4)), head: B.slice(o + 4, o + 7), rest: b.head }; });
  const out = [];
  for (const part of fig.parts) {
    if (!part) continue; const p = f32(part.pos), c = u8(part.col), J = u8(part.jnt), W = f32(part.wgt);
    const at = (i) => { const v = [p[3 * i], p[3 * i + 1], p[3 * i + 2]]; if (!frames) return v; const o = [0, 0, 0]; for (let k = 0; k < 4; k++) { const w = W[4 * i + k]; if (!w) continue; const f = frames[J[4 * i + k]]; const d = [v[0] - f.rest[0], v[1] - f.rest[1], v[2] - f.rest[2]]; for (let a = 0; a < 3; a++) o[a] += w * (f.head[a] + f.m[a][0] * d[0] + f.m[a][1] * d[1] + f.m[a][2] * d[2]); } return o; };
    for (let t = 0; t < p.length / 9; t++) out.push([[0, 1, 2].map((k) => at(3 * t + k)), `${c[9 * t]},${c[9 * t + 1]},${c[9 * t + 2]}`]);
  }
  return out;
}

describe('the anime hero: the rig pack and the ink take the character light by default', () => {
  const world = async (manifest, opts = {}) => (await resolveWorldScene({ ref: 'x', title: 't', manifest }, opts)).payload;
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime' }) });
  const P = m.recipe.palette; let lit, fig;
  beforeAll(async () => { lit = await world(m); fig = lit.figures.body; });

  it('the pack carries the static faces exactly: the same triangles in the same colours (the one pieces list)', async () => {
    // standing at rest (no stand clip), the pack's bind pose IS the static solid, bit for bit
    const still = await world(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', gesture: 'rest' }) }));
    const key = (p, c) => `${p.map((v) => Math.fround(v)).join(',')}|${c}`;
    const packed = packedTriangles(still.figures.body).map(([T, c]) => T.map((q) => key(q, c)).join(' '));
    const shown = still.faces.filter((f) => f.group === 'body').map((f) => f.corners.map((q) => key(q, lin8(f.fill))).join(' '));
    expect(packed.length).toBe(shown.length);
    expect(packed.sort()).toEqual(shown.sort());
  });
  it('standing in its gesture, the stand clip plays the static solid: every packed triangle skinned at it lands on a static face of its colour', () => {
    // the pieces were decided on the POSED mesh and re-placed at rest (piecesAt), so the packed key (q and head rounded
    // to 1e-4) skins them back onto the static faces, colour for colour: a mesh-vertex corner within a millimetre; a
    // corner the split made where the skin blends across a joint within a few (it skins with its LERPED weights, and a
    // linear blend of a lerp is not the lerp of the two blended ends — a second-order term, no crack: both faces of the
    // split edge share that corner). The clip rides the pack (the skinned and engine exports carry it); the page opens
    // on the static solid, which IS the stand (preview `solid: 'stand'`)
    expect(Object.keys(fig.clips)[0]).toBe('gesture'); expect(fig.clips.gesture.b.length).toBe(fig.clips.idle.b.length);
    const shown = lit.faces.filter((f) => f.group === 'body'); const tris = packedTriangles(fig, 'gesture', 0);
    expect(tris.length).toBe(shown.length);
    // matched corner for corner (the parent's winding, any start), candidates from a centroid grid
    const cen = (T) => [0, 1, 2].map((a) => (T[0][a] + T[1][a] + T[2][a]) / 3); const cell = 0.004; const ck = (p) => p.map((v) => Math.floor(v / cell)).join(',');
    const gap = (A, B) => Math.min(...[0, 1, 2].map((r) => Math.max(...[0, 1, 2].map((k) => Math.hypot(...A[k].map((v, a) => v - B[(k + r) % 3][a]))))));
    const grid = new Map(); shown.forEach((f, i) => { const k = ck(cen(f.corners)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); });
    const used = new Uint8Array(shown.length); let unmatched = 0, worst = 0, overMm = 0;
    for (const [T, col] of tris) {
      const [x, y, z] = cen(T).map((v) => Math.floor(v / cell)); let best = -1, bd = 5e-3;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (const i of grid.get(`${x + dx},${y + dy},${z + dz}`) || []) {
        if (used[i] || lin8(shown[i].fill) !== col) continue; const d = gap(T, shown[i].corners); if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) unmatched++; else { used[best] = 1; worst = Math.max(worst, bd); if (bd > 1e-3) overMm++; }
    }
    expect(unmatched).toBe(0); expect(worst).toBeLessThan(5e-3); expect(overMm / tris.length).toBeLessThan(0.01);
    // and the bind pose is NOT the stand: the static solid moved off the rest mesh
    expect(packedTriangles(fig).some(([T], i) => Math.hypot(...cen(T).map((v, a) => v - cen(tris[i][0])[a])) > 0.01)).toBe(true);
  });
  it('palette colours, two tones on Skin and Hair, no grey; weights valid everywhere', () => {
    const cols = new Set(); let grey = 0;
    for (const part of fig.parts) {
      if (!part) continue; const c = u8(part.col), w = f32(part.wgt), j = u8(part.jnt);
      for (let i = 0; i < c.length; i += 3) { const k = `${c[i]},${c[i + 1]},${c[i + 2]}`; cols.add(k); if (k === lin8('#8a8f96')) grey++; }
      for (let i = 0; i < w.length; i += 4) { expect(Math.abs(w[i] + w[i + 1] + w[i + 2] + w[i + 3] - 1)).toBeLessThan(1e-6); for (let k = 0; k < 4; k++) { expect(w[i + k]).toBeGreaterThanOrEqual(0); expect(j[i + k]).toBeLessThan(fig.bones.length); } }
    }
    expect(grey).toBe(0);
    const staticFills = new Set(lit.faces.filter((f) => f.group === 'body').map((f) => lin8(f.fill)));
    expect(cols).toEqual(staticFills);
    // two tones each: the base swatch and the derived shade (warm skin, the hair's by value) both reach the pack, and the
    // hair's third tone, its highlight (the female's ring), too
    for (const g of ['Skin', 'Hair']) { expect(cols.has(lin8(P[g]))).toBe(true); expect(cols.has(lin8(derivedShade(g, P[g])))).toBe(true); }
    expect(cols.has(lin8(derivedHighlight(P.Hair)))).toBe(true);
  });
  it('the marks come last in every part: the eye lenses, strokes and mouth take no outline', () => {
    const marks = new Set(['Iris', 'Pupil', 'Sclera', 'Ink', 'Mouth'].map((g) => lin8(P[g])));
    let counted = 0;
    for (const part of fig.parts) {
      if (!part) continue; const c = u8(part.col); expect(Number.isInteger(part.inkFaces)).toBe(true);
      for (let i = 3 * part.inkFaces; i < c.length / 3; i++) { expect(marks.has(`${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}`)).toBe(true); counted++; }
    }
    expect(counted / 3).toBe(lit.faces.filter((f) => f.noInk).length);
  });
  it('the character ink: silhouette only at a height-relative width; the preview inks its parts; the manifest can opt out or tune', async () => {
    expect(lit.toon).toEqual({ ink: { lines: false, widthAbs: Math.round(CHARACTER_INK_WIDTH * fig.figH * 1e5) / 1e5 } });
    // standing (hero-gesture.js): the page opens on the static solid, the stand skinned exactly (`solid: 'stand'`); the
    // one-key clip stays out of the picker (the rigidly moved parts would crack at the joints) and in the pack
    expect(fig.preview).toEqual({ clips: ['idle', 'walk', 'wave'], hide: 'body', period: 3, ink: true, solid: 'stand' });
    const off = await world({ ...m, toon: { ink: false } });
    expect(off.toon).toBeUndefined(); expect(off.figures.body.preview.ink).toBeUndefined();
    // off, the pack loses only the hair's own span (the hair outline's stencil rule needs the ink): the part holding it
    // is the same triangles with the hair back in its plain run; every other part is the same bytes
    fig.parts.forEach((q, i) => {
      const o = off.figures.body.parts[i];
      if (!q?.ranges?.hair) { expect(o).toEqual(q); return; }
      expect(o.ranges.hair).toBeUndefined(); expect([o.faces, o.inkFaces, o.ranges.veil, o.ranges.through]).toEqual([q.faces, q.inkFaces, q.ranges.veil, q.ranges.through]);
      expect(trianglesOf(o)).toEqual(trianglesOf(q));
    });
    expect((await world({ ...m, toon: { ink: { width: 0.01 } } })).toon.ink).toEqual({ lines: false, width: 0.01 });
    expect((await world({ ...m, toon: { bands: 3, ink: { lines: true, color: '#223344' } } })).toon).toEqual({ bands: 3, ink: { lines: true, widthAbs: lit.toon.ink.widthAbs, color: '#223344' } });
    expect(characterInk(true, 1.6)).toEqual({ lines: false, widthAbs: 0.0024 }); expect(characterInk(false, 1.6)).toBeNull();
    // the page: the rig preview's ink block and the static pair's silhouette-only attach, both gated
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    const html = emitThreeWorld(lit);
    for (const needle of ['function __rpInk(mesh, part, fig)', '__rpInk(mesh, part, fig);', "k.startsWith(pv.hide + ':')", 'scene.add(e.hull); __inkReg[grp.name] = e;',
      "(__rpParam === 'rest' || pv.solid === 'stand' ? null", "(pv.solid === 'stand' ? 'stand (the solid)' : 'rest (the solid)')"]) expect(html).toContain(needle);
    expect(html).not.toContain('scene.add(e.hull); scene.add(e.lines);');
    // the draw layers (channels/draw-layers.js): the stencil buffer, the layers block, the hair hulls' rule, the preview's layered parts
    for (const needle of ['logarithmicDepthBuffer: true, stencil: true }', '--- draw layers', 'if (grp.layer && __layerHull(e.hullMat, grp.layer)) e.hull.renderOrder = 3;', '__rpLayer(mesh, part, fig);']) expect(html).toContain(needle);
  });
  it('exports: the skinned GLB keeps its streams aligned and bakes the hull on the outlined faces only; the rigid GLB writes every part', () => {
    const read = (buf) => { const n = buf.readUInt32LE(12); return JSON.parse(buf.subarray(20, 20 + n).toString()); };
    const sk = read(facesToGlb({ ...lit, toon: { ink: lit.toon.ink, bake: true } }, { generator: 't', clips: '_all', skinned: true }).bytes);
    const [body, ink] = sk.meshes.find((x) => x.name === 'body:skinned').primitives;
    const count = (a) => sk.accessors[a].count;
    const V = fig.parts.reduce((s, part) => s + (part ? f32(part.pos).length / 3 : 0), 0);
    expect(count(body.attributes.POSITION)).toBe(V);
    for (const k of ['COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) expect(count(body.attributes[k])).toBe(V);
    const outlined = fig.parts.reduce((s, part) => s + (part ? part.inkFaces : 0), 0);
    expect(count(ink.attributes.POSITION)).toBeGreaterThan(0); expect(count(ink.attributes.POSITION)).toBeLessThanOrEqual(3 * outlined);
    expect(count(ink.attributes.JOINTS_0)).toBe(count(ink.attributes.POSITION)); expect(count(ink.attributes.WEIGHTS_0)).toBe(count(ink.attributes.POSITION));
    const rg = read(facesToGlb(lit, { generator: 't', clips: '_all' }).bytes);
    const rigParts = rg.meshes.filter((x) => x.name.startsWith('body:'));
    expect(rigParts).toHaveLength(fig.parts.filter(Boolean).length);
    for (const x of rigParts) expect(rg.accessors[x.primitives[0].attributes.COLOR_0].count).toBe(rg.accessors[x.primitives[0].attributes.POSITION].count);
  });
  it('the draw layers on the pack: the head part runs [plain | hair | veil | marks | through], its `ranges` the static layers', () => {
    const count = (layer) => lit.faces.filter((f) => f.layer === layer).length;
    const layered = fig.parts.map((q, i) => (q && q.ranges ? i : -1)).filter((i) => i >= 0);
    expect(layered.map((i) => fig.bones[i].id)).toEqual(['head']);   // every layered face rides the head bone
    const head = fig.parts[layered[0]], { hair, veil, through } = head.ranges;
    expect(Object.keys(head.ranges)).toEqual(['hair', 'veil', 'through']);
    expect(hair[1]).toBe(veil[0]); expect(veil[1]).toBe(head.inkFaces); expect(through[0]).toBeGreaterThan(head.inkFaces); expect(through[1]).toBe(head.faces);
    expect([hair[1] - hair[0], veil[1] - veil[0], through[1] - through[0]]).toEqual([count('hair'), count('veil'), count('through')]);
    // the colours by span: the hair and the veil in the hair's three tones, the through faces (brows, lids) in the ink's,
    // no hair tone before the hair span
    const c = u8(head.col), colsIn = ([a, b]) => new Set(Array.from({ length: 3 * (b - a) }, (_, i) => { const k = 3 * (3 * a + i); return `${c[k]},${c[k + 1]},${c[k + 2]}`; }));
    const tones = new Set([P.Hair, derivedShade('Hair', P.Hair), derivedHighlight(P.Hair)].map(lin8));
    for (const x of [...colsIn(hair), ...colsIn(veil)]) expect(tones.has(x)).toBe(true);
    for (const x of colsIn([0, hair[0]])) expect(tones.has(x)).toBe(false);
    expect(colsIn(through)).toEqual(new Set([lin8(P.Ink)]));
  });
  it('the baked ink cannot stencil: the hair\'s hull splits by layer and leaves out the buried shell (the culling count)', async () => {
    const read = (buf) => { const n = buf.readUInt32LE(12); return JSON.parse(buf.subarray(20, 20 + n).toString()); };
    // (re-counted for the hair's top planes, which split more of the mass, the dome drape and the male hair base's crest)
    for (const [cast, buried, hull] of [['female', 745, 6980], ['male', 1466, 8196]]) {
      const p = cast === 'female' ? lit : await world(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, head: 'anime' }) }));
      // the hair class (hair and veil faces together, each its own closed part): its buried triangles, the culling count
      const soup = Float32Array.from(p.faces.filter((f) => f.layer === 'hair' || f.layer === 'veil').flatMap((f) => f.corners.flat()));
      expect(inkBuried(soup).reduce((a, b) => a + b, 0), cast).toBe(buried);
      // the static GLB with the baked ink: a hull node per render group, as the World page splits them; the hair's two
      // hulls carry the soup's triangles less the degenerate and the buried
      const g = read(facesToGlb({ ...p, toon: { ink: p.toon.ink, bake: true } }, { generator: 't' }).bytes);
      const tris = (name) => { const node = g.nodes.find((n) => n.name === name); return g.meshes[node.mesh].primitives.reduce((s, q) => s + g.accessors[q.indices ?? q.attributes.POSITION].count / 3, 0); };
      expect(g.nodes.map((n) => n.name).filter((n) => /:ink$/.test(n))).toEqual(['body:ink', 'body:hair:ink', 'body:veil:ink']);
      expect(tris('body:hair:ink') + tris('body:veil:ink'), cast).toBe(hull);
      expect(hull).toBeLessThanOrEqual(soup.length / 9 - buried);
    }
  }, 60000);
  it('deterministic', async () => {
    expect(h((await world(m)).figures)).toBe(h(lit.figures));
  });
});

// Every other rigged recipe keeps its pack, its page and its exports byte for byte: pins recorded BEFORE the character
// light reached the rig pack and the ink (sha256, first 16 hex digits) — the dragon body (plain, and with hullShade +
// rim), a landmark hero's World page with toon ink (the rig preview and the ink channel stay ungated), and its skinned
// GLB with the baked ink. Each page pin takes one of two values: the page as it was, and the same page with the clip
// picker tagged by its capture hide class (`sel.className = 'rig-preview'`, capture-contract WORLD_HIDE_SELECTORS),
// a separate change to the rig preview channel; drop the first value once both have landed. The landmark hero's pair was
// re-pinned for the hero's `wave` clip keeping its elbow at the shoulder line (hero-form.js): both values, the second
// with that picker tag applied.
const DRAGON_BODY = path.resolve(process.cwd(), '../docs/examples/dragon-body/recipe.json');
describe('absent ⇒ byte-identical: the rig packs, pages and exports of every non-anime rigged recipe', () => {
  const world = async (manifest) => (await resolveWorldScene({ ref: 'x', title: 't', manifest }, {})).payload;
  it.skipIf(!existsSync(DRAGON_BODY))('the dragon body: the pack, plain and with hullShade + rim; the inked page', async () => {
    const m = { kind: 'layered', recipe: JSON.parse(readFileSync(DRAGON_BODY, 'utf8')) };
    expect(h((await world(m)).figures)).toBe('a111baa05193a10d');
    expect(h((await world({ ...m, hullShade: true, rim: [0.4, 0.6, 1, 0.5, 3] })).figures)).toBe('73694e6795405771');
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    expect(['00a711c37ca1f545', 'f5ab736433ae2b04']).toContain(h(emitThreeWorld(await world({ ...m, toon: { ink: true } }))));
  });
  it('a landmark hero: the inked page; the skinned GLB with the baked ink', async () => {
    const { emitThreeWorld } = await import('../scene/scene-three.js');
    expect(['0adb8ae46508117e', '1137ac00c4fe7415']).toContain(h(emitThreeWorld(await world({ ...expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male' }) }), toon: { ink: true } }))));
    const f = await world({ ...expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female' }) }), toon: { ink: { crease: 50 }, bake: true } });
    expect(createHash('sha256').update(facesToGlb(f, { generator: 't', clips: '_all', skinned: true }).bytes).digest('hex').slice(0, 16)).toBe('818fd9f23039d014');
  });
});
