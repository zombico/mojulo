// scene-gltf.face.test.js — the skinned GLB's FACE (addSkinnedRigFigure; anime-face-rig.js through the rig pack's `morph`):
// on a lowpoly anime hero the body and ink primitives carry one sparse POSITION target per face target, POSITION is the
// neutral head, mesh.weights the authored face and mesh.extras the words; the default weights put back the stored face;
// every other attribute, the ink and the clips are the bytes of the export without the face; a hero whose own lid closure
// sits between the knots carries its own corrective pair. A landmark hero and the head-none hero resolve to the same
// bytes with the face asked for, the bytes they wrote before the face; export_model's skinned path reports the face.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-glb-face-outcomes-'));

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { exportModelHandler } from '../../mcp/tools/sketch-model-export.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { FACE_TARGETS, faceWeights, faceState } from '../polygonizer/anime-face-rig.js';
import { resolveAnimeExpression } from '../polygonizer/anime-head.js';

const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }, SZ = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
const glbOf = (bytes) => { const jl = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), bin: bytes.subarray(28 + jl) }; };
const viewBytes = (G, a, n) => { const bv = G.json.bufferViews[a.bufferView]; const o = (bv.byteOffset || 0) + (a.byteOffset || 0); return G.bin.subarray(o, o + n); };
/** an accessor's own data bytes (a tightly packed view range) */
const bytesOf = (G, i) => { const a = G.json.accessors[i]; return viewBytes(G, a, a.count * NC[a.type] * SZ[a.componentType]); };
/** a float accessor, dense: its view (or zeros), then its sparse substitution */
function floats(G, i) {
  const a = G.json.accessors[i], n = NC[a.type], out = new Float64Array(a.count * n);
  if (a.bufferView !== undefined) { const b = bytesOf(G, i); for (let k = 0; k < out.length; k++) out[k] = b.readFloatLE(k * 4); }
  if (a.sparse) { const ix = viewBytes(G, { bufferView: a.sparse.indices.bufferView }, a.sparse.count * 4), vx = viewBytes(G, { bufferView: a.sparse.values.bufferView }, a.sparse.count * n * 4); for (let k = 0; k < a.sparse.count; k++) { const v = ix.readUInt32LE(k * 4); for (let c = 0; c < n; c++) out[v * n + c] = vx.readFloatLE((k * n + c) * 4); } }
  return out;
}
const sparseIds = (G, a) => { const ix = viewBytes(G, { bufferView: a.sparse.indices.bufferView }, a.sparse.count * 4); return Array.from({ length: a.sparse.count }, (_, k) => ix.readUInt32LE(k * 4)); };
const skinnedGlb = async (manifest, opts = {}) => { const { payload } = await resolveWorldScene({ ref: 'glb-face', title: 'glb face', manifest }, opts); return facesToGlb(payload, { generator: 'mojulo glb-face', clips: '_all', skinned: true, ...(opts.unshaded ? { lit: true } : {}) }); };

// the lowpoly anime hero, its toon ink baked into the GLB (the skinned mesh's second primitive), an authored face off the neutral
const ANIME = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', head: 'anime', register: 'lowpoly', expression: ['smile', { open: 0.3 }] }), toon: { bake: true, ink: true } });

describe('the skinned GLB carries the anime face', () => {
  it('17 sparse targets on both primitives, the authored weights, the extras; the default weights put back the stored face; the rest byte for byte', async () => {
    const face = await skinnedGlb(ANIME, { face: true }), plain = await skinnedGlb(ANIME);
    expect(face.faceFigures).toEqual(['body']); expect(plain.faceFigures).toBeUndefined();
    const G = glbOf(face.bytes), N = glbOf(plain.bytes);
    const mesh = G.json.meshes.find((m) => m.name === 'body:skinned'), nMesh = N.json.meshes.find((m) => m.name === 'body:skinned');
    expect(mesh.primitives.length).toBe(2);
    const [body, ink] = mesh.primitives, [nBody, nInk] = nMesh.primitives, nV = G.json.accessors[body.attributes.POSITION].count;
    // the structure: a target per face target on each primitive, sparse (ascending, in range, views without a target)
    for (const p of mesh.primitives) {
      expect(p.targets.length).toBe(FACE_TARGETS.length);
      const count = G.json.accessors[p.attributes.POSITION].count;
      for (const t of p.targets) {
        const a = G.json.accessors[t.POSITION];
        expect(a.count).toBe(count); expect(a.type).toBe('VEC3'); expect(a.bufferView).toBeUndefined();
        if (!a.sparse) { expect([a.min, a.max]).toEqual([[0, 0, 0], [0, 0, 0]]); continue; }
        const ids = sparseIds(G, a); expect(ids.every((v, k) => v < count && (k === 0 || v > ids[k - 1]))).toBe(true);
        for (const v of [a.sparse.indices.bufferView, a.sparse.values.bufferView]) expect(G.json.bufferViews[v].target).toBeUndefined();
      }
    }
    expect(new Set(ink.targets.map((t) => t.POSITION)).size).toBe(1);
    expect(G.json.accessors[ink.targets[0].POSITION].sparse).toBeUndefined();
    const moving = body.targets.filter((t) => G.json.accessors[t.POSITION].sparse).length;
    expect(moving).toBe(FACE_TARGETS.length);
    const authored = faceWeights(faceState(resolveAnimeExpression(['smile', { open: 0.3 }])));
    expect(mesh.weights).toEqual(authored);
    expect(mesh.extras.targetNames).toEqual([...FACE_TARGETS]);
    // the facial tracks' keys (anime-face-tracks.js; scene-gltf.tracks.test.js checks them) follow the face's own
    expect(Object.keys(mesh.extras.face)).toEqual(['about', 'fps', 'eyeKnots', 'fixKnots', 'words', 'sides', 'brow', 'ambientClip', 'ambientOver', 'keying']);
    expect(mesh.extras.face.words.authored).toEqual(authored);
    expect(mesh.extras.face.words.happy).toEqual(faceWeights(faceState(resolveAnimeExpression('happy'))));
    // the default weights: POSITION (the neutral head) + Σ w · target lands on the stored face within the blend's own
    // accuracy, the words' 0.3 mm (the open and smile channels combine not quite linearly at the mouth's rim: 0.246 mm on
    // this male's wide mouth, 0.175 mm on the female base's)
    const P = floats(G, body.attributes.POSITION), P0 = floats(N, nBody.attributes.POSITION), T = body.targets.map((t) => floats(G, t.POSITION));
    let rebased = 0, worst = 0;
    for (let v = 0; v < nV; v++) {
      const o = [0, 1, 2].map((c) => P[v * 3 + c] + mesh.weights.reduce((s, w, t) => s + w * T[t][v * 3 + c], 0));
      worst = Math.max(worst, Math.hypot(o[0] - P0[v * 3], o[1] - P0[v * 3 + 1], o[2] - P0[v * 3 + 2]));
      if (P[v * 3] !== P0[v * 3] || P[v * 3 + 1] !== P0[v * 3 + 1] || P[v * 3 + 2] !== P0[v * 3 + 2]) rebased++;
    }
    expect(worst).toBeLessThan(0.0003); expect(rebased).toBeGreaterThan(0);
    // everything else is the export without the face, byte for byte
    for (const k of ['COLOR_0', 'JOINTS_0', 'WEIGHTS_0']) expect(bytesOf(G, body.attributes[k]).equals(bytesOf(N, nBody.attributes[k])), k).toBe(true);
    expect(bytesOf(G, body.indices).equals(bytesOf(N, nBody.indices))).toBe(true);
    for (const k of ['POSITION', 'JOINTS_0', 'WEIGHTS_0']) expect(bytesOf(G, ink.attributes[k]).equals(bytesOf(N, nInk.attributes[k])), `ink ${k}`).toBe(true);
    expect(bytesOf(G, G.json.skins[0].inverseBindMatrices).equals(bytesOf(N, N.json.skins[0].inverseBindMatrices))).toBe(true);
    // the clips: the body's channels as without the face; the face adds each clip's weights channel (its last sampler)
    // and the face-only ambient blink after them (scene-gltf.tracks.test.js)
    expect(G.json.animations.map((a) => a.name)).toEqual([...N.json.animations.map((a) => a.name), 'face:ambientBlink']);
    N.json.animations.forEach((o, i) => { const a = G.json.animations[i]; expect(a.samplers.length).toBe(o.samplers.length + 1); o.samplers.forEach((q, k) => { const s = a.samplers[k]; expect(bytesOf(G, s.input).equals(bytesOf(N, q.input)) && bytesOf(G, s.output).equals(bytesOf(N, q.output))).toBe(true); }); });
  });

  it('the lit export (the plain pack, no character light) carries the face by vertex, and its default weights put back the stored face', async () => {
    const face = await skinnedGlb(ANIME, { unshaded: true, face: true }), plain = await skinnedGlb(ANIME, { unshaded: true });
    const G = glbOf(face.bytes), N = glbOf(plain.bytes);
    const [body] = G.json.meshes.find((m) => m.name === 'body:skinned').primitives, [nBody] = N.json.meshes.find((m) => m.name === 'body:skinned').primitives;
    const w = G.json.meshes.find((m) => m.name === 'body:skinned').weights;
    const P = floats(G, body.attributes.POSITION), P0 = floats(N, nBody.attributes.POSITION), T = body.targets.map((t) => floats(G, t.POSITION));
    let worst = 0; for (let v = 0; v < P.length / 3; v++) worst = Math.max(worst, Math.hypot(...[0, 1, 2].map((c) => P[v * 3 + c] + w.reduce((s, x, t) => s + x * T[t][v * 3 + c], 0) - P0[v * 3 + c])));
    expect(worst).toBeLessThan(0.0003);
    expect(bytesOf(G, body.attributes.COLOR_0).equals(bytesOf(N, nBody.attributes.COLOR_0))).toBe(true);
  });

  it('a hero whose own lid closure sits between the knots carries its corrective pair, and its default weights put back the stored face', async () => {
    const OWN = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', head: 'anime', register: 'lowpoly', expression: ['neutral', { blink: 0.35 }] }) });
    const G = glbOf((await skinnedGlb(OWN, { face: true })).bytes), N = glbOf((await skinnedGlb(OWN)).bytes);
    const mesh = G.json.meshes.find((m) => m.name === 'body:skinned'), [body] = mesh.primitives, [nBody] = N.json.meshes.find((m) => m.name === 'body:skinned').primitives;
    expect(mesh.extras.targetNames).toEqual([...FACE_TARGETS, 'blinkFix35L', 'blinkFix35R']); expect(body.targets.length).toBe(FACE_TARGETS.length + 2);
    expect(mesh.extras.face.fixKnots.at(-1)).toBe(0.35); expect(mesh.extras.face.eyeKnots).toContain(0.35);
    expect(mesh.weights.slice(-2)).toEqual([1, 1]); expect(mesh.weights[0]).toBe(0.35);
    const P = floats(G, body.attributes.POSITION), P0 = floats(N, nBody.attributes.POSITION), T = body.targets.map((t) => floats(G, t.POSITION));
    let worst = 0; for (let v = 0; v < P.length / 3; v++) worst = Math.max(worst, Math.hypot(...[0, 1, 2].map((c) => P[v * 3 + c] + mesh.weights.reduce((s, x, t) => s + x * T[t][v * 3 + c], 0) - P0[v * 3 + c])));
    expect(worst).toBeLessThan(0.0003);
  });

  it('a landmark hero and the head-none hero resolve to the same skinned bytes with the face asked for, the bytes they wrote before the face', async () => {
    const cheer = { cheer: [{ support: 'both', crouch: 0.1 }, { support: 'both', armR: { x: 0.3, y: 0.15, z: 0.94 }, elbowR: 'slight' }] };
    // sha256 (first 16 hex) of each skinned GLB as the tree wrote it before the face and the clip timing: pinned, so a
    // change that moved both exports alike still shows. Re-pinned for the hero's `wave` clip keeping its elbow at the
    // shoulder line (hero-form.js): with the old wave in the recipe each export writes the bytes before it
    // (98a75b946e0c4ebc / 932c94ffaa0aae60), still.
    const PIN = { landmark: 'f3144ed3673c4685', none: 'ed0ce1b9d476697d' };
    for (const spec of [{ cast: 'male', register: 'lowpoly', clips: cheer }, { cast: 'female', head: 'none', register: 'lowpoly', clips: cheer }]) {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
      const a = await skinnedGlb(m, { face: true }), b = await skinnedGlb(m);
      expect(a.bytes.equals(b.bytes), spec.head ?? 'landmark').toBe(true);
      expect(createHash('sha256').update(b.bytes).digest('hex').slice(0, 16), spec.head ?? 'landmark').toBe(PIN[spec.head ?? 'landmark']);
      expect(a.faceFigures).toBeUndefined();
      const { payload } = await resolveWorldScene({ ref: 'glb-face', title: 'glb face', manifest: m }, { face: true });
      expect(payload.figures.body.face).toBeUndefined(); expect(payload.figures.body.faceSkipped).toBeUndefined();
    }
  });

  it("export_model's skinned path writes the face and says so; the World payload never carries it", async () => {
    SketchRepository.create({ ref: 'sk_glb_face', title: 'anime hero', manifest: ANIME });
    const r = await exportModelHandler({ ref: 'sk_glb_face', format: 'glb', clips: '_all', skinned: true });
    expect(r.face_figures).toEqual(['body']); expect(r.face_skipped).toBeUndefined();
    expect(readFileSync(path.join(r.dir, 'README.md'), 'utf8')).toMatch(/- Face: the skinned mesh carries the anime head's expression as blend shapes/);
    const rigid = await exportModelHandler({ ref: 'sk_glb_face', format: 'glb', clips: '_all' });
    expect(rigid.face_figures).toBeUndefined();
    expect(readFileSync(path.join(rigid.dir, 'README.md'), 'utf8')).not.toMatch(/- Face:/);
    const { payload } = await resolveWorldScene({ ref: 'sk_glb_face', title: 'anime hero', manifest: ANIME });
    expect(payload.figures.body.face).toBeUndefined();
    expect(payload.figures.body.parts.some((p) => p?.morph)).toBe(false);
    // a row whose head moved under a dial exports without the face, and says why
    SketchRepository.create({ ref: 'sk_glb_face_lean', title: 'anime hero leaning', manifest: { ...ANIME, dials: { ...ANIME.dials, lean: 12 } } });
    const lean = await exportModelHandler({ ref: 'sk_glb_face_lean', format: 'glb', clips: '_all', skinned: true });
    expect(lean.face_figures).toBeUndefined(); expect(lean.face_skipped).toMatch(/a dial or channel moves the head/);
  });
});
