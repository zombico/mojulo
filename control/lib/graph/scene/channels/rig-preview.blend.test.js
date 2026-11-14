// rig-preview.blend.test.js — THE BLEND (rig-preview.js rpBlend): the page's rig preview places a corner the skin shares
// between bones by its weights, as the skinned GLB does, so two bone meshes meeting at a shared corner meet in every frame.
// The case that wanted it: a robe's skirt, its centre seam's corners half on each thigh, its triangles voting for one leg
// or the other in turn; moved rigidly, each with its own bone, the seam opened in a sawtooth at rest (the idle clip) and
// tore from the waist to the hem in a stride. One hero per pack path, chosen by its form: the tiered body (the plain
// pack), the anime head (the character light's pack) and the realistic body (the tailor's skirt).
import { describe, expect, it } from 'vitest';

import { rpBlend, rpBlendIndex, rigPreviewChannelScript } from './rig-preview.js';
import { heroRecord, expandLayeredManifest } from '../../../mcp/tools/layered.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';

const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const u8 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

/** each bone's world frame at key `k` of a packed clip, as the page composes it: head' + q·(v − restHead), the quaternion
 * normalised as the page's nlerp leaves it; row-major 3×4 a bone */
function framesAt(fig, clip, k) {
  const nb = fig.bones.length, M = new Float64Array(nb * 12);
  for (let bi = 0; bi < nb; bi++) {
    const o = (k * nb + bi) * 7, B = clip.b, l = Math.hypot(B[o], B[o + 1], B[o + 2], B[o + 3]), [x, y, z, w] = [B[o] / l, B[o + 1] / l, B[o + 2] / l, B[o + 3] / l];
    const R = [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
    const h = fig.bones[bi].head, t = [0, 1, 2].map((r) => B[o + 4 + r] - (R[r * 3] * h[0] + R[r * 3 + 1] * h[1] + R[r * 3 + 2] * h[2]));
    M.set([R[0], R[1], R[2], t[0], R[3], R[4], R[5], t[1], R[6], R[7], R[8], t[2]], bi * 12);
  }
  return M;
}
const world = (M, bi, p) => { const o = bi * 12; return [0, 1, 2].map((r) => M[o + r * 4] * p[0] + M[o + r * 4 + 1] * p[1] + M[o + r * 4 + 2] * p[2] + M[o + r * 4 + 3]); };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** the corners two (or more) bone meshes share: the same rest position, the same skin, in different parts; with `on`
 * (a bone index list) only those whose skin weighs one of them */
function sharedCorners(fig, on = null) {
  const parts = fig.parts.map((p, bi) => p && { bi, pos: f32(p.pos), J: u8(p.jnt), W: f32(p.wgt) }), by = new Map();
  for (const P of parts) if (P) for (let i = 0; i < P.pos.length / 3; i++) {
    const J = [...P.J.slice(i * 4, i * 4 + 4)], W = [...P.W.slice(i * 4, i * 4 + 4)];
    if (on && !J.some((j, k) => W[k] > 0 && on.includes(j))) continue;
    const key = `${P.pos[i * 3]},${P.pos[i * 3 + 1]},${P.pos[i * 3 + 2]}|${J}|${W}`;
    if (!by.has(key)) by.set(key, []); by.get(key).push([P.bi, i]);
  }
  return { parts, groups: [...by.values()].filter((l) => new Set(l.map(([b]) => b)).size > 1) };
}
/** at each key, how far apart a shared corner's copies land: placed rigidly with each part's bone, and by the blend */
function gaps(fig, clip, keys, on) {
  const { parts, groups } = sharedCorners(fig, on);
  return { groups: groups.length, keys: keys.map((k) => {
    const M = framesAt(fig, clip, k);
    const local = parts.map((P) => { if (!P) return null; const out = Float64Array.from(P.pos); rpBlend({ rest: P.pos, idx: rpBlendIndex(P.J, P.W, P.bi), J: P.J, W: P.W }, M, P.bi, out); return out; });
    let rigid = 0, blend = 0;
    for (const l of groups) {
      const at = (src) => l.map(([b, i]) => world(M, b, [src(b)[i * 3], src(b)[i * 3 + 1], src(b)[i * 3 + 2]]));
      const R = at((b) => parts[b].pos), B = at((b) => local[b]);
      for (let a = 1; a < l.length; a++) { rigid = Math.max(rigid, dist(R[a], R[0])); blend = Math.max(blend, dist(B[a], B[0])); }
    }
    return { k, rigid, blend };
  }) };
}

describe('the blend: a shared corner placed by its weights', () => {
  it('two triangles on two bones meeting at a corner half on each: rigid, they part; blended, they meet; a corner wholly on its bone is untouched', () => {
    // bone 0 turns +30° about z at the origin, bone 1 −30°; part 0 and part 1 each one triangle, the corner (1, 0, 0) shared
    const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6), M = Float64Array.from([c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0]);
    const tri = (bi, other) => ({ rest: Float32Array.from([1, 0, 0, 2, other, 0, 2, 0, 1]), J: Uint8Array.from([0, 1, 0, 0, bi, 0, 0, 0, bi, 0, 0, 0]), W: Float32Array.from([0.5, 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]) });
    const A = tri(0, 1), B = tri(1, -1), placed = (T, bi) => { const out = Float64Array.from(T.rest); rpBlend({ ...T, idx: rpBlendIndex(T.J, T.W, bi) }, M, bi, out); return out; };
    expect([...rpBlendIndex(A.J, A.W, 0)]).toEqual([0]);   // only the shared corner moves off its bone
    const a = placed(A, 0), b = placed(B, 1);
    expect([...a.slice(3)]).toEqual([...A.rest.slice(3)].map(Number));
    const wa = world(M, 0, [a[0], a[1], a[2]]), wb = world(M, 1, [b[0], b[1], b[2]]);
    expect(dist(wa, wb)).toBeLessThan(1e-12);
    expect(dist(wa, [c, 0, 0])).toBeLessThan(1e-12);   // half +30°, half −30°: on the x axis, drawn in by the cosine, as the GLB's linear blend skins it
    expect(dist(world(M, 0, [1, 0, 0]), world(M, 1, [1, 0, 0]))).toBeGreaterThan(0.9);   // rigid: a metre apart
  });
  it('absent: a bank whose parts carry no skin emits the channel as before, no blend', () => {
    const fig = { rig: true, bones: [{ id: 'root', head: [0, 0, 0], tail: [0, 0, 1] }], parts: [{ pos: 'AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAA', col: 'AAAAAAAAAAAAAAAA', faces: 1 }], clips: { bob: { k: 2, b: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1] } }, figH: 1 };
    const pv = [{ figure: 'body', clips: ['bob'], hide: 'body', period: 2 }];
    const plain = rigPreviewChannelScript(pv, { body: fig });
    for (const needle of ['rpBlend', '__rpSkin', 'r.rig.M']) expect(plain).not.toContain(needle);
    expect(plain).toContain('      mesh.matrix.compose(__rpv, __rpq, __rpONE);\n    }');
    const skinned = rigPreviewChannelScript(pv, { body: { ...fig, parts: [{ ...fig.parts[0], jnt: Buffer.from(new Uint8Array(12)).toString('base64'), wgt: Buffer.from(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]).buffer).toString('base64') }] } });
    for (const needle of ['function rpBlend(sk, M, bi, pos)', 'function rpBlendIndex(J, W, bi)', 'mesh.userData.sk = __rpSkin(mesh, part, bi)', 'rpBlend(sk, r.rig.M, bi, s)']) expect(skinned).toContain(needle);
  });
});

// a robe (the catalogue's gown family: a bodice and a skirt hung from the hips over both legs) on each pack path
const ROBE = { type: 'outfit', style: 'adventurer', pieces: [{ kind: 'robe' }] };
const PATHS = [
  ['the tiered body (the plain pack)', { cast: 'female', outfit: ROBE }],
  ['the anime head (the character light\'s pack)', { cast: 'female', head: 'anime', outfit: ROBE }],
  ['the realistic body (the tailor\'s skirt)', { cast: 'female', form: 'realistic', outfit: ROBE }],
];
describe('a robe\'s skirt through a walk: its shared corners meet in every frame', () => {
  for (const [label, spec] of PATHS) it(label, async () => {
    const { payload } = await resolveWorldScene({ ref: 'seam', title: 'seam', manifest: expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }) });
    const fig = payload.figures.body, legs = ['thighR', 'thighL'].map((id) => fig.bones.findIndex((b) => b.id === id));
    // the page opens on the first clip where no stand is drawn (the rest the baseline saw torn) and plays the walk
    const idle = fig.clips[payload.figures.body.preview.clips[0]], walk = fig.clips.walk, K = walk.k;
    const rest = gaps(fig, idle, [0], legs), stride = gaps(fig, walk, [0, K / 4, Math.round(0.48 * K), 3 * K / 4].map(Math.round), legs);
    // there is cloth over the legs that two bone meshes share, and moved rigidly it parts (the tear the page showed)
    expect(stride.groups).toBeGreaterThan(20);
    expect(Math.max(...stride.keys.map((x) => x.rigid))).toBeGreaterThan(0.01);
    // blended, every shared corner lands at one place (a tenth of a millimetre: the pack's quaternions are four places)
    for (const x of [...rest.keys, ...stride.keys]) expect(x.blend).toBeLessThan(1e-4);
  }, 240_000);
});
