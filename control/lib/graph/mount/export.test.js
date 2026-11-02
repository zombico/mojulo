// export.test.js — the mount as an engine gets it: the GLB re-skinned from its OWN buffers (its joints' keys, inverse
// binds, weights, the corrective targets and their weights; the way a renderer plays it) is the solver's skin, LBS and
// the corrective shapes, at every key tried; a cycle's keys wrap onto its first; the clips carry their speed and seconds.
// One small skin and one driver (the shapes' fit over the clips is mount.deep.test.js's).
import { describe, it, expect } from 'vitest';
import { resolveMount } from './build.js';
import { bodyMesh } from './body.js';
import { boneFrames, skinPose } from './skin.js';
import { standPose } from './gait.js';
import { skinContext, DRIVERS, bendJoint, correctiveKeys, applyCorrectives } from './correctives.js';
import { mountClips, mountGlb, MOUNT_CLIPS } from './export.js';
import { MOUNT_BONES } from './pose.js';
import { hairCards } from './hair.js';
import { hairRig, bakeHairClip, hairJointKeys } from './hair-bake.js';

// a GLB read by hand: its JSON and BIN, an accessor (sparse ones too), a node's TRS as a matrix
const glbOf = (bytes) => { const jl = bytes.readUInt32LE(12); const bin = bytes.subarray(20 + jl + 8); return { json: JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), bin }; };
const W = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const READ = { 5126: [4, (b, o) => b.readFloatLE(o)], 5125: [4, (b, o) => b.readUInt32LE(o)], 5123: [2, (b, o) => b.readUInt16LE(o)], 5121: [1, (b, o) => b.readUInt8(o)] };
function accessor(G, i) {
  const a = G.json.accessors[i], w = W[a.type], [sz, rd] = READ[a.componentType], out = new Float64Array(a.count * w);
  if (a.bufferView != null) { const v = G.json.bufferViews[a.bufferView], st = v.byteStride || sz * w, o0 = (v.byteOffset || 0) + (a.byteOffset || 0); for (let k = 0; k < a.count; k++) for (let c = 0; c < w; c++) out[k * w + c] = rd(G.bin, o0 + k * st + c * sz); }
  if (a.sparse) {
    const s = a.sparse, iv = G.json.bufferViews[s.indices.bufferView], vv = G.json.bufferViews[s.values.bufferView], [isz, ird] = READ[s.indices.componentType];
    for (let k = 0; k < s.count; k++) { const idx = ird(G.bin, (iv.byteOffset || 0) + (s.indices.byteOffset || 0) + k * isz); for (let c = 0; c < w; c++) out[idx * w + c] = G.bin.readFloatLE((vv.byteOffset || 0) + (s.values.byteOffset || 0) + (k * w + c) * 4); }
  }
  return out;
}
const quatMat = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];

/** the GLB's skin posed at key k of an animation, in the figure's own (z-up) frame: LBS over the morphed rest */
function reskin(G, animName, k) {
  const node = G.json.nodes.find((n) => n.skin !== undefined && n.mesh !== undefined), mesh = G.json.meshes[node.mesh], prim = mesh.primitives[0], skin = G.json.skins[node.skin];
  const P = accessor(G, prim.attributes.POSITION), J = accessor(G, prim.attributes.JOINTS_0), Wt = accessor(G, prim.attributes.WEIGHTS_0), ibm = accessor(G, skin.inverseBindMatrices);
  const anim = G.json.animations.find((a) => a.name === animName), n = P.length / 3;
  // the joints' rotation and translation at key k (their sampler's k-th output), else their rest
  const R = skin.joints.map((ni) => ({ q: G.json.nodes[ni].rotation ?? [0, 0, 0, 1], t: G.json.nodes[ni].translation ?? [0, 0, 0] }));
  let weights = mesh.weights ? [...mesh.weights] : [];
  for (const ch of anim.channels) {
    const out = accessor(G, anim.samplers[ch.sampler].output);
    if (ch.target.path === 'weights') { const m = weights.length; weights = Array.from(out.subarray(k * m, k * m + m)); continue; }
    const ji = skin.joints.indexOf(ch.target.node);
    if (ch.target.path === 'rotation') R[ji].q = Array.from(out.subarray(k * 4, k * 4 + 4)); else R[ji].t = Array.from(out.subarray(k * 3, k * 3 + 3));
  }
  const rest = Float64Array.from(P);
  (prim.targets || []).forEach((tg, ti) => { if (!weights[ti]) return; const d = accessor(G, tg.POSITION); for (let i = 0; i < rest.length; i++) rest[i] += weights[ti] * d[i]; });
  const Ms = R.map(({ q, t }) => ({ m: quatMat(q), t }));
  const out = [];
  for (let v = 0; v < n; v++) {
    const p = [0, 0, 0];
    for (let c = 0; c < 4; c++) {
      const w = Wt[v * 4 + c]; if (!w) continue;
      const j = J[v * 4 + c], I = ibm.subarray(j * 16, j * 16 + 16), x = rest[v * 3], y = rest[v * 3 + 1], z = rest[v * 3 + 2];
      const b = [I[0] * x + I[4] * y + I[8] * z + I[12], I[1] * x + I[5] * y + I[9] * z + I[13], I[2] * x + I[6] * y + I[10] * z + I[14]];
      const { m, t } = Ms[j];
      for (let a = 0; a < 3; a++) p[a] += w * (m[a][0] * b[0] + m[a][1] * b[1] + m[a][2] * b[2] + t[a]);
    }
    out.push(p);
  }
  return { out, rest: P, weights };
}

describe('the mount exported', () => {
  const B = resolveMount('horse'), m = bodyMesh(B, { cells: 36 }), ctx = skinContext(B, m);
  const elbow = DRIVERS.find((d) => d.id === 'elbowR');
  const set = correctiveKeys(ctx, { drivers: [elbow], corpus: [bendJoint(ctx.rest, elbow, 1.4), bendJoint(ctx.rest, elbow, -0.4)], fractions: [0.5, 1] });
  const clips = mountClips(B, { names: ['trot', 'jump'] });
  const g = mountGlb(B, { mesh: m, set, clips, hair: false }), G = glbOf(g.bytes);
  // each GLB vertex's mesh vertex, the nearest to its rest place (the writer welds the corner soup back onto the mesh's
  // vertices, each stored off its bone's head: a float's rounding off)
  const cell = (p) => p.map((x) => Math.floor(x / 0.01)).join(','), grid = new Map();
  m.vertices.forEach((v, i) => { const c = cell(v); if (!grid.has(c)) grid.set(c, []); grid.get(c).push(i); });
  const near = (p) => { let best = -1, bd = Infinity; const [a, b, c] = p.map((x) => Math.floor(x / 0.01)); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) for (const vi of grid.get(`${a + i},${b + j},${c + k}`) ?? []) { const d = Math.hypot(...m.vertices[vi].map((x, q) => x - p[q])); if (d < bd) { bd = d; best = vi; } } return { i: best, d: bd }; };
  const byPlace = { has: (p) => near(p).d < 1e-5, get: (p) => near(p).i };
  const key = (p) => p;

  it('one skinned mesh on the rig\'s bones, the clips named, a target per key, the clips\' speed and seconds', () => {
    expect(g.skinnedFigures).toEqual(['mount']);
    const skin = G.json.skins[0];
    expect(skin.joints.map((ni) => G.json.nodes[ni].name)).toEqual(MOUNT_BONES.map((b) => expect.stringContaining(b.id)));
    expect(G.json.animations.map((a) => a.name)).toEqual(['mount:trot', 'mount:jump']);
    const mesh = G.json.meshes.find((x) => x.extras?.targetNames);
    expect(mesh.extras.targetNames).toEqual(set.drivers[0].keys.map((k) => `elbowR@${Math.round(k.angle * 180 / Math.PI)}`));
    expect(mesh.extras.correctives.about).toMatch(/mount/);
    expect(G.json.animations[0].extras['moj:speed']).toBeCloseTo(clips.trot.v, 3);
    const times = accessor(G, G.json.animations[0].samplers[0].input);
    expect(times[times.length - 1]).toBeCloseTo(clips.trot.s, 5);
    // every welded vertex is a mesh vertex; its weights sum to one
    const prim = G.json.meshes[G.json.nodes.find((x) => x.skin !== undefined).mesh].primitives[0], P = accessor(G, prim.attributes.POSITION), Wt = accessor(G, prim.attributes.WEIGHTS_0);
    for (let v = 0; v < P.length / 3; v++) { expect(byPlace.has(key([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]))).toBe(true); expect(Math.abs(Wt[v * 4] + Wt[v * 4 + 1] + Wt[v * 4 + 2] + Wt[v * 4 + 3] - 1)).toBeLessThan(1e-6); }
  });

  it('re-skinned from its own buffers it is the solver\'s skin: LBS and the shapes, key by key', () => {
    const K = g.pack.clips.jump.k;
    for (const [anim, clip, k] of [['mount:trot', 'trot', 0], ['mount:trot', 'trot', 7], ['mount:jump', 'jump', Math.round(K * 0.62)], ['mount:jump', 'jump', K - 1]]) {
      const c = clips[clip], kk = g.pack.clips[clip].k, t = c.once ? c.s * k / (kk - 1) : c.s * k / kk, frames = boneFrames(B, c.at(t));
      const want = applyCorrectives(ctx, set, frames), { out, rest, weights } = reskin(G, anim, k);
      let off = 0;
      for (let v = 0; v < out.length; v++) { const i = byPlace.get(key([rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]])); off = Math.max(off, Math.hypot(out[v][0] - want[i][0], out[v][1] - want[i][1], out[v][2] - want[i][2])); }
      expect(off, `${anim} key ${k}`).toBeLessThan(3e-4);
      if (clip === 'jump' && k === Math.round(K * 0.62)) expect(weights.some((w) => w > 0)).toBe(true);   // (the elbow folds there: its shapes on)
    }
  });

  it('a cycle loops: its stride\'s end is its start; without shapes the export is plain LBS', () => {
    const a = boneFrames(B, clips.trot.at(0)), b = boneFrames(B, clips.trot.at(clips.trot.s));
    for (const id of Object.keys(a)) expect(Math.hypot(...a[id].h.map((x, i) => x - b[id].h[i]))).toBeLessThan(1e-9);
    const bare = mountGlb(B, { mesh: m, clips: { trot: clips.trot }, hair: false }), H = glbOf(bare.bytes);
    expect(H.json.meshes.some((x) => x.extras?.targetNames)).toBe(false);
    const { out, rest } = reskin(H, 'mount:trot', 5), frames = boneFrames(B, clips.trot.at(clips.trot.s * 5 / bare.pack.clips.trot.k)), want = skinPose(m, boneFrames(B, standPose(B)), frames);
    let off = 0;
    for (let v = 0; v < out.length; v++) { const i = byPlace.get(key([rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]])); off = Math.max(off, Math.hypot(...out[v].map((x, j) => x - want[i][j]))); }
    expect(off).toBeLessThan(3e-4);
  });

  it('its hair baked: chains along the strands, their heads the simulation\'s points, the GLB carrying their keys', () => {
    const h = mountGlb(B, { mesh: m, clips: { trot: clips.trot } }), H = glbOf(h.bytes), rig = hairRig(B), nb = MOUNT_BONES.length;
    const skin = H.json.skins[0], names = skin.joints.map((ni) => H.json.nodes[ni].name);
    expect(names.length).toBe(nb + rig.joints.length);
    expect(names.slice(nb)).toEqual(rig.joints.map((J) => expect.stringContaining(J.id)));
    // the simulation through the cycle, on the clip's keys; each chain's keys from it
    const K = h.pack.clips.trot.k, S = bakeHairClip(B, rig, clips.trot, K), rest = boneFrames(B, standPose(B));
    for (const k of [0, Math.floor(K / 2)]) {
      const F = boneFrames(B, clips.trot.at(clips.trot.s * k / K)), keys = hairJointKeys(rig, S[k], F, rest);
      // a joint's head is its simulated point; its direction the simulated chord's
      rig.joints.forEach((J, j) => {
        expect(Math.hypot(...keys[j].h.map((x, i) => x - S[k][J.gi][J.a][i]))).toBe(0);
        const d = [0, 1, 2].map((a) => keys[j].R[a][0] * J.dir[0] + keys[j].R[a][1] * J.dir[1] + keys[j].R[a][2] * J.dir[2]), c = S[k][J.gi][J.b].map((x, i) => x - S[k][J.gi][J.a][i]), cl = Math.hypot(...c);
        expect(Math.hypot(...d.map((x, i) => x - c[i] / cl))).toBeLessThan(1e-9);
      });
      // the GLB's own hair, re-skinned at that key, is the cards skinned on those keys (the file carries them)
      const { out, rest: P } = reskin(H, 'mount:trot', k), cards = hairCards(rig.guides, rig.rest);
      const want = cards.vertices.map((v, vi) => { const [[j]] = rig.skin(cards.at[vi]), J = rig.joints[j], d = v.map((x, i) => x - J.head[i]), R = keys[j].R; return [0, 1, 2].map((a) => keys[j].h[a] + R[a][0] * d[0] + R[a][1] * d[1] + R[a][2] * d[2]); });
      const cardAt = new Map(cards.vertices.map((v, vi) => [v.map((x) => Math.round(x * 1e4)).join(','), vi]));
      let off = 0, seen = 0;
      for (let v = 0; v < out.length; v++) { const vi = cardAt.get([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]].map((x) => Math.round(x * 1e4)).join(',')); if (vi === undefined) continue; seen++; off = Math.max(off, Math.hypot(...out[v].map((x, i) => x - want[vi][i]))); }
      expect(seen).toBeGreaterThan(cards.vertices.length);                    // (both faces of every card)
      expect(off).toBeLessThan(3e-4);
    }
    // rigid: the chains ride their bones; no hair: none
    const r = mountGlb(B, { mesh: m, clips: { trot: clips.trot }, hair: 'rigid' });
    expect(r.pack.bones.length).toBe(nb + rig.joints.length);
    expect(g.pack.bones.length).toBe(nb);
  });

  it('every clip it names can be made', () => {
    const all = mountClips(B);
    expect(Object.keys(all)).toEqual([...MOUNT_CLIPS]);
    for (const [name, c] of Object.entries(all)) { expect(c.s, name).toBeGreaterThan(0.3); expect(Object.keys(c.at(c.s * 0.5).bones).length).toBe(MOUNT_BONES.length); }
  });
});
