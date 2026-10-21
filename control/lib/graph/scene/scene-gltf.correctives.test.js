// scene-gltf.correctives.test.js — the realistic body's CORRECTIVES (body-relational-correctives.js) posed and exported:
// a realistic hero posed with an arm raised (hero-gesture poseLayered) skins the rest its correctives drive; the rig pack
// (station-loft-rig packLayeredRig `correctives`) carries their rows per corner, their drivers and each clip key's
// weights, and its rest plus the rows at a pose's weights is that pose's corrected rest; the skinned GLB writes one
// sparse target per corrective after the face's, its driver in the extras and a weights channel per clip. Without them,
// the pack is the one before them. (Beside the face's suite; not in the critical tier: a realistic mint takes seconds.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, expect, it } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered, packLayeredRig, correctiveWeight } from '../polygonizer/station-loft-rig.js';
import { poseLayered } from '../polygonizer/hero-gesture.js';
import { correctiveRest } from '../polygonizer/body-relational-correctives.js';

const glbOf = (bytes) => { const jl = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), bin: bytes.subarray(28 + jl) }; };
const NC = { SCALAR: 1, VEC3: 3, VEC4: 4 };
const viewBytes = (G, bvI, n, off = 0) => { const bv = G.json.bufferViews[bvI]; const o = (bv.byteOffset || 0) + off; return G.bin.subarray(o, o + n); };
const floats = (G, i) => { const a = G.json.accessors[i], n = a.count * NC[a.type], b = viewBytes(G, a.bufferView, n * 4, a.byteOffset || 0); return Float32Array.from({ length: n }, (_, k) => b.readFloatLE(k * 4)); };
const f32 = (b64) => { const b = Buffer.from(b64, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const u32 = (b64) => { const b = Buffer.from(b64, 'base64'); return new Uint32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const RAISED = { armR: { x: 0.3, y: 0, z: 1 } };

// (the landmark head named: its face's targets are the ones the correctives follow; the realistic default, the relational
// head, has none)
const M = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', head: 'landmark' }) });
const C = M.recipe.correctives;

describe('the realistic body\'s correctives, posed and exported', () => {
  it('poses: an arm raised skins the rest its correctives drive; a recipe without them skins its rest as it is', () => {
    const mesh = compileLayered(M.recipe), R = validateRig(M.recipe.rig), skin = bindLayered(mesh, M.recipe, R);
    const P = poseLayered(mesh, M.recipe, RAISED, { R, skin }), frames = boneFrames(R, R.joints, P.nodes);
    expect(C.some((c) => correctiveWeight(c.driver, P.nodes) > 0)).toBe(true);
    expect(P.mesh.vertices).toEqual(skinLayered({ ...mesh, vertices: correctiveRest(mesh, M.recipe, P.nodes) }, skin, frames));
    const plain = skinLayered(mesh, skin, frames);
    const moved = P.mesh.vertices.reduce((m, v, i) => Math.max(m, Math.hypot(v[0] - plain[i][0], v[1] - plain[i][1], v[2] - plain[i][2])), 0);
    expect(moved).toBeGreaterThan(1e-3);
    // without correctives: the plain skin, value for value
    const bare = { ...M.recipe, correctives: undefined };
    expect(poseLayered(mesh, bare, RAISED, { R, skin }).mesh.vertices).toEqual(plain);
  });

  it('packs: rows per corner, the drivers, each key\'s weights; the rest plus the rows at a pose\'s weights is its corrected rest', () => {
    const mesh = compileLayered(M.recipe), R = validateRig(M.recipe.rig), skin = bindLayered(mesh, M.recipe, R);
    const clips = { raise: [{}, RAISED] };
    const with_ = packLayeredRig(mesh, skin, R, { clips, correctives: C }), without = packLayeredRig(mesh, skin, R, { clips });
    // absent the option, the pack is the one before it: the same less the corrective keys
    const strip = (p) => ({ ...p, correctives: undefined, parts: p.parts.map((x) => (x ? { ...x, corrective: undefined } : x)), clips: Object.fromEntries(Object.entries(p.clips).map(([k, c]) => [k, { ...c, cw: undefined }])) });
    expect(JSON.stringify(strip(with_))).toBe(JSON.stringify(without));
    expect(JSON.stringify(without)).not.toMatch(/corrective|"cw"/);
    // the drivers, their joints on bones, the rest weights
    expect(with_.correctives.targets.map((t) => t.id)).toEqual(C.map((c) => c.id));
    with_.correctives.targets.forEach((t, i) => { expect(t.driver).toEqual(C[i].driver); expect(t.w).toBe(Math.round(correctiveWeight(C[i].driver, R.joints) * 1e4) / 1e4); });
    for (const j of ['shoulderR', 'elbowR', 'shoulderL', 'elbowL', 'navel', 'neckHub']) expect(R.bones.some((b) => b.id === with_.correctives.joints[j]?.bone)).toBe(true);
    // each key's weights: the raised key drives the right side's
    const cw = with_.clips.raise.cw, n = C.length;
    expect(cw.length).toBe(with_.clips.raise.k * n);
    const nodesUp = rigNodesAt(R, RAISED).nodes, upKey = with_.clips.raise.k / 2;
    C.forEach((c, t) => expect(cw[upKey * n + t]).toBeCloseTo(correctiveWeight(c.driver, nodesUp), 4));
    // the pack's rest + Σ w · rows = the corrected rest (dz seats both), corner by corner on the pack's own vertices
    const w = C.map((c) => correctiveWeight(c.driver, nodesUp)), fixed = correctiveRest(mesh, M.recipe, nodesUp);
    const at = new Map(); mesh.vertices.forEach((v, i) => { const k = v.map((x) => Math.round(x * 1e4)).join(); if (!at.has(k)) at.set(k, []); at.get(k).push(i); });
    let rows = 0, worst = 0;
    for (const part of with_.parts) {
      if (!part?.corrective) continue;
      const pos = f32(part.pos), ids = u32(part.corrective.i), d = f32(part.corrective.d);
      ids.forEach((vi, k) => {
        rows++;
        const p = [pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]], q = p.map((x, c) => x + w.reduce((s, ww, t) => s + ww * d[(k * n + t) * 3 + c], 0));
        const cands = at.get(p.map((x) => Math.round(x * 1e4)).join()) || [];
        const err = Math.min(...cands.map((i) => Math.hypot(...[0, 1, 2].map((c) => fixed[i][c] - q[c]))));
        if (cands.length) worst = Math.max(worst, err);
      });
    }
    expect(rows).toBeGreaterThan(100); expect(worst).toBeLessThan(1e-5);
  });

  it('exports: the skinned GLB carries one target per corrective after the face\'s, the drivers, the rest weights and each clip\'s weights; the World page never asks', async () => {
    const page = await resolveWorldScene({ ref: 'corr', title: 'corr', manifest: M });
    expect(page.payload.figures.body.correctives).toBeUndefined();
    const { payload } = await resolveWorldScene({ ref: 'corr', title: 'corr', manifest: M }, { face: true });
    const fig = payload.figures.body;
    expect(fig.correctives.targets.map((t) => t.id)).toEqual(C.map((c) => c.id));
    const out = facesToGlb(payload, { generator: 'mojulo corr', clips: '_all', skinned: true }), G = glbOf(out.bytes);
    const mesh = G.json.meshes.find((m) => m.name === 'body:skinned'), faceN = fig.face.targets.length, n = C.length;
    expect(mesh.extras.targetNames).toEqual([...fig.face.targets, ...C.map((c) => c.id)]);
    expect(mesh.weights).toEqual([...fig.face.weights, ...fig.correctives.targets.map((t) => t.w)]);
    expect(mesh.extras.correctives.targets.map((t) => t.driver)).toEqual(C.map((c) => c.driver));
    expect(mesh.extras.correctives.joints.shoulderR.bone).toBe(fig.correctives.joints.shoulderR.bone);
    for (const p of mesh.primitives) expect(p.targets.length).toBe(faceN + n);
    // each corrective's target is sparse over the corners its rows touch, the largest offset its own
    const body = mesh.primitives[0];
    C.forEach((c, t) => {
      const a = G.json.accessors[body.targets[faceN + t].POSITION];
      expect(a.sparse.count).toBeGreaterThan(0);
      const big = Math.max(...Object.values(c.d).map((o) => Math.hypot(...o)));
      const vals = viewBytes(G, a.sparse.values.bufferView, a.sparse.count * 12);
      let mx = 0; for (let k = 0; k < a.sparse.count; k++) mx = Math.max(mx, Math.hypot(vals.readFloatLE(k * 12), vals.readFloatLE(k * 12 + 4), vals.readFloatLE(k * 12 + 8)));
      expect(mx).toBeCloseTo(big, 5);
    });
    // every clip one weights channel over every target; its keys are the clip's (body) times at least
    const node = G.json.nodes.findIndex((x) => x.name === 'body:body');
    for (const anim of G.json.animations.filter((a) => a.name.startsWith('body:'))) {
      const ws = anim.channels.filter((ch) => ch.target.path === 'weights');
      expect(ws.length).toBe(1); expect(ws[0].target.node).toBe(node);
      const s = anim.samplers[ws[0].sampler], times = floats(G, s.input), vals = floats(G, s.output);
      expect(s.interpolation).toBe('LINEAR');
      expect(vals.length).toBe(times.length * (faceN + n));
      for (let k = 1; k < times.length; k++) expect(times[k]).toBeGreaterThan(times[k - 1]);
    }
    // a clip with a face track of several drawings (one injected on the wave): each drawing at its own time and held to
    // a hair before the next (the step kept), the correctives interpolated over the body's keys
    const end = G.json.accessors[G.json.animations.find((a) => a.name === 'body:wave').samplers[0].input].max[0];
    const tr = { t: [0, end * 0.3, end * 0.6, end], w: [0, 1, 2, 3].map((j) => fig.face.weights.map((x, i) => (i === j ? 1 : x))) };
    const G2 = glbOf(facesToGlb({ ...payload, figures: { body: { ...fig, face: { ...fig.face, tracks: { ...fig.face.tracks, wave: tr } } } } }, { generator: 'mojulo corr', clips: '_all', skinned: true }).bytes);
    const wave = G2.json.animations.find((a) => a.name === 'body:wave'), ws = wave.samplers[wave.channels.find((ch) => ch.target.path === 'weights').sampler];
    const times = floats(G2, ws.input), vals = floats(G2, ws.output), W = faceN + n, keyAt = (t) => times.findIndex((x) => Math.abs(x - t) < 1e-6);
    for (let j = 1; j < tr.t.length - 1; j++) {
      const k = keyAt(Math.fround(tr.t[j])), pre = keyAt(Math.fround(tr.t[j] - 1e-3));
      expect(k).toBeGreaterThan(0); expect(pre).toBe(k - 1);
      expect(Array.from(vals.slice(k * W, k * W + faceN))).toEqual(tr.w[j].map(Math.fround));
      expect(Array.from(vals.slice(pre * W, pre * W + faceN))).toEqual(tr.w[j - 1].map(Math.fround));
    }
    const bodyKeys = floats(G2, wave.samplers[0].input), cw = fig.clips.wave.cw, K = fig.clips.wave.k;
    bodyKeys.forEach((t, k) => { const at = keyAt(t); expect(at).toBeGreaterThanOrEqual(0); C.forEach((_, c) => expect(vals[at * W + faceN + c]).toBeCloseTo(cw[(k % K) * n + c], 5)); });
    expect(Math.max(...cw)).toBeGreaterThan(0.5);   // the wave raises an arm: its correctives come on
    // the ambient blink holds the correctives at rest
    const amb = G.json.animations.find((a) => a.name === fig.face.ambient.name), av = floats(G, amb.samplers[0].output);
    expect(Array.from(av.slice(faceN, faceN + n))).toEqual(fig.correctives.targets.map((t) => Math.fround(t.w)));
    expect(out.faceFigures).toEqual(['body']);
  }, 60000);

  it('the lit export: the realistic body\'s corners carry the weld\'s normals and no baked shade, one smooth skin', async () => {
    const { payload } = await resolveWorldScene({ ref: 'corr', title: 'corr', manifest: M }, { face: true, unshaded: true });
    const fig = payload.figures.body, G = glbOf(facesToGlb(payload, { generator: 'mojulo corr', clips: '_all', skinned: true, lit: true }).bytes);
    expect(fig.parts.filter(Boolean).every((p) => typeof p.nrm === 'string')).toBe(true);
    const prim = G.json.meshes.find((m) => m.name === 'body:skinned').primitives[0], P = floats(G, prim.attributes.POSITION), N = floats(G, prim.attributes.NORMAL);
    // corners on one point agree, so they are one vertex (the weld, scene-gltf.js weldCorners: a crease, a part's seam or a
    // UV seam keeps its two sides apart, as a colour's edge does): far fewer vertices than corners, a point mostly once
    const by = new Map(); for (let v = 0; v < P.length / 3; v++) { const k = [0, 1, 2].map((c) => Math.round(P[v * 3 + c] * 1e5)).join(); if (!by.has(k)) by.set(k, []); by.get(k).push(v); }
    expect(N.length).toBe(P.length);
    expect(P.length / 3).toBeLessThan(G.json.accessors[prim.indices].count / 4);
    expect((P.length / 3 - by.size) / by.size).toBeLessThan(0.35);
    // no baked shade: the skin's corners are a handful of colours, not a gradient
    const C0 = floats(G, prim.attributes.COLOR_0), cols = new Set(); for (let v = 0; v < C0.length / 3; v++) cols.add([0, 1, 2].map((c) => C0[v * 3 + c].toFixed(4)).join());
    expect(cols.size).toBeLessThan(64);
  }, 60000);
});
